# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-13.

## Agora
- **Motor de simulação (DES) — port iniciado.** Decisão do dono: portar o `sim-core.js`
  ESPACIAL (A* + operadores que caminham + acoplado ao layout) como canônico em TS.
  Python vira cross-check FROUXO de KPIs agregados (modelos diferentes — ver nota); DoD
  redefinido (não é match exato por seed). Fundação espacial pronta e testada em `app/src/sim/`:
  `types.ts`, `defaults.ts` (cenário base Loja 206), `rng.ts` (PRNG semeável — extensão p/
  reprodutibilidade), `geometry.ts` (casca em L, deriveScene), `nav.ts` (NavGrid + A* +
  servicePoint + reach + slots). 8 testes novos (34 no total): malha 53×104, estações
  alcançáveis, A* atravessa o vão do painel, slots na calçada, RNG determinístico.
- Antes: editor 2D React com paridade de UX (conferida lado a lado com o protótipo).

## Próximo (continuar o motor DES)
1. **Loop dinâmico** do motor (`engine.ts`): demanda (Poisson + curva horária), ciclo do
   cliente (chegada→fila→PDV→preparo→retirada→saída), FSM dos atendentes (volante/fixo),
   FSM do padeiro (BOH), tick(dt), e `computeKPIs()` (filas, espera, utilização, gargalos,
   P&L, pão). Refs: sim-core.js 430-1057 (movimento/tick), 528-639 (padeiro), 647-699
   (demanda), 1074-1230 (KPIs/financeiro/pão).
2. **Web Worker** (`worker.ts`) + `runSimulation()` headless p/ testes.
3. **Cross-check** estatístico vs Python (médias ±tolerância) + adapter
   RestaurantScene(editor) → SceneItem[](sim).

## Nota: por que NÃO bate exatamente com o Python
- `sim-core.js` = DES espacial (A*, layout, pão, 3 itens, taxa 30/h, 12h). Python = pipeline
  abstrato SimPy (4 itens, taxa 2/min, 480 min, seed 42, cenário base degenerado: 89% balking).
  São MODELOS diferentes. Validação = comparação estatística de KPIs agregados, não igualdade.
  Golden Python (ref): ~112 servidos, 11,7% atend., ~14 cli/h, R$~6,9k receita (20 réplicas).

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
