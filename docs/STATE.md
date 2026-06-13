# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-13.

## Agora
- Fundação de continuidade concluída: zip extraído e versionado em `prototype/`,
  criados `CLAUDE.md`, `docs/STATE.md`, `docs/AGENTS.md`, `.gitignore`.

## Próximo (fila priorizada)
1. **Scaffolding React+Vite+TS** na raiz (`/app` ou raiz), sem quebrar `prototype/`.
   _DoD:_ `npm run dev` sobe app vazio tipado; CI lint+build no GitHub Actions.
2. **StorageAdapter** (interface + `LocalStorageAdapter`). _DoD:_ salvar/carregar projeto
   sem acoplar à UI; testes unitários.
3. **Portar modelo de domínio** (cena, catálogo, tipos) do `planner.js` para TS.
   _DoD:_ tipos de Item/Room/Project; catálogo paramétrico.
4. **Portar editor 2D** (SVG) para componente React. _DoD:_ inserir/mover/redimensionar peça.
5. **Portar motor DES** (`sim-core.js`) para TS em Web Worker; validar contra Python.
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
