# CellVision 3D

MVP local em React, TypeScript, Vite e React Three Fiber. O README apresenta a aplicação e este guia detalha os fluxos e limites de desenvolvimento.

## Desenvolvimento

Requer Node.js 22.12+ (validado com 24.19) e npm. No checkout:

```sh
npm ci
npm run server
npm run dev
```

O backend escuta em `127.0.0.1:8787` e o Vite em `5173`, encaminhando `/api` para o backend. Para produção, execute `npm run build` e `npm start`; o mesmo processo Node serve a API, os arquivos em `dist` e o fallback de rotas.

O banco JSON fica em `data/cellvision.json` por padrão. `DATA_FILE`, `PORT` e `HOST` configuram o caminho, a porta e a interface de rede. As escritas são serializadas e usam substituição atômica; payloads têm limite de 2 MB e são validados antes da persistência.

## Validação

```sh
npm test
npm run build
npm run test:e2e
```

Os testes de navegador usam o Chromium do Playwright, ou um executável definido por `CHROMIUM_PATH`. Fora do Windows, a configuração força WebGL por software para ambientes sem GPU; no Windows, usa a aceleração disponível com fallback por software. Para forçar esse modo no Windows, defina `CELLVISION_SOFTWARE_WEBGL=1`. Capturas e PDF dos fluxos antigos são gerados em `/tmp`; capturas do modelo detalhado ficam em `test-results/`.

## Fluxo

1. Explore o smartphone demonstrativo com mouse ou toque. Use os controles de vista e desmontagem.
2. Selecione uma peça no 3D ou na lista. Registre estado, sintoma, diagnóstico e valores.
3. Adicione peças ao orçamento; preencha cliente, aparelho, prazo e desconto.
4. Salve, exporte PDF, imprima ou abra a mensagem do WhatsApp para confirmar o envio.
5. Use o modo cliente para apresentação no mesmo dispositivo.

Diagnósticos e orçamento em edição são persistidos automaticamente pelo Zustand. Orçamentos salvos e ordens usam a API em `server/`, com cache no `localStorage` para tolerar indisponibilidade temporária. Ainda não há autenticação multiusuário ou backup remoto. O armazenamento contém dados pessoais: use um dispositivo e servidor de confiança e mantenha cópias de `data/cellvision.json`. Um novo orçamento limpa as avaliações da bancada; snapshots já guardados em OS não são alterados.

## Modelos e expansão

`src/data.ts` mantém o catálogo técnico e o caminho do modelo detalhado. A bancada carrega `public/models/smartphone-disassembly.glb` por padrão, com seleção, montagem e desmontagem dos conjuntos. **Esquema técnico** alterna para a geometria procedural. Se o GLB falhar, esse esquema assume automaticamente sem interromper o diagnóstico.

O arquivo enviado, `smartphone-3d-model-d498a2fb.glb`, representa um smartphone já desmontado em uma única malha. Uma cópia original fica em `research/iphone-15/assets/smartphone-source.glb`. `scripts/prepare-smartphone-model.mjs` recupera 15 conjuntos desconectados, simplifica a geometria de 1.897.110 para 142.266 triângulos e preserva as três texturas incorporadas. Para reconstruir o arquivo servido:

```sh
npm run prepare:model
# Ou informe um arquivo de origem e um destino:
node scripts/prepare-smartphone-model.mjs "caminho/do/modelo.glb" "public/models/smartphone-disassembly.glb"
```

Esse preparador é específico para a estrutura do arquivo fornecido e exige 15 conjuntos. O resultado não precisa de decodificador ou textura externos. `src/ImportedPhone.tsx` alinha os conjuntos pelo eixo principal e adapta as dimensões ao catálogo; `src/disassembly.ts` associa as malhas aos componentes e define os intervalos da animação. Tela e chassis usam mais de uma malha. TrueDepth frontal, alto-falante superior e cobertura das lentes continuam representados pelo esquema procedural porque o arquivo não fornece conjuntos identificáveis para esses componentes. O mapeamento é ilustrativo; não comprova correspondência física ou precisão de engenharia do iPhone 15.

Os atalhos **Montado**, **Abrir**, **Internos** e **Separar** controlam a sequência; **Isolar peça** centraliza apenas o componente selecionado. A animação respeita movimento reduzido e o nível médio evita as passagens de sombras da qualidade alta. Proveniência e limites do arquivo: [modelo importado](research/iphone-15/assets/README.md).

A seleção das malhas detalhadas usa BVH para acelerar os testes de interseção do ponteiro. O visualizador evita renderizações disparadas apenas pela edição dos formulários. A reprodução limita o avanço por quadro para impedir saltos de etapa quando o navegador demora a renderizar; a câmera e as peças usam amortecimento exponencial com tempo real. O botão **Inverter** indica quando a remontagem está ativa.

Arrastar o modelo não seleciona uma peça. Na qualidade baixa/média, a câmera acompanha o gesto sem inércia; a qualidade alta habilita amortecimento dos controles, exceto quando o usuário solicita movimento reduzido. Isso permite que a renderização sob demanda fique ociosa após a interação.

`CameraModule` e `SmartphoneModel` estão definidos em `src/types.ts`. O catálogo atual é único e demonstrativo. Não há detecção automática de defeitos nem preços de mercado predefinidos.

A camada `QuoteRepository` pode receber uma implementação Supabase futura. Antes de qualquer link público ou SaaS, implementar autenticação, isolamento por assistência com RLS, autorização, expiração de links e tratamento de dados pessoais. Nenhuma credencial é exigida no MVP.

## Limites conhecidos

A geometria é educacional, sem fidelidade de engenharia. O modelo importado conserva as texturas do arquivo fornecido; componentes complementares são esquemáticos. Reflexos são produzidos por luzes e materiais PBR, sem HDRI externo. Não há integração de pagamento, catálogo de aparelhos comerciais ou compartilhamento público. PDF, impressão e WhatsApp devem ser revisados pelo técnico antes de apresentar ao cliente. O WhatsApp abre a mensagem; não faz envio automático.

## Ordens de serviço

A aba **Ordens de serviço** liga o orçamento ao atendimento. Preencha o nome do cliente e adicione uma peça no orçamento; em seguida, use **Criar ordem de serviço**. A OS registra cópias do orçamento e diagnóstico, dados de entrada, responsável, prazo, checklists antes/depois, autorização manual e histórico.

**Abrir na bancada 3D** carrega as cópias do atendimento. Após editar o orçamento, use **Atualizar e abrir OS** para persistir a nova versão. Mudanças de orçamento invalidam aprovação anterior. **Novo atendimento** e **Novo orçamento** limpam o diagnóstico da bancada para evitar mistura de clientes; a cópia de uma OS existente permanece intacta.

Busca, filtro, lista e Kanban estão disponíveis. A lista é ordenada com atrasadas primeiro, seguida por prazo. **CSV** exporta a lista filtrada; não contém notas internas, checklists ou o histórico completo. As OS usam o serviço `OrderRepository` em `src/orderStore.ts` e a chave `cellvision-service-orders`. Ainda são locais e não sincronizadas entre funcionários ou dispositivos.

A aprovação é um registro manual feito pela assistência, não uma assinatura nem uma prova autenticada da identidade do cliente. Antes de uma operação multiusuário, implementar autenticação, autorização e RLS. Não há integração com a conta ou APIs do RepairDesk.

Referências e decisões: [análise pública com REA](docs/references/repairdesk/ANALYSIS.md).
