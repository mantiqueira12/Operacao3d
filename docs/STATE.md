# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-13.

## Agora
- Editor 2D com PARIDADE DE UX (decisão do dono: protótipo = spec visual). `app/src/editor/`:
  `planner.css` (design system portado), `icons.tsx` (ícones + glyph do catálogo),
  `SceneLayers.tsx` (floor/grid/FOH-BOH/zonas/cotas/itens/overlay em px, SCALE=100),
  `Planner.tsx` (topbar, catálogo, propriedades+swatches, camadas, resumo, carimbo),
  `useScene.ts` (estado + persistência). Funcional: inserir, mover, redimensionar (8 alças),
  girar, duplicar, excluir, zoom/pan/Ajustar, camadas, snap, medir, export/import JSON,
  carimbo editável. Verificado no browser (11 itens, 6 cotas, sem erros). 26 testes.
- Antes: domínio TS, StorageAdapter (async), scaffolding React+Vite+TS.

## Próximo (fila priorizada)
1. **Portar motor DES** (`sim-core.js`) para TS em Web Worker; validar contra Python.
   _DoD:_ mesmos resultados (±tolerância) do `python-simulator` no cenário base.

## Dívidas do editor (refinar depois)
- Paridade visual conferida lado a lado com o protótipo (paredes grossas, cotas, FOH/BOH,
  entrada empilhada). OK para o nível atual.
- Clamp usa bbox da casca, não o polígono em L (peça pode entrar no recorte ausente).
- Falta: undo/redo, "+ Criar" equipamento custom + "Meus modelos", ferramenta Parede/Divisor
  como desenho por arraste (hoje inserem peça), render especial de porta/painel (hatch/folga),
  acabamentos (piso/parede), botões Operação/Ver 3D (navegação p/ módulos ainda não portados).
- Zonas watermark ("COZINHA"/"02 · PREPARO") são aproximação; conferir textos do protótipo.
- UI single-project; falta seletor de projetos (multi-projeto já no domínio/storage).

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
