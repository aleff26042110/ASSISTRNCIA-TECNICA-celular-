# Pesquisa do iPhone 15

Catálogo de evidências públicas usado pela reconstrução educacional do aparelho.
O modelo não é um arquivo de engenharia da Apple: posições e geometrias internas
marcadas como `inferred` são aproximações baseadas em manuais e desmontagens.

## Agente local

```sh
npm run research:iphone15 -- validate
npm run research:iphone15 -- collect
```

`validate` funciona offline e verifica fontes, IDs e proveniência. `collect` acessa
somente os domínios HTTPS permitidos no script, salva texto público e hashes em
`snapshots/` e produz `capture-manifest.json`. Nenhuma coleta altera o catálogo da
aplicação automaticamente; a publicação continua sendo uma revisão humana.

Não são usados login, cookies privados, formulários ou técnicas para contornar
bloqueios. As fontes baixadas devem ser usadas como evidência, não redistribuídas
como assets do produto.
