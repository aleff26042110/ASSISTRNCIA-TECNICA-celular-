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

Os testes de navegador usam `/usr/bin/chromium`. Em outro ambiente, defina `CHROMIUM_PATH` para um Chromium instalado. O teste configura renderização WebGL por software para ambientes sem GPU. Capturas e PDF de teste são gerados em `/tmp`.

## Fluxo

1. Explore o smartphone demonstrativo com mouse ou toque. Use os controles de vista e desmontagem.
2. Selecione uma peça no 3D ou na lista. Registre estado, sintoma, diagnóstico e valores.
3. Adicione peças ao orçamento; preencha cliente, aparelho, prazo e desconto.
4. Salve, exporte PDF, imprima ou abra a mensagem do WhatsApp para confirmar o envio.
5. Use o modo cliente para apresentação no mesmo dispositivo.

Diagnósticos e orçamento em edição são persistidos automaticamente pelo Zustand. Orçamentos salvos e ordens usam a API em `server/`, com cache no `localStorage` para tolerar indisponibilidade temporária. Ainda não há autenticação multiusuário ou backup remoto. O armazenamento contém dados pessoais: use um dispositivo e servidor de confiança e mantenha cópias de `data/cellvision.json`. Um novo orçamento limpa as avaliações da bancada; snapshots já guardados em OS não são alterados.

## Modelos e expansão

`src/data.ts` mantém a geometria demonstrativa e os componentes. `GLBModel` em `src/Viewer.tsx` fornece carregamento com `useGLTF`, devendo ser colocado dentro de Suspense. Modelos reais exigem mapeamento de nomes de meshes para IDs de componentes, posições, escalas, licenças e revisão técnica; esse mapeamento ainda não está implementado. Não confunda o modelo genérico com uma reprodução exata de aparelho comercial.

`CameraModule` e `SmartphoneModel` estão definidos em `src/types.ts`. O catálogo atual é único e demonstrativo. Não há detecção automática de defeitos nem preços de mercado predefinidos.

A camada `QuoteRepository` pode receber uma implementação Supabase futura. Antes de qualquer link público ou SaaS, implementar autenticação, isolamento por assistência com RLS, autorização, expiração de links e tratamento de dados pessoais. Nenhuma credencial é exigida no MVP.

## Limites conhecidos

A geometria é esquemática, sem fidelidade de engenharia. Reflexos são produzidos por luzes e materiais PBR, sem HDRI externo. Não há integração de pagamento, catálogo de aparelhos comerciais ou compartilhamento público. PDF, impressão e WhatsApp devem ser revisados pelo técnico antes de apresentar ao cliente. O WhatsApp abre a mensagem; não faz envio automático.

## Ordens de serviço

A aba **Ordens de serviço** liga o orçamento ao atendimento. Preencha o nome do cliente e adicione uma peça no orçamento; em seguida, use **Criar ordem de serviço**. A OS registra cópias do orçamento e diagnóstico, dados de entrada, responsável, prazo, checklists antes/depois, autorização manual e histórico.

**Abrir na bancada 3D** carrega as cópias do atendimento. Após editar o orçamento, use **Atualizar e abrir OS** para persistir a nova versão. Mudanças de orçamento invalidam aprovação anterior. **Novo atendimento** e **Novo orçamento** limpam o diagnóstico da bancada para evitar mistura de clientes; a cópia de uma OS existente permanece intacta.

Busca, filtro, lista e Kanban estão disponíveis. A lista é ordenada com atrasadas primeiro, seguida por prazo. **CSV** exporta a lista filtrada; não contém notas internas, checklists ou o histórico completo. As OS usam o serviço `OrderRepository` em `src/orderStore.ts` e a chave `cellvision-service-orders`. Ainda são locais e não sincronizadas entre funcionários ou dispositivos.

A aprovação é um registro manual feito pela assistência, não uma assinatura nem uma prova autenticada da identidade do cliente. Antes de uma operação multiusuário, implementar autenticação, autorização e RLS. Não há integração com a conta ou APIs do RepairDesk.

Referências e decisões: [análise pública com REA](docs/references/repairdesk/ANALYSIS.md).
