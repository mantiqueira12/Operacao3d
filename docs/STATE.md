# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-14.

## Agora
- **Planta 2D nível arquiteto + correção da "parede grossa".** Commits `5871449`, `8c9e04d`, `1ce957f`.
  - **Bug relatado (parede grossa com objeto "por cima"):** a parede da sala era um stroke de 15px
    non-scaling CENTRADO no contorno interno → metade entrava na sala e cobria peças encostadas. Virou
    **poché de espessura real (0,12 m) POR FORA do polígono** (face interna = limite da sala). Também
    corrigidas **2 sobreposições reais do template** Loja 206 (forno×estoque, montagem×painel) → cena
    padrão valida "✓ Sem sobreposições".
  - **5 recursos de arquiteto (via contrato de API, 3 agentes):** (1) camada de **circulação** colorida
    por largura; (2) **zonas de trabalho/segurança** translúcidas (work 0,90 / hot do forno 0,40 / porta
    0,60); (3) **snap inteligente + guias de alinhamento** ao mover/redimensionar; (4) **cotas peça↔vizinho/
    parede** + **giro NBR 9050 Ø1,50 m** ao selecionar; (5) **painel de Conformidade** (CVS 5/2013 +
    NBR 9050 + NR-13/NBR 14518) com normas citadas e itens clicáveis. + botão **"Restaurar cena padrão"**.
  - Lógica pura e testada em `domain/spatial.ts` (corridorAnalysis, workZones, dimsToNeighbors,
    complianceChecks; thresholds `CIRC_*`/`TURN_CIRCLE`/`CORRIDOR_FLOOR` exportados p/ calibração).
    **125 testes** (+22), build verde, smoke de runtime OK. Achados reais p/ Loja 206: ~10 passagens
    estreitas <0,60 m, forno sem afastamento, giro FOH Ø1,30<1,50.
  - Calibração: vãos <0,20 m = adjacência (não viram alarme falso de corredor); textos em pt-BR (vírgula).
- **Rodada 4 — catálogo & ferramentas + polish do pente-fino — integrada e verde** (typecheck/103
  testes/build + smoke de runtime: planner/modal/3D montam sem erro). Commit `656cb15`.
  - **Editor — a dimensão "Catálogo & ferramentas" (única intocada):** modal **Criar equipamento**
    (`editor/EquipmentModal.tsx`) + **Meus modelos** (`editor/customModels.ts`, StorageAdapter em
    namespace dedicado `operacao3d-models`); **Parede/Divisor por ARRASTE** (draft + cota viva);
    **ferramenta Medir** completa; **undo/redo** (Ctrl+Z/Y, pilha de 80 na UI — `useScene` intocado);
    cores de acento por peça (`catalog.ts` aditivo); cursores por ferramenta; carimbo editável; barra de
    ocupação animada; grade pontilhada; `@media print`; confirm em ações destrutivas; modal blur/fechar-fora.
  - **Operação 2D:** banner de alerta (pão esgotado), toast de sync da planta, métricas por limiar em
    vermelho, transição do re-layout do KDS, switches animados.
  - **3D:** piso em dupla camada (laje + acabamento) + calçada 3D; sombras PCFSoft afinadas; porta de
    correr/folha; orientação dos avatares.
  - **Identidade global:** favicon + título da aba, user-select:none (inputs livres), responsividade,
    scrollbar custom, focus-ring vermelho, fontes confirmadas.
- **O que REALMENTE falta agora** (não são mais "regressões visuais", são FEATURES não portadas do
  protótipo — exigem telas novas, não só CSS/SVG): abas do painel direito (Análise/Cardápio/Vendas),
  visualização de **fluxo de produção do cardápio**, **viabilidade da padaria** (cartões + pipeline),
  UI de **Monte Carlo** com progresso, "seguir pedido" (clicar ticket do KDS → foca operador no 2D).
  Polish menor restante: atalhos de teclado completos do editor (hoje só Ctrl+Z/Y/Esc); conferência 1:1
  dos marcadores de cota da casca. **E a validação visual do dono em browser real** (`cd app && npm run dev`).
