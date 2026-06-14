# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-14.

## Deploy / Git (estado atual)
- **Tudo versionado.** Working tree limpo, 82 arquivos no git. Nada falta importar — só
  artefatos de build ficam de fora (`dist/`, `node_modules/`, `__pycache__`, `*.tsbuildinfo`),
  corretamente no `.gitignore`. O antigo `Operacao 3D.zip` foi removido (já extraído/portado).
- **Branches:** dev = `claude/upbeat-mendel-m8bom6`; `main` = branch publicado. Estão sincronizados.
- **GitHub Pages NO AR:** https://mantiqueira12.github.io/Operacao3d/ (case-sensitive, "O" maiúsculo).
  CI (`.github/workflows/ci.yml`) faz lint+typecheck+test+build em todo push; em push p/ `main`
  ainda faz upload do artifact + `deploy-pages`. Pages source = "GitHub Actions" (já ativado).
- **Fluxo de release:** desenvolver em `claude/upbeat-mendel-m8bom6` → merge p/ `main` → Pages
  atualiza sozinho (~2 min). Rodar local: `cd app && npm install && npm run dev` (localhost:5173).

## Agora
- **Motor DES espacial completo e validado** em `app/src/sim/` (port canônico de `sim-core.js`).
  Cadeia: `geometry`/`nav` (casca L + A*) → `engine.ts` (`SimEngine`: demanda Poisson+curva,
  ciclo do cliente, FSM atendente volante/fixo + padeiro BOH, pão, P&L, `tick`/`computeKPIs`)
  → `worker-core.ts`+`worker.ts` (Web Worker: protocolo `init|run|step|reset|snapshot` →
  `ready|kpis|frame|done|error`, laço ao vivo play/pause). `runReplicas` (Monte Carlo, IC95) e
  `adapter.ts` (`RestaurantScene` do editor → `SceneItem[]`). **62 testes** no total.
- **Cross-check estatístico vs Python — PASSOU.** Modelos diferentes (DES espacial × pipeline
  SimPy), então comparação direcional/ordem de grandeza, não igualdade. No cenário comparável
  de sobrecarga (120/h, 8h, 2 ops): TS throughput **15,4/h** vs Python **13,8/h** (±12%),
  atend. 14,9% vs 11,5%, servidos 123,6 vs 110,3. Os dois motores, construídos de forma
  independente, convergem na capacidade de saturação (~14 cli/h com 2 operadores) — validação
  forte. Direcional confirmado: atend. cai 74%→46%→15% conforme a carga; balking 0→54%.
  `crossCheckVsPython()` automatiza isso; golden Python validado em 2026-06-14 (`PYTHON_GOLDEN`).
- **Melhorias deliberadas** (no topo do `engine.ts`): RNG semeável (reprodutibilidade);
  `stepAlong` consome o orçamento de velocidade inteiro (movimento dt-independente; o original
  avançava só 1 célula/tick); sem heatmap/trilhas (visuais, voltam no render).
- **Painel de Operação na UI (2D ao vivo).** `app/src/sim-ui/`: `useSimWorker` (cria/encerra o
  Worker, (re)inicializa em mudança de cena/config, expõe frame+KPIs+status, start/pause/reset/
  runFull), `SimView` (SVG em metros: casca L, estações, slots, clientes/operadores animados dos
  `frame`s), `SimPanel` (relógio, controles, parâmetros atendentes/demanda/seed/velocidade, KPIs
  ao vivo — clientes, P&L, pão, utilização). `App` alterna Planta⇄Operação; Planner ganhou botão
  "Operação ▸". Worker empacotado em chunk próprio (`vite build`). Verificado: typecheck/lint/
  build/62 testes + serving HTTP 200 (root e worker). NÃO houve verificação visual em browser
  (sem automação no ambiente) — conferir manualmente `npm run dev`.
