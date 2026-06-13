# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-13.

## Agora
- Editor 2D portado para React/SVG (item 1 da fila): `app/src/editor/` com `Planner.tsx`
  (catálogo + canvas SVG + propriedades), `useScene.ts` (estado + carga/gravação via
  `createStorage()`, debounce 400ms) e `geometry.ts` (snap/bounds/clamp/rotate). Inserir,
  mover (arraste), redimensionar (4 alças), girar, duplicar, excluir. Carrega template
  Loja 206. Verificado no browser (sem erros de console; área 11,00 m²). 26 testes.
- Antes: domínio TS (`app/src/domain/`), StorageAdapter (async), scaffolding React+Vite+TS.

## Próximo (fila priorizada)
1. **Portar motor DES** (`sim-core.js`) para TS em Web Worker; validar contra Python.
   _DoD:_ mesmos resultados (±tolerância) do `python-simulator` no cenário base.

## Dívidas do editor v1 (refinar depois)
- Clamp usa bbox da casca, não o polígono em L (peça pode entrar no recorte ausente).
- Sem zoom/pan, undo/redo, medir, camadas, export/import JSON (existem no protótipo).
- Rótulos podem transbordar peças pequenas (cosmético); alças grandes em zoom baixo.
- UI single-project; falta seletor de projetos (multi-projeto já suportado no domínio/storage).

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