- **Rodada 3 de paridade visual — integrada e verde** (typecheck/103 testes/build + smoke de runtime).
  Commit `9cba058`.
  - **OPERAÇÃO 3D COM AGENTES ANIMADOS** (une 3D + simulação DES — era o "Próximo #3"): `makePerson`
    (boneco articulado + avental vermelho) em `props3d`; `Scene3D` ganha camada de avatares atualizada
    por frame (operadores/clientes, food box, cor por estado), rótulos HTML (FIXO/tag/status) e trilhas;
    `View3D` ganha modo "▸ Operação 3D" (play/pause/reset, toggles Rótulos/Trilhas) via `useSimWorker`.
    `App.tsx` intocado. → 3d-sem-pessoas-animadas, 3d-labels-operadores, 3d-trilhas-operadores.
  - **operação 2D**: heatmap de circulação (overlay derivado no cliente), zoom/pan + auto-fit, dock KDS
    escuro, relógio grande mono, play com estado, velocidade segmentada, chips de cenário, toggles de
    camada. → heatmap-circulacao, zoom-pan-autofit, monitor-kds-dock, relogio-grande-mono,
    play-estado-pausado, controles-velocidade-botoes, chips-cenario, toggles-camadas.
  - **planner**: readout vivo (cursor + peça) e miniescala corrigida + chrome premium. →
    readout-cursor-vivo-e-info-peca, miniscale-barra-escala-fixa.
  - **PENTE-FINO rodou** (não tinha rodado): +41 itens novos no backlog (micro-interações, hover/cursor,
    ferramenta Medir, marcadores de cota, impressão, fontes, modais, interações do KDS, cardápio/padaria).
    Ver `docs/BACKLOG-PARIDADE-VISUAL.md` › "Pente-fino — itens adicionais".
- **PENDENTE (próxima rodada):** os 41 itens do pente-fino + a dimensão **Catálogo & ferramentas** original
  (criar equipamento custom / Meus modelos, Parede/Divisor por arraste, acabamentos do editor 2D, undo/redo);
  alguns itens de chrome de identidade ainda em planner/sim-panel. Falta a **conferência visual em browser
  real** das 3 rodadas (`cd app && npm run dev`).
- **Rodada 2 de paridade visual — 4 frentes em paralelo, integradas e verdes** (typecheck/103 testes/
  build + smoke de runtime: 2D/3D/Operação montam sem erro). Commit `5da10a1`.
  - **view3d** (`Scene3D`/`View3D`/`props3d`): piso texturizado (porcelanato/granilite/cimento) +
    parede (panna/branco/oliva) com seletor; portão de enrolar 3D; wall-culling dollhouse; presets de
    câmera (iso/topo/cliente/balcão); fog + grade como toggles. → itens 3d-piso-textura-e-acabamentos,
    3d-portao-enrolar, 3d-wall-culling-camera, 3d-camera-presets, 3d-iluminacao-fog, 3d-grid-helper-extra.
  - **operação** (`SimView` + ADITIVO em `sim/types.ts`/`worker-core.ts`: `tArr`,`orderNum`,`busyState`,
    `unreachable`,`fixedEq`): casca grossa em L + portão; zonas FOH/BOH/galeria; grade 0,5 m; estações
    como cartão c/ nome real; slots fila/retirada; ponto de serviço; cor de impaciência do cliente;
    anel/status/tag do operador; trilhas (overlay no cliente). **Motor DES intocado.** → casca-parede-
    grossa-l, zonas-foh-boh-rotuladas, planta-grade-05m, estacoes-rotulo-nome, estacoes-cartao-branco,
    estacao-ponto-servico, slots-fila-pickup-marcadores, cliente-cor-por-espera, cliente-anel-stroke-
    opacidade, operador-anel-busy-wait, operador-status-flutuante, operador-tag-rotulo, trilhas-operadores,
    toggles-camadas, cliente-numero-pedido, operador-badge-fixo (conferir os 2 últimos no render).
  - **editor-2d** (`SceneLayers`/`DoorSwing`/`icons`): painel divisor c/ hachura + porta de correr;
    paredes grossas (15/miter); rótulos (portão, 01·COZINHA); setas de entrada; porta 2D c/ batente +
    rótulo; glyphs porta/painel. → painel-divisor-hachura-e-porta-correr, paredes-grossas-espessura-e-
    cantos, rotulo-portao-de-enrolar, setas-entrada-cliente-chevrons, numeracao-zonas-01-cozinha,
    porta-2d-batente-e-rotulo, glyph-catalogo-porta-e-painel.
  - **identidade** (`index.css`/`App`): fontes Bitter/Manrope/IBM Plex Mono + tokens de cor/tipo/
    sombra/raio do protótipo como fundação (sem quebrar tokens existentes).
