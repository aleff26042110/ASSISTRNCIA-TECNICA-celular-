# RepairDesk como referência para CellVision 3D

A pesquisa usou REA 6.4.0 para inspecionar quatro respostas HTTPS públicas retidas em HAR. Todas retornaram HTTP 200; a coleta verificou TLS com a CA já fornecida pelo ambiente. O coletor não enviou formulários, criou contas ou consultou dados privados. A evidência completa foi preservada em `/workspace/research/repairdesk/rea-public-pages-evidence.json` e o HAR em `/workspace/research/repairdesk/public-pages.har`.

**Evidência:** `ev_b2835d1f426f95c457d6e9e8ca33b9468fd9e69797ea8e5e0e8fba7e9a2da76e`.

O [resumo de evidência](evidence-summary.json) registra URLs, ordinais, localização JSON, respostas, hashes e limites. As frases abaixo foram encontradas nos corpos públicos capturados; elas descrevem funcionalidades anunciadas pelo fornecedor, não comprovam os fluxos da aplicação autenticada.

| Fonte e registro REA | Observação no conteúdo público | Aplicação no CellVision |
| --- | --- | --- |
| [Repair Ticket Management](https://www.repairdesk.co/features/repair-ticket-management-software/), ordinal 1 | “Filter Tickets”: filtros por nome, tipo, status e data | Busca por cliente, número, aparelho, identificação e responsável; filtro de status |
| Mesma página, ordinal 1 | “Pre- & Post-Repair Checklists & Images” | Checklists antes e após reparo; upload de fotos permanece futuro |
| Mesma página, ordinal 1 | “Ticket History”: notas de diagnóstico, equipe e comunicação desde a criação | Histórico de mudanças de etapa, checklist, autorização e dados da OS |
| Mesma página, ordinal 1 | “Multiple Viewing Options”: Kanban, lista e calendário | Lista e Kanban; calendário permanece futuro |
| Mesma página, ordinal 1 | “Ticket Management”: destacar chamados vencidos pelo prazo | Prazo de entrega, destaque de atrasos e ordenação com atrasadas primeiro |
| Mesma página, ordinal 1 | “Internal Notes” e “Diagnostic Notes” | Campo interno separado da explicação destinada ao cliente |
| Mesma página, ordinal 1 | “Associate Parts to Repairs” e atribuição de técnicos | Snapshot do orçamento e diagnóstico 3D associado a cada OS; técnico responsável |
| [Work Order Management](https://www.repairdesk.co/work-order-management-software/), ordinal 3 | Criar tickets, atribuir trabalhos e acompanhar status | Fluxo de atendimento da entrada à entrega |
| [Inventory Management](https://www.repairdesk.co/features/inventory-management-software/), ordinal 2 | Estoque serializado e alertas de nível baixo | Backlog: estoque de peças ligado aos componentes e reservas por OS |
| [Página principal](https://www.repairdesk.co/), ordinal 0 | Orçamentos, relatórios e comunicação com cliente | Reutilização de PDF e WhatsApp existentes; exportação CSV da lista de OS |

## Decisões próprias implementadas

- Cada atendimento guarda uma cópia independente do orçamento e dos diagnósticos. Editar outra bancada não altera automaticamente uma OS anterior.
- Um novo atendimento limpa o diagnóstico anterior. O histórico anterior permanece na sua OS.
- O fluxo padrão é Recebido → Em diagnóstico → Aguardando aprovação → Aguardando peça → Em reparo → Pronto para retirada → Entregue. Há cancelamento e retorno manual de etapas.
- Avançar para reparo exige uma resposta de aprovação explicitamente registrada pelo técnico, com descrição do canal utilizado. Não é autenticação do cliente ou assinatura digital.
- Alterar o orçamento invalida aprovação anterior e retorna à etapa de aprovação. Alterar apenas o diagnóstico sem mudar o orçamento mantém a autorização financeira.
- Pronto para retirada e Entregue exigem checklist pós-reparo concluído e sem falhas. Uma falha registrada quando a OS está pronta retorna ao reparo.
- Notas internas não entram no modo cliente, no PDF do orçamento ou na lista CSV. Isso é separação de apresentação; não fornece controle de acesso entre usuários do mesmo dispositivo.
- O CSV exporta somente a lista filtrada e neutraliza células interpretáveis como fórmulas. Não é backup completo das OS.
- Histórico de cliente relaciona OS por telefone normalizado; nomes iguais não bastam para agrupar pessoas.

Essas regras e o desenho visual são decisões do CellVision, não reproduções verificadas das regras internas do RepairDesk. Nenhum código, marca ou recurso gráfico do RepairDesk foi incorporado à aplicação.

## Limites da investigação

A captura de navegador REA inicialmente falhou por DNS; o perfil com proxy encontrou uma falha de confiança no certificado do Chromium. Não se desativou TLS e não se alterou o repositório de certificados do usuário. A alternativa suportada foi capturar HTTPS com TLS válido e usar `inspect-web-network-capture` do REA.

A autoridade da evidência REA é `historical-reference`, com `runtime_attribution: unknown`: o REA leu registros retidos e não confirmou a origem em uma sessão viva. A coleta HTTPS separada registra a resposta do servidor e os hashes, mas não demonstra execução de funcionalidades. Não foram analisados login, interface autenticada, banco, APIs privadas, permissões, automações, assinatura ou pagamentos. Textos de marketing não comprovam comportamento ou desempenho.

## Reproduzir

No checkout, com Python 3, Node, npm e acesso aos domínios `repairdesk.co` e `www.repairdesk.co`:

```sh
python3 scripts/research-repairdesk.py /workspace/research/repairdesk-new-run
```

O coletor produz HTML público, texto extraído, manifesto, HAR e evidência completa do REA. Usa os bindings de proxy e confiança existentes, sem imprimir valores. Os arquivos são gravados fora do checkout. Os hashes e IDs serão específicos da nova captura.

## Próximos módulos sugeridos

1. Estoque e reserva de peças por OS, com alertas de nível baixo.
2. Fotografias de entrada e saída, com limites de armazenamento e privacidade.
3. Calendário de prazos e agendamentos.
4. Autenticação, isolamento por assistência e RLS antes de dados compartilhados, links públicos ou atribuições com permissões reais.
5. Aprovação autenticada do cliente e notificações consentidas.

Os próximos módulos não estão implementados nesta etapa.
