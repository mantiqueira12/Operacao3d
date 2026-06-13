# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-13.

## Agora
- Modelo de domínio portado (item 1 da fila): `app/src/domain/` com `types.ts` (Item/Room/
  RestaurantScene/CatalogEntry, nomes width/depth/height), `catalog.ts` (catálogo paramétrico
  + `createItem`), `geometry.ts` (`polygonArea`), e `templates/loja206.ts` (a loja virou
  TEMPLATE, não constante — resolve a dívida do hardcoded). 20 testes passando.
- Antes: StorageAdapter (`app/src/storage/`, async/cloud-ready) e scaffolding React+Vite+TS.

## Próximo (fila priorizada)
1. **Portar editor 2D** (SVG) para componente React. _DoD:_ inserir/mover/redimensionar peça.
   Consumir `CATALOG`/`createItem` do domínio e persistir cena via `createStorage()`.
2. **Portar motor DES** (`sim-core.js`) para TS em Web Worker; validar contra Python.
   _DoD:_ mesmos resultados (±tolerância) do `python-simulator` no cenário base.

## Bloqueios
- (nenhum)

## Decisões (ADR-lite)
- 2026-06-13: Stack-alvo = React + Vite + TypeScript (Svelte como alternativa).
- 2026-06-13: Simulação canônica em TS no cliente; Python = golden reference.
- 2026-06-13: Persistência via StorageAdapter (localStorage → nuvem free tier).
- 2026-06-13: `prototype/` é referência v0; não é a base final.

## Não fazer ainda
- Backend pago / infra de nuvem (manter custo-0 no MVP).
- Auth, multi-tenancy, billing (depois do editor + simulação portados).
- Apagar `prototype/` (é a fonte da verdade funcional durante a migração).