- **PENDENTE (pararam no limite de sessão — próxima rodada):** heatmap-circulacao, zoom-pan-autofit,
  monitor-kds-dock, chips-cenario; chrome do `SimPanel` (relogio-grande-mono, play-estado-pausado,
  controles-velocidade-botoes); `Planner.tsx` (readout-cursor-vivo, miniscale); 3D com agentes animados
  (3d-sem-pessoas-animadas, 3d-labels-operadores, 3d-trilhas-operadores — une 3D+simulação); 17 itens de
  chrome de identidade; dimensão "Catálogo & ferramentas" inteira; e o **pente-fino de completude** (não
  rodou). Falta também a **conferência visual em browser real** (o preview headless não pinta WebGL/SVG
  animado contínuo) — `cd app && npm run dev`.
- **Fábrica de props 3D — fim do "tudo um blocos".** `app/src/view3d/props3d.ts`: port dos 18 builders
  paramétricos do protótipo (`props.js`) + texturas procedurais (aço/madeira/pedra) + biblioteca de
  materiais + painel divisor detalhado (`buildPanel3D`: ripas, faixa rossa, logo, porta de correr).
  `Scene3D.itemObject` agora chama `buildProp(it.type, …)` (cada peça vira modelo: geladeira 5 malhas,
  vitrine 9, forno 13, bibite 25, painel 20…) e cai na caixa genérica só p/ tipos sem builder. Removido
  o skip de porta/extintor no 3D; colisão vira envelope translúcido (não muta materiais em cache).
  Itens do backlog `3d-props-builders-perdidos`, `3d-texturas-materiais-procedurais`,
  `3d-painel-divisor-detalhado`, `3d-porta-extintor-pulados` = **[x]**. Verificado: typecheck/lint/build/
  **103 testes** verdes; `buildProp` confirmado em runtime (contagem de malhas por tipo). Falta a
  conferência visual do render num browser real (preview headless não pinta WebGL contínuo).
- **Fix (Windows/macOS): colisão de casing `DoorSwing.tsx` × `doorSwing.ts`.** Renomeado o módulo de
  geometria p/ `doorSwingGeometry.ts` (era irresolvível em FS case-insensitive — quebrava typecheck/build
  fora do Linux). CI Linux seguia verde; dev local em Windows estava travado.
- **Paridade visual auditada → `docs/BACKLOG-PARIDADE-VISUAL.md`.** Pente-fino do que o port React
  deixou para trás da camada gráfica do protótipo: **91 itens** (13 de 3D + 78 de
  2D/Operação/Identidade/Catálogo), cada um com ref `arquivo:linha`, severidade visual e esforço (P/M/G).
  Achado-chave: o **3D virou caixas lisas** (`Scene3D.itemMesh` faz `BoxGeometry` para tudo; os 18 builders
  de `props.js` se perderam) e a Operação perdeu **heatmap/trilhas/cores de impaciência**. Estratégia:
  portar os visuais **POR CIMA** da arquitetura (não reverter motor DES/domínio/testes). Ver "Plano
  sequenciado" no backlog. (Audit automático parou no limite de sessão; 3D + síntese completados à mão.)
- **Travar no "L", swing de porta e impressão da prancha.** (A) `clampToPolygon` (`spatial.ts`) prende
  o arraste de peças sólidas ao polígono — não dá mais para soltar no recorte do "L"; porta/extintor
  seguem a bbox (encostam na parede). (B) `doorSwing.ts` + `DoorSwing.tsx` desenham o arco de abertura
  da porta (raio = folha, 90° p/ dentro), com botão "Inverter abertura" (`doorFlip` em `Item`). (C)
  `PrintExtras.tsx` + `print.css`: ao imprimir saem a planta (pág. 1) + a folha de handoff (carimbo,
  lista de equipamentos, legendas de zonas/circulação/instalações). **+8 testes (103 no total);**
  typecheck/lint/build verdes, serving 200. A por mim; B e C por agentes isolados (worktree), integrados
  e revisados.
- **Entregáveis para a execução — fora-da-casca, lista de equipamentos e instalações.**
  (1) `outOfBoundsSet`/`footprintInside`/`pointInPolygon` em `spatial.ts` sinalizam peça fora do
  polígono (âmbar tracejado + badge + linha na Validação). (2) `domain/schedule.ts`
  (`equipmentSchedule` agrupa idênticas, `scheduleToCSV`) + `editor/Schedule.tsx` — modal "Lista"
  na topbar: tabela por zona, totais e **Exportar CSV** (com BOM, abre certo no Excel). (3) Catálogo
  ganhou `utils` por tipo (elétrica/hidráulica/esgoto/gás/exaustão) + `UTILITY_META`; marcadores
  coloridos por peça numa camada "Instalações" (toggle) + legenda. **+13 testes (95 no total);**
  typecheck/lint/build verdes, serving 200. A Lista foi construída por agente isolado (worktree),
  integrada e revisada. Publicado na `main` (deploy automático).