- **Vista 3D (Three.js).** `app/src/view3d/`: `Scene3D` (renderer imperativo: piso+paredes do
  polígono, cada peça como volume à escala com material por `arch`, frente em vidro, OrbitControls,
  luzes+sombras, resize/dispose) e `View3D` (carrega a cena, info de área/peças/altura, toggle
  paredes translúcidas). Fecha o fluxo **2D → 3D → Simulação**. `App` alterna Planta/3D/Operação;
  3D e Simulação são **lazy-loaded** (code-split: chunk do Three ~131 kB gzip só baixa no 3D;
  índice volta a 72 kB gzip). +dep `three@0.171`.
- **Painel de Operação 2D ao vivo** (`app/src/sim-ui/`): Worker + `SimView` + `SimPanel` (relógio,
  controles, parâmetros, KPIs ao vivo). Verificado: typecheck/lint/build/62 testes + serving 200
  dos chunks. SEM verificação visual em browser (sem automação) — conferir com `npm run dev`.
- Antes: motor DES + cross-check + fundação espacial + editor 2D React.

## Próximo
1. **Verificação visual** (rodar `npm run dev`): conferir animação do painel 2D e legibilidade/
   proporções da vista 3D — único passo sem cobertura automática.
2. **Casca por-projeto** no motor (resolver dívida abaixo) p/ destravar plantas ≠ Loja 206; o 3D
   já é por-projeto (lê `room.polygon`), só o motor de simulação ainda usa casca fixa.
3. **Animar agentes no 3D** (clientes/operadores dos `frame`s) — unir 3D + simulação.

## Dívida do port (validar com o dono antes de mudar)
- **Contagem dupla served × balkedPickup:** se o cliente abandona a retirada (timeout) mas um
  operador já pegou a tarefa, ele ainda "entrega" e conta `served++` (além de `balkedPickup++`).
  Logo served+balked pode passar de `arrived` (~69 num dia base, seed 42). É FIEL ao
  `sim-core.js` (mesma lógica em `delivering`). Decisão pendente: manter (fidelidade) ou
  cancelar a tarefa no abandono.

## Nota: por que NÃO bate exatamente com o Python (resolvido — cross-check passou)
- Motor TS = DES espacial (A*, layout, pão, 3 itens, 12h). Python = pipeline SimPy (4 itens,
  480min, balking por estimativa de fila). MODELOS diferentes → validação estatística/direcional.
- Golden Python validado em 2026-06-14 (20 réplicas, rate 120/h, 8h, 2 ops): servidos 110,3±5,3 ·
  atend. 11,5%±0,9 · throughput 13,8/h±0,7 · receita R$6948±137. Em `PYTHON_GOLDEN` (replicas.ts).
- Para reproduzir o golden: `cd prototype/python-simulator && python3 -c "from src.simulation
  import AllAnticopaninoEnv; print(AllAnticopaninoEnv(2,2.0,480,SEED).run())"` (simpy 4.1.1).

## Dívidas do editor (refinar depois)
- Paridade visual conferida lado a lado com o protótipo (paredes grossas, cotas, FOH/BOH,
  entrada empilhada). OK para o nível atual.
- Clamp usa bbox da casca, não o polígono em L (peça pode entrar no recorte ausente).
- Falta: undo/redo, "+ Criar" equipamento custom + "Meus modelos", ferramenta Parede/Divisor
  como desenho por arraste (hoje inserem peça), render especial de porta/painel (hatch/folga),
  acabamentos (piso/parede), botões Operação/Ver 3D (navegação p/ módulos ainda não portados).
- Zonas watermark ("COZINHA"/"02 · PREPARO") são aproximação; conferir textos do protótipo.
- UI single-project; falta seletor de projetos (multi-projeto já no domínio/storage).
- **Casca do motor ainda hardcoded** (Loja 206 em `sim/geometry.ts`): o `adapter` converte os
  itens da cena, mas o motor ignora `room.polygon` (usa `inShell` fixo). Cenas com geometria
  diferente da Loja 206 não navegam certo ainda — tornar a casca por-projeto é trabalho futuro.

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
