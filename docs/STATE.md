# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-13.

## Agora
- Scaffolding React+Vite+TS concluído em `app/` (item 1 da fila). Não quebra `prototype/`.
  `npm run dev` sobe (200 em :5173); `lint`, `typecheck` e `build` passam.
  CI em `.github/workflows/ci.yml` (lint + typecheck + build, working-dir `app/`).

## Próximo (fila priorizada)
1. **StorageAdapter** (interface + `LocalStorageAdapter`) em `app/src`. _DoD:_ salvar/carregar
   projeto sem acoplar à UI; testes unitários (adicionar Vitest).
2. **Portar modelo de domínio** (cena, catálogo, tipos) do `planner.js` para TS.
   _DoD:_ tipos de Item/Room/Project; catálogo paramétrico.
3. **Portar editor 2D** (SVG) para componente React. _DoD:_ inserir/mover/redimensionar peça.
4. **Portar motor DES** (`sim-core.js`) para TS em Web Worker; validar contra Python.
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