- **Ferramenta de arquitetura — níveis, colisão e folgas** (`app/src/domain/spatial.ts`, puro+testado).
  Cada peça ganhou `level` (elevação-base z, m) → ocupa a faixa vertical `[level, level+height]`:
  empilhar / prateleira sem falso conflito. `collisionSet`/`collisionPairs` (sobreposição
  plano ∩ altura) destacam em vermelho (hachura+badge+banner) e alimentam o painel **Validação**
  (lista de conflitos clicável) — "sinaliza mas permite". `clearances()` desenha as cotas de
  circulação da peça selecionada p/ vizinho/parede nas 4 direções, graduadas (vermelho <0,60 ·
  laranja <0,90 · verde ≥0,90 m), ignorando obstáculos em outro nível — port + melhoria do
  `drawClearances` do protótipo, agora por-polígono (L), não hardcoded. UI no Planner: campo z +
  presets (Piso/Bancada/Prateleira/Alto) + "Empilhar sobre o de baixo". 3D eleva peças por `level`
  e tinge conflitos; header 3D mostra contagem de sobreposições. **+20 testes (82 no total).**
  typecheck/lint/build/82 testes + serving HTTP 200. SEM verificação visual em browser.
- **Motor DES espacial completo e validado** em `app/src/sim/` (port canônico de `sim-core.js`).
  Cadeia: `geometry`/`nav` (casca L + A*) → `engine.ts` (`SimEngine`: demanda Poisson+curva,
  ciclo do cliente, FSM atendente volante/fixo + padeiro BOH, pão, P&L, `tick`/`computeKPIs`)
  → `worker-core.ts`+`worker.ts` (Web Worker: protocolo `init|run|step|reset|snapshot` →
  `ready|kpis|frame|done|error`, laço ao vivo play/pause). `runReplicas` (Monte Carlo, IC95) e
  `adapter.ts` (`RestaurantScene` do editor → `SceneItem[]`). **62 testes** nesta cadeia.
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
0. **PRIORIDADE — Paridade visual:** executar `docs/BACKLOG-PARIDADE-VISUAL.md` na ordem do "Plano
   sequenciado" (começar pela **fábrica de props 3D** — maior ganho, risco isolado em `view3d/`). Só
   camada de apresentação; verificação visual em `npm run dev` com antes/depois.
1. **Verificação visual** (rodar `npm run dev`): conferir as camadas/recursos novos — colisão,
   fora-da-casca (âmbar), folgas ao selecionar, níveis/empilhamento, Instalações, modal "Lista"
   (CSV), **arraste travando no "L"**, **swing de porta** (+ Inverter abertura) e **impressão**
   (Ctrl+P → planta + folha de lista/legendas). Único passo sem cobertura automática.
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
- Arraste agora **trava dentro do polígono em "L"** (`clampToPolygon`, peças sólidas); o "fora-da-casca"
  segue como rede de segurança (dados importados, redimensionamento). Ainda prendem só à bbox: o
  **resize** (handles) e o **duplicar** — refinar para o polígono depois.
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
- 2026-06-14: Arraste trava no polígono (`clampToPolygon`, sólidos); swing de porta = geometria pura
  + camada SVG (`doorFlip` inverte a dobradiça); impressão = planta + folha de lista/legendas (só print).
- 2026-06-14: Entregáveis p/ execução: detecção fora-da-casca (sinaliza, não trava), lista de
  equipamentos com Exportar CSV, e pontos de instalação por equipamento (camada própria).
- 2026-06-14: Deploy publica o app React (`app/dist`) no GitHub Pages só em push na `main` (ci.yml).
- 2026-06-14: Níveis = elevação-base `z` livre (m) + presets; colisão volumétrica (plano ∩ altura),
  permitindo empilhamento/prateleira sem falso conflito.
- 2026-06-14: Colisão "sinaliza mas permite" (vermelho + painel Validação), não bloqueia o arraste.
- 2026-06-13: Stack-alvo = React + Vite + TypeScript (Svelte como alternativa).
- 2026-06-13: Simulação canônica em TS no cliente; Python = golden reference.
- 2026-06-13: Persistência via StorageAdapter (localStorage → nuvem free tier).
- 2026-06-13: `prototype/` é referência v0; não é a base final.

## Não fazer ainda
- Backend pago / infra de nuvem (manter custo-0 no MVP).
- Auth, multi-tenancy, billing (depois do editor + simulação portados).
- Apagar `prototype/` (é a fonte da verdade funcional durante a migração).
