# Backlog de Paridade Visual — Operacao3d (protótipo → port React)

> **Fila de trabalho viva.** Catálogo do que a reescrita React (`app/`) deixou para trás da camada gráfica do
> protótipo (`prototype/planner/`). Companheiro de `docs/STATE.md` e `docs/AGENTS.md`. Gerado em 2026-06-14.
> Cada item tem **ID estável**, severidade visual, esforço (P/M/G) e referência `arquivo:linha` no protótipo.

## Contexto (por que existe este backlog)

A reescrita em **React + Vite + TypeScript** avançou a engenharia — TS tipado, 103 testes, motor DES validado
contra o Python, níveis/colisão, swing de porta, impressão da prancha e exportação CSV. Mas **regrediu a camada
gráfica** que estava ficando excelente no protótipo. O caso mais grave é o **3D**: cada equipamento tinha um
modelo dedicado (geladeira com puxadores, vitrine com vidro inclinado e bandejas, forno de dois decks, estufa com
visor, balcão com tampo de pedra e monitor de PDV…) e virou uma **caixa lisa** — daí o *"tudo um blocos"*. A tela
de Operação perdeu heatmap, trilhas, as cores de impaciência da fila e os rótulos de status; o 2D perdeu hachuras
de painel, paredes grossas e rótulos; e a identidade visual premium ficou achatada.

**Estratégia (inegociável):** trazer os visuais de volta **POR CIMA** da arquitetura nova — *portar pixels, não
reverter código.* Nada de mexer em `domain/`, `sim/` (motor DES), testes ou `storage/`. Só a camada de
apresentação: `view3d/`, `editor/*.tsx`+css, `sim-ui/`.

## Como usar (handoff entre agentes)

1. Pegue um item pela ordem do **Plano sequenciado** (abaixo). Marque-o `[~]` (em progresso) editando este arquivo.
2. Implemente **só na camada de apresentação**. Verifique no navegador (`cd app && npm run dev`) — o `STATE.md`
   registra que a verificação visual nunca foi feita; tire **antes/depois**.
3. Ao concluir: marque `[x]`, e some **uma linha** em `docs/STATE.md` › "Agora" citando o **ID** do item.
   (Mantém a regra do projeto: estado mora no `STATE.md`, não no chat.)
4. Não passou na verificação adversarial automática (o workflow bateu no limite de sessão). As refs `arquivo:linha`
   foram conferidas, mas **confirme** antes de refactors grandes.

### Personas sugeridas por épico (ver `docs/AGENTS.md`)

- **3D & Operação viva** → #16 Three.js/WebGL · #18 Artista Técnico 3D · #21 Cientista de Operações/DES.
- **2D Planner** → #11 Comp. Gráfica 2D · #12 Geometria Computacional · #15 Cotagem Automática.
- **Identidade/Chrome** → #42 Design System · #41 UX Sênior.
- **Catálogo & ferramentas** → #13 Parametria/CAD · #31 Equipamentos de Foodservice.

## Resumo

Total de itens: **91**.

| Dimensão | Crít. | Alto | Médio | Baixo | Total |
|---|--:|--:|--:|--:|--:|
| 3D & Props (geometria/materiais) | 2 | 4 | 5 | 2 | 13 |
| Tela de Operação / Simulação | 2 | 11 | 15 | 10 | 38 |
| Identidade visual / Design system | 1 | 5 | 6 | 7 | 19 |
| 2D Planner (fidelidade visual) | 1 | 1 | 4 | 4 | 10 |
| Catálogo & ferramentas do editor | 1 | 4 | 4 | 2 | 11 |
| **Total** | **7** | **25** | **34** | **25** | **91** |

## Plano sequenciado (ordem recomendada)

Máximo ganho visual com mínimo risco aos avanços de engenharia. Cada fase é isolável e verificável.

1. **Fábrica de props 3D** (`3d-props-builders-perdidos` + `3d-texturas-materiais-procedurais` + `3d-painel-divisor-detalhado` + `3d-porta-extintor-pulados`). Devolve ~80% da sensação "real" do 3D. Risco isolado em `view3d/`.
2. **Casca & ambiente 3D** (`3d-piso-textura-e-acabamentos`, `3d-portao-enrolar`, `3d-wall-culling-camera`, `3d-camera-presets`, `3d-iluminacao-fog`, `3d-grid-helper-extra`). Completa o cômodo.
3. **Operação viva 2D** — cores de impaciência da fila, status flutuante do operador, anel busy/wait, estações como cartão, trilhas e heatmap como overlays no cliente, toggles de camada, monitor KDS. Devolve a narrativa da simulação. (Exige expor poucos campos a mais no snapshot do worker — sem tocar na lógica do motor.)
4. **3D + Simulação (avatares animados)** (`3d-sem-pessoas-animadas`, `3d-labels-operadores`, `3d-trilhas-operadores`). Une os dois mundos — STATE.md "Próximo #3".
5. **Identidade visual / chrome premium** — tokens, tipografia (Bitter/Manrope/IBM Plex Mono), topbar, rails, modais, badges. Maior parte é CSS migrável do protótipo.
6. **2D Planner — fidelidade** — painel com hachura + porta de correr, paredes grossas, rótulos (portão/zonas), readout vivo, glyphs do catálogo.
7. **Catálogo & ferramentas** — criar equipamento custom / "Meus modelos", Parede/Divisor por arraste, acabamentos, e os itens restantes.

### Estratégia de integração por camada

- **3D:** criar `app/src/view3d/props3d.ts` — fábrica `buildProp(type, w, d, h): THREE.Group` espelhando `props.js`
  (texturas procedurais + materiais em cache + os 18 builders). `Scene3D.itemMesh` chama a fábrica por `it.type`,
  com fallback para a `BoxGeometry` atual. Avatares: nova vista 3D consome os `frame`s do worker (`useSimWorker`) e
  posiciona `makePerson`. **Não** alterar `domain/`/`sim/`.
- **Operação 2D:** heatmap e trilhas como **overlays derivados no cliente** (acumular posições dos frames no React —
  a decisão de não poluir o motor DES continua válida). Cores por estado/impaciência: expor `tArr`/`waitRatio`,
  `busyState`, `statusText`, `carrying`, `orderNum`, `fixedEq` no snapshot do worker; o cálculo de cor fica no view.
- **2D / Identidade:** a maior parte é **CSS + SVG declarativo** — migrar tokens e regras do `planner.css`/`operacao.css`
  do protótipo para os CSS do app e reemitir os elementos SVG que sumiram (hachuras, rótulos, paredes grossas).

## Riscos

- **Performance 3D** com muitos meshes detalhados — materiais em cache (props.js já faz) e, se cair o FPS, instancing/LOD (persona #19).
- **Casca hardcoded do motor** (dívida do STATE.md): os avatares 3D dependem de alimentar a vista com frames; cenas ≠ Loja 206 ainda não navegam certo.
- **Colisão de CSS** ao reintroduzir estilos do protótipo — fazer via tokens compartilhados, não cópia cega.
- **Itens sem verificação adversarial automática** (limite de sessão) — refs conferidas, mas validar antes de grandes refactors.

---

## Itens por dimensão

### 3D & Props (geometria/materiais)  ·  13 itens

- [ ] **`3d-props-builders-perdidos`** — Modelos 3D por-equipamento (18 builders) → tudo virou caixa — `CRÍTICO` · esf. G · _simplificado_
  - **Sintoma:** O ESTE é o "tudo um blocos": geladeira, vitrine, forno, balcão, caixa, estufa, batedeira, estoque — todos aparecem como caixas lisas idênticas, sem puxadores, vidro, bandejas, decks, monitor de PDV, prateleiras. A cena 3D perde toda a leitura de "que equipamento é esse".
  - **Protótipo:** props.js:84-296 (window.PROPS: geladeira, bibite, vitrine, batedeira, estufa, forno, balcao, caixa, prep, montagem, pia, estoque, apoio, lixeira, extintor, porta, wall) chamados em sim-3d.js:142-143
  - **React hoje:** app/src/view3d/Scene3D.tsx:71-84 (itemMesh: SEMPRE BoxGeometry + archMaterial; só 5 arquétipos de material)
  - **Restaurar:** Criar app/src/view3d/props3d.ts: uma fábrica buildProp(type, w, d, h): THREE.Group que espelha os 18 builders de props.js (mesma geometria/proporções), com a biblioteca de materiais e texturas procedurais. itemMesh passa a chamar buildProp(it.type, ...) e cai na box genérica só para tipos desconhecidos. Mantém arch como fallback. Não mexe no domínio (só garantir que it.type chega ao 3D).
- [ ] **`3d-sem-pessoas-animadas`** — Avatares 3D animados (operadores/clientes) — 3D não tem gente — `CRÍTICO` · esf. G · _ausente_
  - **Sintoma:** A vista 3D é um cômodo vazio: não há operadores nem clientes andando, nem o avental vermelho do atendente, nem o boneco carregando comida. O "ver a operação em 3D" não existe.
  - **Protótipo:** sim-3d.js:68-80 (makePerson: pernas/torso/braços/cabeça/cabelo/avental), :198-286 (buildOpAvatars, custAvatar, syncAgents anima por frame, rotação no sentido do movimento, food box ao carregar)
  - **React hoje:** app/src/view3d/Scene3D.tsx (nenhum avatar; a vista 3D é estática, só layout). Operação só existe em 2D (sim-ui/SimView.tsx).
  - **Restaurar:** Criar uma vista 3D da operação que consome os frames do worker (já existem em sim-ui/useSimWorker) e posiciona avatares makePerson num agentGroup, animando posição/rotação por frame e o boneco "carrying". Une o STATE.md "Próximo #3" (animar agentes no 3D). Motor DES intacto; só consumo dos frames no view.
- [ ] **`3d-texturas-materiais-procedurais`** — Texturas procedurais (aço/madeira/pedra) + biblioteca de materiais Phong — `ALTO` · esf. M · _ausente_
  - **Sintoma:** Superfícies são cores chapadas: inox não parece inox, madeira não tem veio, pedra não tem granito, vidro de visor não "brilha". Reforça o aspecto de maquete de blocos.
  - **Protótipo:** props.js:10-57 (steelTex/woodTex/stoneTex via CanvasTexture; materiais steel, steelDark, black, wood, stone, rosso, glass, glowGlass, screen, shelf)
  - **React hoje:** app/src/view3d/Scene3D.tsx:56-69 (archMaterial: 5 MeshStandardMaterial de cor chapada, sem mapa/textura)
  - **Restaurar:** Portar as texturas procedurais (canvas) e o cache de materiais de props.js para props3d.ts. Usar MeshStandardMaterial com map+metalness/roughness equivalentes (ou MeshPhong como no protótipo). Materiais em cache (1x), reaproveitados por todos os meshes.
- [ ] **`3d-painel-divisor-detalhado`** — Painel divisor 3D detalhado (ripas, faixa rossa, logo, porta de correr) — `ALTO` · esf. M · _simplificado_
  - **Sintoma:** O painel de fundo FOH/BOH — peça de marca, com o logo All'Antico — vira um bloco bege liso. Perde-se o elemento mais "assinatura" do espaço.
  - **Protótipo:** sim-3d.js:156-196 (buildPanel3D: ripas de madeira em tons alternados, faixa vermelha com textura-logo "All'Antico Panino" em canvas, recuo+folha+trilho da porta de correr)
  - **React hoje:** app/src/view3d/Scene3D.tsx:71-84 (painel cai em itemMesh → box com material "panel"; sem ripas, faixa, logo ou porta)
  - **Restaurar:** Portar buildPanel3D para props3d.ts (caso type==="painel"): ripas, faixa rossa, plano com CanvasTexture do logo, e o conjunto recuo/folha/trilho quando largura>=1,10 m.
- [ ] **`3d-piso-textura-e-acabamentos`** — Piso texturizado + sistema de acabamentos (piso/parede, persistido) — `ALTO` · esf. M · _ausente_
  - **Sintoma:** O piso é um plano de cor única, sem porcelanato/granilite, e não há como trocar acabamento de piso/parede para avaliar o espaço — recurso que existia e ajudava a "vender" o ambiente.
  - **Protótipo:** sim-3d.js:19-65 (makeFloorTex porcelanato/granilite/cimento; WALL_FIN panna/branco/oliva; applyFinishes/setFinish persistem em loja206_fin_v2; UI #fin3d)
  - **React hoje:** app/src/view3d/Scene3D.tsx:21-32 (floorMesh: MeshStandard cor #efe9db chapada; paredes cor fixa; sem acabamentos)
  - **Restaurar:** Portar makeFloorTex e o seletor de acabamentos para o app (estado React + persistência via StorageAdapter, não localStorage cru). Aplicar map no piso e cor nas paredes. Painel de acabamentos como UI React.
- [ ] **`3d-porta-extintor-pulados`** — Porta e extintor são pulados no 3D — `ALTO` · esf. M · _ausente_
  - **Sintoma:** A porta e o extintor simplesmente somem na vista 3D, deixando vãos/ausências estranhas. A porta, que tem folha aberta detalhada no protótipo, não aparece.
  - **Protótipo:** props.js:276-292 (B.extintor: cilindro rosso+gatilho; B.porta: marco+folha aberta com maçaneta)
  - **React hoje:** app/src/view3d/Scene3D.tsx:198 (if (it.type === 'porta' || it.type === 'extintor') return — não renderiza)
  - **Restaurar:** Remover o early-return e renderizar via buildProp (B.porta/B.extintor portados). A porta usa a geometria de folha aberta; pode reusar o ângulo de doorSwing já existente no domínio.
- [ ] **`3d-portao-enrolar`** — Portão de enrolar 3D (caixa + trilhos) na frente — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** A frente da loja não tem o portão de enrolar recolhido (caixa no alto + trilhos laterais) — perde-se a leitura de fachada comercial.
  - **Protótipo:** sim-3d.js:118-125 (housing + 2 rails MeshPhong, na linha do GATE)
  - **React hoje:** app/src/view3d/Scene3D.tsx:34-53 (wallsGroup: frente vira só "vidro"; sem caixa/trilhos do portão)
  - **Restaurar:** Adicionar em wallsGroup (ou num builder de casca) a caixa do portão e os dois trilhos na posição do gate, derivados de room.polygon/frontMaxY.
- [ ] **`3d-wall-culling-camera`** — Wall-culling: esconder paredes viradas para a câmera — `MÉDIO` · esf. M · _regredido_
  - **Sintoma:** Ao orbitar, as paredes da frente tapam a cena ou ficam translúcidas de forma grosseira; não há o efeito limpo de "dollhouse" em que só as paredes do fundo aparecem.
  - **Protótipo:** sim-3d.js:298-305 (cullWalls: por frame, esconde a parede cuja normal aponta para a câmera) chamado em updateCamera
  - **React hoje:** app/src/view3d/Scene3D.tsx:34-53,196 (sem culling; usa um toggle manual "paredes translúcidas" de opacidade 0.18)
  - **Restaurar:** Calcular a normal de cada parede e, no loop de render, esconder as que estão entre câmera e interior (como cullWalls). Mantém o toggle translúcido como alternativa.
- [ ] **`3d-camera-presets`** — Presets de câmera (iso / topo / cliente / balcão) — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** Não há atalhos de ponto de vista (planta isométrica, topo, olho do cliente, atrás do balcão) — o usuário precisa orbitar na mão toda vez.
  - **Protótipo:** sim-3d.js:332-338 (preset: iso/top/cliente/balcao com target/theta/phi/radius próprios)
  - **React hoje:** app/src/view3d/Scene3D.tsx:121-129 (só OrbitControls com posição inicial fixa; sem presets)
  - **Restaurar:** Botões de preset em View3D que setam target/posição da câmera (animação opcional via controls.target + camera.position). Lógica 100% no view.
- [ ] **`3d-labels-operadores`** — Rótulos HTML dos operadores no 3D (FIXO/tag/status, cor por estado) — `MÉDIO` · esf. M · _ausente_
  - **Sintoma:** Mesmo com avatares, não se sabe quem é quem nem o que cada operador faz; some a narrativa que o 2D/3D do protótipo dava.
  - **Protótipo:** sim-3d.js:223-246 (project + syncLabels: "FIXO · O1 · <status>", classe busy/wait, ancorado na cabeça)
  - **React hoje:** app/src/view3d/Scene3D.tsx (nenhum overlay de rótulo)
  - **Restaurar:** Overlay HTML (CSS2D-like): projetar a posição do operador e posicionar um <div> com tag/status e cor por busyState. Depende de 3d-sem-pessoas-animadas.
- [ ] **`3d-trilhas-operadores`** — Trilhas (rastros) 3D dos operadores — `MÉDIO` · esf. M · _ausente_
  - **Sintoma:** Não se vê o caminho percorrido pelos operadores no 3D — perde-se a evidência de circulação excessiva (layout ruim) também no 3D.
  - **Protótipo:** sim-3d.js:248-258 (syncTrails: THREE.Line por op.trail, cor do operador, opacidade 0.5; toggle)
  - **React hoje:** app/src/view3d/Scene3D.tsx (sem trilhas 3D)
  - **Restaurar:** Acumular as últimas N posições por operador (a partir dos frames) e desenhar THREE.Line; toggle de camada. Sem mudança no motor.
- [ ] **`3d-iluminacao-fog`** — Iluminação quente + neblina (profundidade) — `BAIXO` · esf. P · _regredido_
  - **Sintoma:** A cena tem luz mais "fria/plana" e sem neblina de fundo, perdendo a sensação acolhedora/premium do protótipo.
  - **Protótipo:** sim-3d.js:357-373 (background+Fog 14..32; HemisphereLight+Ambient+DirectionalLight sol 0xfff4e0 quente, sombras PCFSoft)
  - **React hoje:** app/src/view3d/Scene3D.tsx:118-143 (sem fog; Hemisphere + 2 Directional brancas frias)
  - **Restaurar:** Adicionar THREE.Fog e aproximar a temperatura/intensidade das luzes (sol levemente quente). Ajuste de parâmetros, sem custo.
- [ ] **`3d-grid-helper-extra`** — GridHelper genérico no 3D (não existe no protótipo) — `BAIXO` · esf. P · _regredido_
  - **Sintoma:** A grade quadriculada sobre o piso reforça o ar de "editor técnico/maquete" em vez de ambiente acabado.
  - **Protótipo:** sim-3d.js (sem grid no 3D — piso texturizado já dá a escala)
  - **React hoje:** app/src/view3d/Scene3D.tsx:193-195 (GridHelper 12x48 sobreposto ao piso)
  - **Restaurar:** Tornar o grid opcional (toggle, default off) quando o piso texturizado entrar; ou remover. Decisão de produto — manter como item de polish.

### Tela de Operação / Simulação  ·  38 itens

- [ ] **`monitor-kds-dock`** — Monitor KDS — dock escuro inferior sobre a planta (chrome + relógio + métricas) — `CRÍTICO` · esf. G · _ausente_
  - **Sintoma:** Some inteiramente o painel 'cockpit' escuro da operação ao vivo (relógio grande, fase do dia, métricas rápidas, colunas FOH/BOH/alertas). Era o elemento mais impactante da tela de operação.
  - **Protótipo:** operacao.html:134-158 + operacao.css:147-208 (kds-dock #15140F, kt-clock, kt-metrics, colapsar) ; sim-ui.js:339-357 renderMonitor
  - **React hoje:** nenhum (sem KDS/monitor em app/src)
  - **Restaurar:** Construir um componente KdsDock (dock absoluto sobre o stage, tema escuro) consumindo o Frame + KPIs + activeOrders + alerts já existentes no engine. Layout em 3 colunas. Puro React/CSS por cima do motor; não muda DES.
  - **Depende de:** expor activeOrders e alerts no estado do worker/hook
- [ ] **`monitor-kds-tickets-foh`** — Tickets FOH animados no KDS (pedido, fase, barra de SLA, atendente, atraso) — `CRÍTICO` · esf. M · _ausente_
  - **Sintoma:** Não há a fila de tickets ao vivo (estilo cozinha) com barrinha de prazo mudando de cor e marca de atraso. A pulsação da operação em tempo real desaparece.
  - **Protótipo:** sim-ui.js:358-378 (km-orders: #num, fase PREPARO/ENTREGA/FILA, barra ratio por SLA, cor verde/amarelo/vermelho, classe 'late') ; operacao.css:175-189
  - **React hoje:** nenhum
  - **Restaurar:** Renderizar os cards de ticket a partir de engine.activeOrders (já contém num, phase, items, opIdx, startTime, status). Cor/barra por (simTime-startTime)/SLA computada no view. Expor activeOrders ao componente.
  - **Depende de:** expor activeOrders no hook do worker
- [ ] **`casca-parede-grossa-l`** — Casca em L com parede grossa preta (10px) e divisa tracejada — `ALTO` · esf. M · _regredido_
  - **Sintoma:** A loja é um contorno fininho cinza em vez da parede arquitetônica espessa preta com a frente aberta (portão). Perde-se a leitura de 'parede vs. abertura' e o rótulo do portão de enrolar de 2,60 m.
  - **Protótipo:** sim-2d.js:117-124 (path 'open' com stroke #1A1A1A width 10 stroke-linejoin miter; linha da divisa tracejada 7 5; rótulo 'portão de enrolar · 2,60 m')
  - **React hoje:** app/src/sim-ui/SimView.tsx:41 (polygon .sim-shell com stroke-width 0.05) ; sim-panel.css:53
  - **Restaurar:** Trocar o polygon fechado por um path aberto que representa só as paredes (frente aberta), com stroke escuro espesso e stroke-linejoin miter (usar vector-effect non-scaling-stroke para manter espessura no zoom). Adicionar a linha da divisa tracejada e o <text> 's2-dim' do portão. Mantém viewBox em metros; só geometria/CSS.
  - **Depende de:** scene.room (W, D, cutX, cutY, gate)
- [ ] **`estacoes-rotulo-nome`** — Rótulo da estação com NOME real (não o type cru) e wrap em 2 linhas — `ALTO` · esf. P · _regredido_
  - **Sintoma:** Cada estação mostra o tipo técnico em minúsculas ('montagem', 'forno', 'geladeira') em vez do nome legível ('Bancada de montagem'). Nomes longos vazam da caixa, sem quebra de linha.
  - **Protótipo:** sim-2d.js:138-144 (label usa it.n||it.t, wrapLabel em até 2 linhas, font-size adaptativo, classe s2-lab) ; cabeçalho colorido topo sim-2d.js:137
  - **React hoje:** app/src/sim-ui/SimView.tsx:54-57 (mostra st.type cru, ex.: 'montagem', fontSize fixo 0.16)
  - **Restaurar:** Usar st.name (já existe em StationSnapshot) em vez de st.type; portar wrapLabel (quebra em até 2 linhas a ~14 chars) e o font-size adaptativo. Adicionar a faixa colorida (4px) no topo do retângulo da estação usando st.color. Tudo no SimView, dados já presentes.
  - **Depende de:** StationSnapshot.name + color (já disponíveis)
- [ ] **`cliente-cor-por-espera`** — Cor do cliente em fila por tempo de espera (verde→amarelo→vermelho) — `ALTO` · esf. M · _regredido_
  - **Sintoma:** Clientes na fila têm sempre a mesma cor; não dá pra ver quem está prestes a desistir. Perde-se a leitura instantânea de pressão da fila (o verde/amarelo/vermelho de paciência) que é o coração da visualização.
  - **Protótipo:** sim-2d.js:211-222 (ratio=(simTime-tArr)/tol → #1F8A5B/#D29922/#E2000F; estados at_pdv, waiting_pickup com gradiente azul→laranja, leaving served vs não-served)
  - **React hoje:** app/src/sim-ui/SimView.tsx:9-15,62-64 (CUST_COLOR fixo por estado: waiting sempre azul, sem gradiente de impaciência)
  - **Restaurar:** Calcular a cor no SimView a partir de campos por-cliente. Requer adicionar ao FrameCustomer o tempo de chegada (tArr) ou um 'waitRatio' já computado no snapshot (e tSS/served para pickup/leaving). Manter a lógica de cor no view (domínio puro intacto). É a maior alavanca visual de todas.
  - **Depende de:** expor tArr/waitRatio (+ tSS, served) no FrameCustomer
- [ ] **`operador-anel-busy-wait`** — Anel de status do operador (amarelo=busy, vermelho=wait) em volta do disco — `ALTO` · esf. M · _ausente_
  - **Sintoma:** Operadores são discos lisos; não dá pra ver quem está ocupado (amarelo) ou bloqueado esperando uma estação fixa (vermelho). Some o sinal visual de gargalo de pessoal no próprio mapa.
  - **Protótipo:** sim-2d.js:231-235 (ring = busyState busy→#D29922, wait→#E2000F, senão op.color; circle r15 + anel r19)
  - **React hoje:** app/src/sim-ui/SimView.tsx:67-74 (só um circle r0.17, sem anel de estado)
  - **Restaurar:** Adicionar 'busyState' ao FrameOperator no snapshot (engine já calcula op.busyState; hoje só 'bstate' é exposto). Renderizar um anel externo cuja cor vem de busyState. Lógica de cor no view; 1 campo a mais no snapshot.
  - **Depende de:** expor op.busyState no FrameOperator (snapshot)
- [ ] **`operador-status-flutuante`** — Status flutuante do operador (texto 'O1 · <ação>' acima do disco) — `ALTO` · esf. P · _ausente_
  - **Sintoma:** Não se vê o que cada operador está fazendo agora ('Batedeira 60%', 'Levando #12', 'Aguardando forno'). O mapa perde a narrativa ao vivo da operação — vira pontos andando sem contexto.
  - **Protótipo:** sim-2d.js:244-247 (texto 'O'+(i+1)+' · '+op.statusText, classe s2-status com halo branco via paint-order stroke)
  - **React hoje:** app/src/sim-ui/SimView.tsx (ausente — statusText vem no Frame, não é desenhado)
  - **Restaurar:** Renderizar <text> acima do operador com 'O{idx+1} · {statusText}', usando paint-order:stroke com halo branco (classe s2-status). statusText JÁ vem no FrameOperator. Só JSX/CSS.
  - **Depende de:** FrameOperator.statusText (já disponível)
- [ ] **`trilhas-operadores`** — Trilhas (rastros) de circulação dos operadores — `ALTO` · esf. M · _ausente_
  - **Sintoma:** Sem rastro, não se enxerga o padrão de circulação/idas-e-vindas dos operadores — exatamente o que evidencia layout ruim (caminhada excessiva). É um dos diferenciais visuais do protótipo.
  - **Protótipo:** sim-2d.js:201-208 (path por op.trail com stroke op.color opacity 0.4; toggle showTrails) ; sim-ui.js:99 bindToggle sw-trails
  - **React hoje:** app/src/sim/engine.ts:9 (comentário: trilhas removidas de propósito); nenhum render React
  - **Restaurar:** Restaurar como CAMADA DE OVERLAY puramente do cliente: acumular as últimas N posições de cada operador no componente React (a partir dos frames recebidos, sem tocar no motor DES) e desenhar polylines com op.color/opacity. Respeita a arquitetura (motor não precisa emitir trail). Adicionar toggle de camada. STATE.md removeu por serem 'só visuais' — aqui o requisito é justamente preservar o visual.
  - **Depende de:** histórico de frames no cliente (sem mudança no motor)
- [ ] **`heatmap-circulacao`** — Heatmap de densidade de circulação — `ALTO` · esf. G · _ausente_
  - **Sintoma:** Não existe a sobreposição quente/fria que mostra onde a operação se concentra e congestiona. A análise espacial de gargalo de circulação (principal apelo de uma 'ferramenta de arquitetura') desaparece.
  - **Protótipo:** sim-2d.js:176-193 (renderHeat: células px(cell), cor laranja→vermelho por intensidade) ; toggle sw-heat sim-ui.js:100 ; loop renderHeat a cada 30 frames sim-ui.js:245
  - **React hoje:** app/src/sim/engine.ts:9 (removido de propósito); nenhum render React
  - **Restaurar:** Restaurar como overlay derivado no cliente: acumular um grid de ocupação a partir das posições dos agentes nos frames (no React, não no motor), normalizar e pintar células com a rampa laranja→vermelho. Toggle de camada. Mantém o motor DES intacto (decisão de não alimentar o motor com isto continua válida — o cálculo vive no view).
  - **Depende de:** acumulador de grid no cliente (sem mudança no motor)
- [ ] **`monitor-kds-pipeline-boh`** — Pipeline BOH da padaria no KDS (batedeira/estufa/forno com barras + estoque) — `ALTO` · esf. M · _regredido_
  - **Sintoma:** A produção de pão é mostrada só como quatro números; não há o pipeline visual com etapas, barras de progresso e estado (livre/ocupado/ausente) que mostram a fábrica trabalhando.
  - **Protótipo:** sim-ui.js:380-396 (km-boh: barra de estoque/cap, status do padeiro, tags batedeira/estufa/forno) ; pipeline detalhado sim-ui.js:818-841
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:161-169 (4 KPIs estáticos de pão; sem pipeline visual/barras)
  - **Restaurar:** Construir o pipeline de 3 células (batedeira/estufa/forno) + barra de estoque, lendo bread()/breadKPIs() e o status do padeiro (statusText do operador padeiro, já no Frame). Componente React; dados já no engine.
  - **Depende de:** expor batches/breadKPIs e statusText do padeiro ao componente
- [ ] **`monitor-kds-alertas`** — Central de alertas no KDS (feed cronológico com severidade colorida) — `ALTO` · esf. M · _ausente_
  - **Sintoma:** Os alertas da operação (pão esgotado, abandono na retirada, operador sobrecarregado) são gerados pelo motor mas nunca aparecem — o usuário não vê nenhuma ocorrência.
  - **Protótipo:** sim-ui.js:401-411 renderAlerts (CRÍTICO/ATENÇÃO/INFO, tag colorida, hora) ; operacao.css:200-207
  - **React hoje:** nenhum (engine.alerts() existe, mas nenhuma UI consome)
  - **Restaurar:** Renderizar um feed a partir de engine.alerts() (id, t, sev, msg já existem) com tags coloridas por severidade. Expor alerts ao hook; componente React puro.
  - **Depende de:** expor alerts() no estado do worker/hook
- [ ] **`sparkline-throughput`** — Sparkline de throughput ao longo do dia — `ALTO` · esf. M · _ausente_
  - **Sintoma:** Não há o mini-gráfico de evolução do ritmo de atendimento durante o dia — só números pontuais. Perde-se a leitura de tendência (acelerando/desacelerando).
  - **Protótipo:** sim-ui.js:319-337 renderSpark (polyline de taxa servida, janela 30, área preenchida, valor atual) ; operacao.css:257
  - **React hoje:** nenhum (S.servedHist existe no engine, não é plotado)
  - **Restaurar:** Renderizar um SVG sparkline a partir de S.servedHist (já mantido no engine, exposto via KPIs ou snapshot). Cálculo de taxa por janela no view. Componente React puro.
  - **Depende de:** expor servedHist nos KPIs/estado
- [ ] **`abas-painel-direito`** — Abas do painel direito (KPIs / Equipe / Cliente / Cardápio / Padaria / Análise) — `ALTO` · esf. G · _regredido_
  - **Sintoma:** Todo o conteúdo do painel direito virou uma lista vertical enfileirada (o 'tudo em blocos' literal), perdendo a navegação por abas e as telas inteiras de Cardápio, Cliente (mix/curva) e Análise (diagnóstico/fluxo/vendas/gargalos).
  - **Protótipo:** operacao.html:163-170 + operacao.css:238-246 ; sim-ui.js:187-198 (troca de pane)
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:104-187 (rail única empilhada: Parâmetros/Clientes/Financeiro/Padaria/Utilização; sem abas, sem Cardápio/Cliente/Análise)
  - **Restaurar:** Reintroduzir a navegação por abas no painel direito e portar os panes ausentes (Cardápio, Cliente, Análise) reusando os dados do engine (computeKPIs, flowDistances, itemsSold, recommendations já existem). Estrutura/UI; lógica de domínio já presente no motor.
  - **Depende de:** panes Cardápio/Cliente/Análise consumindo APIs já existentes no engine
- [ ] **`planta-grade-05m`** — Grade de referência de 0,5 m no piso da loja — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** O piso da loja é um retângulo branco vazio, sem a malha métrica que dá noção de escala e leitura de planta arquitetônica. A cena parece um desenho abstrato, não uma planta.
  - **Protótipo:** sim-2d.js:106-109 (clipPath no piso + linhas verticais/horizontais a cada 0,5m, stroke #EFE9DA, vector-effect non-scaling-stroke)
  - **React hoje:** app/src/sim-ui/SimView.tsx (nenhum; só desenha shell/sidewalk/gate)
  - **Restaurar:** Adicionar no SVG estático do SimView um <g> com clip na casca em L e linhas a cada 0,5m em x e y até a divisa (GATE), stroke var(--line)/#EFE9DA, vector-effect=non-scaling-stroke. Dados de W/D/cutX/cutY já vêm em scene.room. Puramente declarativo em JSX, sem tocar no motor.
  - **Depende de:** scene.room (já disponível)
- [ ] **`zonas-foh-boh-rotuladas`** — Zonas FOH/BOH sombreadas e rotuladas — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** Não há distinção visual entre fundo (produção/padaria) e frente (atendimento). O conceito central 'BOH estoca, FOH consome, não cruzam a divisa' some da tela.
  - **Protótipo:** sim-2d.js:111-116 (retângulo rgba(154,146,132,0.06) na zona BOH + textos 'BOH · PRODUÇÃO' e 'FOH · ATENDIMENTO' classe s2-zone)
  - **React hoje:** app/src/sim-ui/SimView.tsx (ausente)
  - **Restaurar:** Desenhar o polígono da zona BOH (canto sup. esquerdo até cutX/cutY) com fill rgba(154,146,132,0.06) e dois <text> com a classe s2-zone (mono, fill var(--muted), letter-spacing .18em). Geometria derivável de scene.room. Só JSX/CSS.
  - **Depende de:** scene.room
- [ ] **`estacoes-cartao-branco`** — Estação como cartão branco com borda + faixa colorida no topo — `MÉDIO` · esf. P · _regredido_
  - **Sintoma:** Estações são manchas coloridas semitransparentes sem moldura, em vez de cartões brancos nítidos com uma faixa de cor identificando o tipo. Parecem 'borrões', reforçando a sensação de 'tudo um bloco'.
  - **Protótipo:** sim-2d.js:136-137 (rect fill #fff stroke #1A1A1A 1.2 rx3 + rect 4px de cor no topo)
  - **React hoje:** app/src/sim-ui/SimView.tsx:54 + sim-panel.css:55 (.sim-station fill direto na cor com fill-opacity 0.5, stroke fininho)
  - **Restaurar:** Renderizar a estação como rect branco com stroke escuro (non-scaling-stroke) e um rect fino (4px equivalente em metros) de st.color no topo, em vez de preencher tudo com a cor translúcida. Só SimView/CSS.
  - **Depende de:** StationSnapshot.color
- [ ] **`estacao-ponto-servico`** — Pontos de serviço das estações (círculo pontilhado) e marca de 'sem acesso' — `MÉDIO` · esf. M · _ausente_
  - **Sintoma:** Não se vê onde o operador para para usar cada estação, nem o alerta visual vermelho quando uma estação ficou inacessível (sem circulação na planta). O feedback de erro de layout some do mapa.
  - **Protótipo:** sim-2d.js:147-159 (círculo r3.2 da cor da estação no st.sp; se unreachable: círculo r13 tracejado vermelho + texto 'sem acesso')
  - **React hoje:** app/src/sim-ui/SimView.tsx (ausente — st.sp existe no snapshot mas não é desenhado)
  - **Restaurar:** Desenhar um pequeno círculo pontilhado no st.sp (já no SceneSnapshot via s.sp). Para unreachable, adicionar campo 'unreachable' ao StationSnapshot (existe internamente — engine usa em nav/missingTypes) e renderizar o anel tracejado vermelho + label. Pequena adição ao snapshot + JSX.
  - **Depende de:** StationSnapshot.sp (presente) + expor unreachable no snapshot
- [ ] **`slots-fila-pickup-marcadores`** — Marcadores de slots de fila (quadrados vermelhos tracejados) e retirada (círculos azuis) — `MÉDIO` · esf. P · _regredido_
  - **Sintoma:** Os pontos de fila e retirada são pontinhos minúsculos quase invisíveis, sem os marcadores quadrados/redondos rotulados que mostram a estrutura da fila e da zona de retirada na calçada.
  - **Protótipo:** sim-2d.js:162-173 (queueSlots: rect 18x18 rx3 fill rgba(226,0,15,.05) dash; pickupSlots: rect 16x16 rx8 azul; rótulos 'fila / PDV' e 'retirada')
  - **React hoje:** app/src/sim-ui/SimView.tsx:44-49 (círculos r=0.05 quase invisíveis, opacity 0.18/0.2, sem rótulos)
  - **Restaurar:** Renderizar queueSlots como pequenos quadrados arredondados vermelhos tracejados e pickupSlots como círculos azuis, em escala de metros, com dois <text> 's2-dim' ('fila / PDV', 'retirada'). Dados já em scene.queueSlots/pickupSlots.
  - **Depende de:** scene.queueSlots / pickupSlots (já disponíveis)
- [ ] **`operador-balao-carga`** — Balão de carga (carrying) — retângulo marrom sobre o operador — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** Não se vê quando um operador está carregando algo (massa, pão, lanche para entrega). O fluxo de 'pegar→levar→entregar' fica invisível, e o mapa parece estático.
  - **Protótipo:** sim-2d.js:237-239 (se op.carrying: rect 13x9 fill #C0763A stroke #7c4a1d)
  - **React hoje:** app/src/sim-ui/SimView.tsx (ausente — carrying vem no Frame mas não é usado)
  - **Restaurar:** Renderizar um pequeno retângulo marrom ao lado do disco quando frame.operator.carrying != null. Campo carrying JÁ está no FrameOperator. Puro JSX no SimView.
  - **Depende de:** FrameOperator.carrying (já disponível)
- [ ] **`zona-fila-destacada`** — Realce da zona da fila quando longa (verde/amarelo/vermelho) — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** Quando a fila cresce, não há nenhum realce de área na calçada sinalizando 'fila longa demais'. Perde-se o alerta espacial de saturação da fila.
  - **Protótipo:** sim-2d.js:249-258 (rect de fundo sobre a calçada, cor por tamanho da fila: >10 vermelho, >5 amarelo, senão verde)
  - **React hoje:** app/src/sim-ui/SimView.tsx (ausente)
  - **Restaurar:** Desenhar um rect translúcido sobre a faixa da calçada cuja cor depende de frame.waitQueue (>10/>5/else). waitQueue JÁ vem no Frame e os slots em scene. Só JSX.
  - **Depende de:** Frame.waitQueue + scene.queueSlots (já disponíveis)
- [ ] **`zoom-pan-autofit`** — Zoom/pan por ponteiro + auto-fit do conteúdo — `MÉDIO` · esf. M · _ausente_
  - **Sintoma:** Não dá para dar zoom/arrastar a planta para inspecionar detalhes; a vista é fixa e escala tudo junto, então em telas pequenas vira um 'bloco' minúsculo sem como ampliar.
  - **Protótipo:** sim-2d.js:23-36 (fit/applyView) + 261-285 (bindInteraction: drag pan, wheel zoom com foco no cursor)
  - **React hoje:** app/src/sim-ui/SimView.tsx:35 (viewBox fixo + preserveAspectRatio; sem interação) ; sim-panel.css:54
  - **Restaurar:** Implementar pan/zoom no SVG do SimView via state (transform num <g> mundo) com handlers de pointer/wheel (foco no cursor) e um fit inicial sobre o bounding box do conteúdo. Lógica de view 100% no componente; não toca no motor.
  - **Depende de:** nenhum
- [ ] **`toggles-camadas`** — Toggles de camada (Trilhas / Heatmap / Rótulos) estilo switch — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** Não há como ligar/desligar trilhas, heatmap ou rótulos. Como essas camadas nem existem no port, o painel de controle visual está vazio.
  - **Protótipo:** operacao.html:84-91 + operacao.css:97-105 (.sw/.toggle) ; sim-ui.js:92-101
  - **React hoje:** nenhum
  - **Restaurar:** Adicionar a seção 'Camadas' com três switches CSS controlando estados booleanos que alimentam os overlays (trilhas/heatmap dos itens acima) e a visibilidade dos rótulos das estações. Só UI/estado.
  - **Depende de:** itens trilhas-operadores e heatmap-circulacao
- [ ] **`banner-alerta-canvas`** — Banner de alerta pulsante sobre o canvas (pão esgotado / geladeira vazia) — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** Quando o pão acaba ou a geladeira esvazia, não há o aviso vermelho pulsante sobre o mapa. O problema crítico passa despercebido durante a animação.
  - **Protótipo:** sim-ui.js:305-316 updateOpBanner + operacao.css:140-145 (op-banner rosso com animação opbanner)
  - **React hoje:** nenhum
  - **Restaurar:** Adicionar um banner absoluto sobre o stage que aparece quando há condição crítica (waitingBread>0 ou bebidas zeradas), com animação de pulso. Condições deriváveis de breadKPIs()/invKPIs() do engine. Só JSX/CSS.
  - **Depende de:** expor flag de pão-esgotado/estoque ao componente
- [ ] **`curva-demanda-preview`** — Prévia da curva de demanda ao longo do dia — `MÉDIO` · esf. G · _ausente_
  - **Sintoma:** Ao escolher demanda, não há o gráfico mostrando o perfil do dia (pico de almoço/jantar). O usuário ajusta às cegas.
  - **Protótipo:** sim-ui.js:661-682 demandMult/renderCurvePreview (polyline da demanda 10h-22h, pico anotado) ; operacao.css:343
  - **React hoje:** nenhum (app usa rate fixo, sem demandCurve nem prévia)
  - **Restaurar:** Adicionar campo demandCurve ao SimConfig do app e portar demandMult + o SVG de prévia. Tanto a curva quanto o gráfico vivem no domínio/ view; checar se o engine aplica a curva (hoje o app parece usar rate constante).
  - **Depende de:** demandCurve no SimConfig + aplicação no engine
- [ ] **`gauges-estoque`** — Medidores (gauges) de estoque com marcador de alvo (pão, farinha, bebidas, vitrine) — `MÉDIO` · esf. M · _regredido_
  - **Sintoma:** Estoques aparecem como números soltos, sem a barra com cor por nível (vermelho quando baixo) e o tracinho de alvo. Difícil ver de relance se está faltando.
  - **Protótipo:** sim-ui.js:802-809 gauge() + 843-852/897-905 (barras com cor por nível e tick de alvo) ; operacao.css:370-377
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:161-169 (números puros de pão; sem gauges nem alvo)
  - **Restaurar:** Portar o componente gauge (barra + cor por percentual + marcador de alvo) e aplicá-lo a pão/farinha/bebidas/vitrine usando breadKPIs()/invKPIs() do engine. Componente React; dados já calculados no motor.
  - **Depende de:** expor breadKPIs/invKPIs ao componente
- [ ] **`barras-utilizacao-cor`** — Barras de utilização com cor por faixa e sublinha de detalhe — `MÉDIO` · esf. M · _simplificado_
  - **Sintoma:** As barras de utilização não têm a faixa amarela intermediária nem a linha de detalhe (pedidos, metros andados, fornadas), e não há utilização por ESTAÇÃO — só por operador. Diagnóstico de gargalo empobrecido.
  - **Protótipo:** sim-ui.js:421-451 renderUtil (cor >85 vermelho/>60 amarelo/verde; sub com pedidos/metros/fornadas) ; operacao.css:260-266
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:171-186 + sim-panel.css:89-93 (barras só verde/vermelho em 85%, sem faixa amarela nem sublinha de detalhe; só operadores, sem estações)
  - **Restaurar:** Adicionar a faixa amarela (>60), a sublinha de detalhe por operador (opOrders/opDist do engine) e um bloco de utilização por estação (eqBusy/eqCount já no engine). Só UI; dados já calculados.
  - **Depende de:** expor opOrders/opDist/eqBusy/eqCount nos KPIs
- [ ] **`modais-relatorio-comparar-mc`** — Modais de Relatório do dia / Comparar cenários / Monte Carlo — `MÉDIO` · esf. G · _ausente_
  - **Sintoma:** Ao terminar o dia não aparece o relatório com KPIs grandes e recomendações; não há comparação de cenários nem Monte Carlo visual. Os resultados ricos do motor ficam sem apresentação.
  - **Protótipo:** sim-ui.js:972-1120 (openModal, showEod com eod-kpi/recos, comparar, Monte Carlo 5×) ; operacao.css:314-334
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:77-79 ('Dia rápido' roda runFull mas sem modal de relatório/recomendações; sem comparar/MC)
  - **Restaurar:** Construir um modal de fim de dia (grid de KPIs + recomendações via engine.recommendations/computeKPIs) e, depois, comparar/MC. Replicas/Monte Carlo já existem no engine (replicas.ts). Componentes React; reusa o motor.
  - **Depende de:** engine.computeKPIs/recommendations + replicas (já existem)
- [ ] **`tokens-identidade-marca`** — Identidade de marca no chrome (brand Bitter itálico, verbadge, topbar) — `MÉDIO` · esf. P · _regredido_
  - **Sintoma:** A topbar perdeu a marca 'All'Antico Panino' (Bitter itálico com 'Antico' em vermelho), o selo de versão e o subtítulo 'Loja 206 · Operação'. A tela parece um protótipo genérico, não o produto de marca.
  - **Protótipo:** operacao.css:31-34 (.brand Bitter 800 itálico, b rosso; .verbadge 'sim v1'; .topdoc) ; operacao.html:16-19
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:64-67 + sim-panel.css:32 (título genérico 'Operação · simulação DES', sem marca All'Antico, sem verbadge)
  - **Restaurar:** Restaurar o bloco de marca na topbar (fonte Bitter itálica, destaque rosso, verbadge, topdoc). É só chrome/CSS — não conflita com a arquitetura. (Observar a direção GastroBSC/white-label do projeto: manter o branding no chrome, configurável.)
  - **Depende de:** fontes Bitter/Manrope/IBM Plex Mono carregadas no app
- [ ] **`cliente-numero-pedido`** — Número do pedido (#N) sobre o cliente em retirada — `BAIXO` · esf. P · _ausente_
  - **Sintoma:** Clientes esperando retirada não mostram o número do pedido, então não dá para casar o ticket do monitor com a pessoa no mapa (recurso 'seguir pedido' fica sem âncora visual).
  - **Protótipo:** sim-2d.js:225-227 (texto '#'+orderNum quando state waiting_pickup, classe s2-agent)
  - **React hoje:** app/src/sim-ui/SimView.tsx:62-64 (ausente)
  - **Restaurar:** Adicionar orderNum ao FrameCustomer (engine já tem c.orderNum) e renderizar <text> '#N' centrado no cliente em waiting_pickup. Pequena adição ao snapshot + JSX.
  - **Depende de:** expor orderNum no FrameCustomer
- [ ] **`cliente-anel-stroke-opacidade`** — Cliente com anel branco e opacidade reduzida ao sair (leaving) — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** Clientes que já foram atendidos e estão saindo aparecem tão sólidos quanto os ativos, poluindo a cena; e o anel é escuro fino em vez do contorno branco que destaca o agente sobre o piso.
  - **Protótipo:** sim-2d.js:223-224 (circle r12 stroke #fff width1.5, opacity 0.45 se leaving senão 0.9)
  - **React hoje:** app/src/sim-ui/SimView.tsx:63 + sim-panel.css:59 (.sim-cust stroke preto 0.015, sem fade ao sair)
  - **Restaurar:** Aplicar stroke branco e opacity 0.45 quando state==='leaving' (vs 0.9), via style/classe condicional no SimView/CSS. Estado já vem no FrameCustomer.state.
  - **Depende de:** FrameCustomer.state (já disponível)
- [ ] **`operador-tag-rotulo`** — Tag do operador (O1/O2/P) em branco sobre o disco — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** O número do atendente aparece, mas sem a fonte mono/peso e dimensionamento do protótipo; o padeiro é 'P' (ok), mas a leitura é menos consistente. Diferença menor.
  - **Protótipo:** sim-2d.js:236 (texto op.tag||'O'+(i+1), classe s2-agent fill #fff)
  - **React hoje:** app/src/sim-ui/SimView.tsx:70-72 (mostra 'P' p/ padeiro ou idx+1; parcialmente presente)
  - **Restaurar:** Manter o rótulo mas alinhar tipografia à classe s2-agent (mono, bold, fill #fff, baseline central). Usar op.tag se exposto. Apenas CSS/tipografia.
  - **Depende de:** nenhum (FrameOperator.idx/role já bastam)
- [ ] **`operador-badge-fixo`** — Badge 'FIXO' para operador alocado a uma estação fixa — `BAIXO` · esf. P · _ausente_
  - **Sintoma:** Não dá para distinguir no mapa um atendente 'volante' de um alocado fixo numa estação — a configuração de fixo/volante (que existe no domínio) não tem reflexo visual.
  - **Protótipo:** sim-2d.js:240-243 (se op.fixedEq: rect laranja #D2691E + texto 'FIXO')
  - **React hoje:** app/src/sim-ui/SimView.tsx (ausente)
  - **Restaurar:** Expor um booleano isFixed (ou fixedEq) no FrameOperator (engine tem op.fixedEq) e desenhar um badge laranja 'FIXO'. Pequena adição ao snapshot + JSX.
  - **Depende de:** expor fixedEq/isFixed no FrameOperator
- [ ] **`relogio-grande-mono`** — Relógio grande monoespaçado centralizado na rail de controles — `BAIXO` · esf. P · _regredido_
  - **Sintoma:** O relógio da simulação é pequeno e perdido na topbar, em vez do display grande e legível (30px) que ancora os controles de play/velocidade.
  - **Protótipo:** operacao.css:58-59 (.clock font-size 30px mono) ; operacao.html:51 ; fmtClock sim-ui.js:258-261
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:68 + sim-panel.css:34 (.sim-clock 18px na topbar)
  - **Restaurar:** Adicionar um display de relógio grande (mono ~30px) no topo da rail de controles, além do da topbar. Só JSX/CSS; tempo já em sim.frame.simTime.
  - **Depende de:** nenhum
- [ ] **`play-estado-pausado`** — Botão play com estado visual (vermelho 'Iniciar' / escuro 'Pausar') — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** O botão de play não muda de identidade visual ao pausar (fica sempre vermelho) e não há o estado 'Fim do dia' ao chegar às 22h. Feedback de estado mais fraco.
  - **Protótipo:** operacao.css:64-66 (.runbtn.primary rosso; .paused vira escuro) ; sim-ui.js:104-111 (texto Iniciar/Pausar/Fim do dia)
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:71-73 + sim-panel.css:30 (botão play sempre rosso, texto ▸/❚❚, sem estado 'Fim do dia')
  - **Restaurar:** Aplicar classe 'paused' (fundo escuro) quando rodando e detectar fim de dia (simTime>=22*60) trocando rótulo para 'Fim do dia'. Só estado/CSS no SimPanel.
  - **Depende de:** nenhum
- [ ] **`controles-velocidade-botoes`** — Botões de velocidade 1×/5×/15×/60× com atalhos de teclado — `BAIXO` · esf. P · _regredido_
  - **Sintoma:** A velocidade virou um dropdown discreto em vez dos quatro botões segmentados de acesso rápido, e os atalhos (Espaço, R, 1-4) sumiram. Operação fica menos fluida.
  - **Protótipo:** operacao.css:67-71 (.spds/.spd) ; sim-ui.js:121-137 (clique + teclas 1-4, espaço=play, R=reset) ; operacao.html:56-62
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:82-90 (um <select> de velocidade; sem atalhos de teclado)
  - **Restaurar:** Trocar o select por 4 botões segmentados com estado 'on' e adicionar um useEffect com listener de teclado (Espaço/R/1-4) ignorando quando o foco está em input. Só UI/handlers.
  - **Depende de:** nenhum
- [ ] **`chips-cenario`** — Chips de cenário rápido (Vale / Pico almoço / Dia completo) — `BAIXO` · esf. M · _ausente_
  - **Sintoma:** Não há atalhos de cenário; o usuário precisa ajustar a demanda número a número, perdendo as predefinições que tornam a exploração rápida.
  - **Protótipo:** operacao.html:227-231 + sim-ui.js:46-58 (aplica rate/curve por cenário, estado .on)
  - **React hoje:** nenhum (busca por scenario/chip em app/src não acha)
  - **Restaurar:** Adicionar uma fileira de chips que setam rate/curve (estado React) com classe 'on'. O React já tem 'rate'; falta 'demandCurve' no SimConfig do app (ver item curva-demanda). Só UI + um campo de config.
  - **Depende de:** campo demandCurve no SimConfig do app
- [ ] **`grafico-sensibilidade`** — Gráfico de sensibilidade custo/pão × volume (própria × terceirizado) — `BAIXO` · esf. G · _ausente_
  - **Sintoma:** Some o gráfico que mostra a partir de quantos pães/dia produzir compensa vs terceirizar — análise estratégica da padaria sem visual.
  - **Protótipo:** sim-ui.js:879-896 renderSensitivity (duas polylines + ponto de equilíbrio anotado) ; operacao.css:218-220 senleg
  - **React hoje:** nenhum
  - **Restaurar:** Portar o cálculo de sensibilidade (k.sens) e o SVG de duas linhas + legenda + ponto de cruzamento. Depende de expor o cálculo de viabilidade da padaria no app (provavelmente ainda não portado). Componente React.
  - **Depende de:** cálculo de viabilidade/sensibilidade da padaria no app
- [ ] **`hintbar-scenestamp`** — Hintbar de interação e scene-stamp (carimbo da cena) — `BAIXO` · esf. P · _ausente_
  - **Sintoma:** Não há a dica de interação ('arraste: pan · roda: zoom') nem o carimbo no canto com 'X estações · Y peças · ⚠ sem acesso'. O usuário não sabe que pode interagir nem vê o resumo da cena.
  - **Protótipo:** operacao.html:131-132 + operacao.css:135-138 ; sim-ui.js:220-225 updateSceneStamp (nº estações/peças/sem-acesso)
  - **React hoje:** nenhum
  - **Restaurar:** Adicionar uma hintbar (pílula no rodapé do stage) e um scene-stamp (canto sup. esquerdo) com contagem de estações/peças e aviso de inacessível, derivados de scene.stations. Só JSX/CSS.
  - **Depende de:** scene.stations (+ flag unreachable do item estacao-ponto-servico)

### Identidade visual / Design system  ·  19 itens

- [ ] **`kds-dock-monitor-operacao`** — KDS dock escuro (monitor de operação) sobre a planta — `CRÍTICO` · esf. G · _ausente_
  - **Sintoma:** Na tela de Operação não existe o painel escuro de cozinha (KDS) com os cartões de pedidos correndo em colunas FOH/BOH/Alertas, relógio e métricas no topo. O usuário perde toda a sensação de 'cozinha viva' que o protótipo tem; a tela fica só com a planta clara e uma rail genérica.
  - **Protótipo:** prototype/planner/operacao.css:147-208 (#wrapKds, .kds-dock #15140F, .kds-dockhead, .kt-clock, .km-met, .kds-cols 3 colunas FOH/BOH/alertas, .km-tk tickets, .km-tk.late, .tk-bar) + operacao.html:135-161 (markup do dock)
  - **React hoje:** nenhum
  - **Restaurar:** Portar o bloco CSS .kds-dock e filhos (cores #15140F/#1C1B14/#252319, bordas #2E2B20/#34301F, borda-esquerda do ticket, .km-tk.late vermelho, .tk-bar/.tk-ph fases) e montar um componente React <KdsDock> que consome sim.frame (tickets/fila/operadores) já disponíveis no motor DES. Manter o motor/Worker; só renderizar o estado existente nesse chrome escuro.
- [ ] **`fin3d-widget-financeiro-flutuante`** — Widget financeiro 3D flutuante (#fin3d) com chips de cenário — `ALTO` · esf. M · _ausente_
  - **Sintoma:** Falta o cartão de vidro flutuante no canto inferior-direito do palco com os chips de cenário/capacidade. O financeiro hoje aparece só como lista chapada na rail, sem o efeito glass premium nem a flutuação sobre a cena.
  - **Protótipo:** prototype/planner/operacao.css:119-129 (#fin3d glass card, backdrop-filter blur(8px), box-shadow, .finrow/.finlab/.finchips/.fchip/.cdot/.cap-row) + operacao.html:113
  - **React hoje:** nenhum
  - **Restaurar:** Recriar o CSS #fin3d (fundo rgba(255,255,255,.93), backdrop-filter blur(8px), radius 12px, sombra 0 12px 40px) e os filhos .fchip/.cdot/.cap-row; renderizar como overlay absoluto dentro de #sim-stage usando os KPIs financeiros que o SimPanel já calcula (k.revenueNet, margin, avgTicket).
- [ ] **`tabs-rail-direita-operacao`** — Sistema de abas da rail direita (KPIs/Análise/Cardápio/Cliente/Padaria) — `ALTO` · esf. M · _regredido_
  - **Sintoma:** A rail direita da Operação é uma coluna única empilhada (Parâmetros, Clientes, Financeiro, Padaria, Utilização) em vez do conjunto de abas premium do protótipo. Fica tudo amontoado e sem o destaque vermelho da aba ativa.
  - **Protótipo:** prototype/planner/operacao.css:238-247 (.tabs, .tab, .tab.on vermelho com border-bottom, .tabpanes, .pane/.pane.on) + operacao.html:163-164
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:104-187 (rail é uma pilha vertical de .sec, sem abas)
  - **Restaurar:** Introduzir o componente de abas com CSS .tabs/.tab/.tab.on (cor var(--rosso), border-bottom-color vermelho) e .tabpanes/.pane.on, reorganizando os blocos React existentes (que já têm os dados) dentro das abas. Apenas reflow de UI; lógica do worker intacta.
- [ ] **`alr-alertas-coloridos`** — Alertas coloridos por severidade (.alr-r/.alr-g/.alr-b/.alr-y) e cartões de análise (.ana-card) — `ALTO` · esf. G · _ausente_
  - **Sintoma:** Não existe a aba/seção de Análise com alertas coloridos (vermelho/verde/azul/âmbar) nem os cartões de análise com tarja. O diagnóstico da operação (gargalos, recomendações) perde a leitura visual por severidade.
  - **Protótipo:** prototype/planner/operacao.css:279-291 (.alr + variações com border-left colorida e fundo tonal; .ana-card/.ana-title com tarja vermelha; .flow-row)
  - **React hoje:** nenhum
  - **Restaurar:** Portar .alr/.alr-r/g/b/y, .ana-card/.ana-title (tarja ::before vermelha) e .flow-row; popular com os insights/gargalos derivados dos KPIs que o motor já produz. Chrome + composição; nenhum cálculo novo de domínio exigido.
- [ ] **`subpaineis-cardapio-padaria-viabilidade`** — Sub-painéis de Cardápio, Padaria (pipeline/gauges) e Viabilidade — `ALTO` · esf. G · _regredido_
  - **Sintoma:** As abas ricas de Cardápio (itens, receitas, preço), Padaria (pipeline de etapas + gauges de estoque com alvo), Viabilidade (cartões comparativos com veredito) e Mix de pedidos sumiram. Restou apenas um quadradinho de 4 números de pão. A profundidade de simulação visível ao usuário caiu drasticamente.
  - **Protótipo:** prototype/planner/operacao.css:293-413 (.mic/.mi-h cardápio; .pipe/.pipe-st pipeline padaria; .gauge/.gbar estoques; .viab-card/.viab-vs/.viab-verdict viabilidade; .mix-row mix de pedidos; .curvebox; input[type=range] accent vermelho)
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:161-169 (existe só um bloco simples 'Padaria (fundo)' com 4 Stats; sem pipeline visual, gauges, cardápio editável, viabilidade ou mix)
  - **Restaurar:** Portar incrementalmente os blocos CSS (.mic, .pipe/.pipe-st, .gauge/.gbar/.tgt, .viab-*, .mix-row, .curvebox, input[type=range]{accent-color:var(--rosso)}) e ligá-los aos dados já existentes (sim.frame.breadStock, k.bread.*). Onde o domínio React ainda não expõe cardápio/mix, renderizar o chrome com os campos editáveis ligados ao estado do componente — sem reverter o motor DES.
- [ ] **`modal-criar-equipamento-editor`** — Modal Criar/editar equipamento personalizado (editor) — `ALTO` · esf. G · _ausente_
  - **Sintoma:** O botão '+ Criar' no catálogo está morto ('Em breve'). Não há o modal premium para definir equipamento sob medida (nome, dimensões, arquétipo 3D Bloco/Bancada/Geladeira/Prateleira/Painel/Equip.preto, cor de zona, preview). O usuário não consegue criar peças personalizadas.
  - **Protótipo:** prototype/planner/planner.css:205-225 (.modal-back blur, .modal-card radius16 sombra 32px, .modal-head h2 Bitter 20px, .modal-x, .modal-sub, .seg/.segb arquétipos, .swatches.big, .modal-preview) + index.html:173-215
  - **React hoje:** app/src/editor/Planner.tsx:263 (botão '+ Criar' presente porém inerte, title='Em breve')
  - **Restaurar:** Portar o markup/CSS do modal (.modal-back/.modal-card/.modal-head h2 Bitter/.seg/.segb/.swatches.big/.modal-preview/.modal-foot/.pbtn.primary) como componente React, ligando ao CATALOG/addItem existente. Já existe ScheduleModal como referência de overlay React. Sem mexer no domínio além de aceitar o item custom.
- [ ] **`s3-lbl-labels-3d-agentes`** — Labels 3D flutuantes sobre agentes/estações (.s3-lbl) — `MÉDIO` · esf. M · _ausente_
  - **Sintoma:** Na vista 3D da operação não há etiquetas flutuantes (pílulas brancas com borda colorida) marcando estações/operadores ocupados (âmbar) ou em espera (vermelho). Perde-se a leitura rápida de status no espaço 3D.
  - **Protótipo:** prototype/planner/operacao.css:113-118 (#labels3d, .s3-lbl pílula branca com sombra, .s3-lbl.busy âmbar, .s3-lbl.wait vermelho) + operacao.html:112
  - **React hoje:** nenhum
  - **Restaurar:** Portar .s3-lbl/.s3-lbl.busy/.s3-lbl.wait e o container #labels3d (pointer-events:none, overflow:hidden). Posicionar via projeção de coordenadas do Scene3D existente — só a camada de rótulos HTML por cima do canvas Three, sem tocar no render 3D.
- [ ] **`clock-grande-mono-operacao`** — Relógio grande mono central da rail de controle — `MÉDIO` · esf. P · _regredido_
  - **Sintoma:** O relógio da simulação é um número pequeno (18px) na barra de topo em vez do grande mostrador mono de 30px centralizado que ancora o painel de controle no protótipo. A presença/legibilidade do tempo de simulação caiu.
  - **Protótipo:** prototype/planner/operacao.css:58-59 (.clock font 30px mono, letter-spacing .04em, centralizado) + operacao.html:51
  - **React hoje:** app/src/sim-ui/sim-panel.css:34 (.sim-clock 18px na topbar), SimPanel.tsx:68
  - **Restaurar:** Adicionar o estilo .clock (30px, var(--mono), peso 600, centralizado) como mostrador dedicado no topo da rail de controle, alimentado pelo mesmo clock(simMin) já computado. Pode coexistir com o relógio pequeno da topbar.
- [ ] **`runrow-spds-controles-estilizados`** — Controles run/pause e seletor de velocidade estilizados (.runrow/.runbtn/.spds/.spd) — `MÉDIO` · esf. M · _simplificado_
  - **Sintoma:** Play/Pause/Reset e a velocidade usam botões de topbar e um <select> cinza nativo, em vez dos botões grandes em grade e dos chips de velocidade (1×/2×/4×/8×) com estado ativo vermelho do protótipo. Os controles parecem improvisados.
  - **Protótipo:** prototype/planner/operacao.css:60-72 (.runrow grid 1.4fr/1fr, .runbtn hover invertido, .runbtn.primary vermelho, .spds grid 4col, .spd.on vermelho, .kbd-hint) + operacao.html:52-56
  - **React hoje:** app/src/sim-ui/SimPanel.tsx:70-90 (.tbtn.play na topbar + <select> nativo de velocidade), sim-panel.css:30-38
  - **Restaurar:** Portar .runrow/.runbtn/.runbtn.primary(.paused)/.spds/.spd/.spd.on e a dica .kbd-hint; trocar o <select> por chips de velocidade. Reusar os handlers existentes (sim.start(speed)/pause/reset, setSpeed). Só troca de chrome dos controles.
- [ ] **`op-banner-alerta-pulsante`** — Banner de alerta pulsante sobre o canvas (.op-banner) — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** Não há a faixa vermelha pulsante no topo do palco avisando de gargalo/fila crítica. Eventos críticos da simulação passam despercebidos visualmente.
  - **Protótipo:** prototype/planner/operacao.css:140-145 (.op-banner vermelho, box-shadow vermelho, @keyframes opbanner pulsando opacity)
  - **React hoje:** nenhum
  - **Restaurar:** Portar .op-banner + @keyframes opbanner e renderizar condicionalmente (ex.: quando fila/SLA crítico nos KPIs já calculados). Overlay absoluto em #sim-stage; sem mudança no motor.
- [ ] **`mc-cards-metrica-operacao`** — Cartões de métrica (.mc/.mv/.ml) e barras de utilização estilizadas — `MÉDIO` · esf. M · _simplificado_
  - **Sintoma:** Os KPIs aparecem como pares rótulo/valor soltos, sem os cartões delimitados (.mc) com borda e raio do protótipo. As barras de utilização são mais simples. O conjunto parece menos 'painel de instrumentos'.
  - **Protótipo:** prototype/planner/operacao.css:250-266 (.mgrid, .mc card branco com borda, .mv mono 16px, .mv.red/.green, .ml; .util-row/.util-bar/.util-fill/.util-sub)
  - **React hoje:** app/src/sim-ui/sim-panel.css:82-93 (.sim-kpis/.sim-stat e .sim-util-row/.sim-bar — versão própria mais pobre, sem o card .mc com borda/raio)
  - **Restaurar:** Portar .mgrid/.mc/.mv(.red/.green)/.ml e .util-row/.util-bar/.util-fill/.util-sub, aplicando-os aos mesmos dados que o SimPanel já renderiza (k.* e k.opUtilizationPct). Só encapsular os valores existentes nos cards. Semântica de cor (vermelho negativo / verde positivo) deve seguir a regra do projeto.
- [ ] **`eod-modal-fim-de-dia`** — Modal de fim de dia (EOD) com KPIs e recomendações — `MÉDIO` · esf. M · _ausente_
  - **Sintoma:** Ao rodar o 'Dia rápido' não aparece o modal de fechamento do dia com os KPIs grandes, recomendações e tabela comparativa de cenários. O resultado da simulação completa não tem um fecho apresentável.
  - **Protótipo:** prototype/planner/operacao.css:314-334 (.modal-back/.modal-card/.modal-head h2 Bitter/.modal-foot) + 326-334 (.eod-kpi grid 4col, .eod-reco com tarja vermelha, .cmp-table comparativo, .cmp-best verde)
  - **React hoje:** nenhum
  - **Restaurar:** Portar o conjunto de modal da operacao.css (.modal-back/.modal-card/.modal-head/.modal-foot/.eod-kpi/.eod-reco/.cmp-table/.cmp-best) e abri-lo ao término de sim.runFull(), preenchendo com os KPIs do dia já calculados. Reusar a estrutura de modal (o app já tem ScheduleModal como padrão de overlay).
- [ ] **`scene-stamp-carimbo-cena`** — Carimbo de cena (.scene-stamp) no canto do palco — `BAIXO` · esf. P · _ausente_
  - **Sintoma:** Falta o pequeno selo mono no canto superior-esquerdo do palco identificando a cena/loja. Some um detalhe de acabamento técnico.
  - **Protótipo:** prototype/planner/operacao.css:137-138 (.scene-stamp mono, fundo branco translúcido, borda) + operacao.html:132
  - **React hoje:** nenhum
  - **Restaurar:** Portar .scene-stamp e renderizar um <div> absoluto com o nome da unidade (scene.titleBlock.unit) já disponível. Puro chrome.
- [ ] **`hintbar-stamp-operacao`** — Hintbar e legenda da operação com o visual do protótipo — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** O palco da operação tem só a legenda de cores; falta a pílula de dica de navegação (como existe no editor). Consistência menor entre as telas.
  - **Protótipo:** prototype/planner/operacao.css:135-136 (.hintbar pílula branca translúcida com borda var(--line))
  - **React hoje:** app/src/sim-ui/sim-panel.css:63-70 (.sim-legend existe, mas não há hintbar de instrução de navegação no palco)
  - **Restaurar:** Reusar o estilo .hintbar do protótipo no #sim-stage com a dica de pan/zoom/orbitar conforme a vista ativa. Apenas adicionar o elemento.
- [ ] **`toast-feedback`** — Toast de feedback (#toast) — `BAIXO` · esf. P · _ausente_
  - **Sintoma:** Ações como salvar modelo, exportar, importar ou restaurar não dão retorno visual (toast). O usuário fica sem confirmação de que a ação ocorreu.
  - **Protótipo:** prototype/planner/planner.css:238-242 (#toast fundo var(--inch), sombra, transição opacity+translateY, .show)
  - **React hoje:** nenhum
  - **Restaurar:** Portar #toast/#toast.show e um pequeno hook React para disparar a mensagem após ações existentes (exportJSON, importJSON, salvar). Puro chrome de feedback.
- [ ] **`swatches-rotulos-zona-editor`** — Swatches de zona com rótulos/title (Atendimento/Cozinha/Frio…) — `BAIXO` · esf. P · _regredido_
  - **Sintoma:** Os seletores de cor de zona são bolinhas sem rótulo nem tooltip. O usuário não sabe que vermelho=Atendimento, preto=Cozinha, azul=Frio etc. — perde o significado semântico das zonas que o protótipo deixa explícito.
  - **Protótipo:** prototype/planner/planner.css:190-198 (.swatches.big com label de texto branco e .swatch[data-col] por zona) + index.html:110-119/198-206 (title= por swatch)
  - **React hoje:** app/src/editor/Planner.tsx:383-387 + editor/planner.css:81-83 (swatches só como bolinhas de cor, sem title nem variante .big rotulada)
  - **Restaurar:** Adicionar title= em cada swatch (mapa cor→zona) e portar a variante .swatches.big com rótulo de texto para quando houver espaço (ex.: no futuro modal). Apenas atributos/CSS; estado de cor já existe (sel.color).
- [ ] **`verbadge-mono-vs-bold`** — Verbadge (selo de versão) com estilo mono do protótipo — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** Pequena inconsistência: o selo de versão segue a variante do planner; a variante da operação (peso 800, tracking maior) não existe no React porque a tela de operação não tem o selo. Detalhe de marca não propagado para Operação/3D.
  - **Protótipo:** prototype/planner/planner.css:174-175 (.verbadge fundo vermelho, var(--mono) 9px peso 600, radius 5px)
  - **React hoje:** app/src/editor/planner.css:114 (.verbadge presente e fiel) — porém operacao.css:34 define variante 800/letter-spacing que não foi unificada no React
  - **Restaurar:** Ao reconstruir a topbar da Operação/3D, incluir o .verbadge (qualquer das duas variantes, de preferência a mono do planner) para manter o selo de versão consistente entre as três telas.
- [ ] **`clr-text-clearance-classe-regredida`** — Texto de folga/circulação (.clr-t) — estrutura de classe divergente — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** As cotas de folga (vãos/corredores) podem ter pequena diferença de espessura/halo em relação ao protótipo por causa da reorganização de classes. Diferença sutil, não bloqueante.
  - **Protótipo:** prototype/planner/planner.css:254-262 (.clr/.clr-t com .ok/.warn/.bad aplicados na própria linha/texto, stroke var(--panna))
  - **React hoje:** app/src/editor/planner.css:184-191 (reescrito como .clr-l/.clr.ok .clr-l e .clr.ok .clr-t — funciona, mas é uma reorganização; verificar paridade exata de cores/stroke)
  - **Restaurar:** Conferir 1:1 stroke-width (1.1), cor do halo (var(--panna)) e as três cores (#1F8A5B/#C97B00/var(--rosso)) entre .clr-t do protótipo e a versão .clr.* do React; alinhar valores se divergirem. Sem mudar a lógica de cálculo de folga.
- [ ] **`sim-stage-gradiente-vs-grade`** — Fundo do palco da operação — gradiente radial vs. fundo liso/grade — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** O fundo do palco da operação no React usa um gradiente radial próprio, diferente do desk liso do protótipo. Não é feio, mas diverge da linguagem; é uma escolha nova, não portada.
  - **Protótipo:** prototype/planner/operacao.css:107-109 (#canvasWrap background var(--desk), sem grade; planta de operação) — e o editor usa grade pontilhada (planner.css:113-116)
  - **React hoje:** app/src/sim-ui/sim-panel.css:41-48 (#sim-stage radial-gradient #f1ece1→var(--desk))
  - **Restaurar:** Decisão de design: alinhar ao var(--desk) do protótipo (ou manter o gradiente se aprovado). Trivial trocar o background de #sim-stage. Pedir validação ao Rafael antes de mudar, por ser escolha estética.

### 2D Planner (fidelidade visual)  ·  10 itens

- [ ] **`painel-divisor-hachura-e-porta-correr`** — Painel divisor: hachura diagonal + simbologia de porta de correr — `CRÍTICO` · esf. M · _ausente_
  - **Sintoma:** O painel de fundo FOH/BOH aparece como um retângulo bege liso e mudo, sem a textura hachurada nem o desenho da porta de correr (vão + folha aberta + seta de deslizamento). Parece um 'bloco' colado, não um elemento de planta.
  - **Protótipo:** prototype/planner/planner.js:307-335 (drawPanel: panel-rect + loop de panel-hatch a cada 7px + vão panel-gap + folha panel-leaf + seta panel-arr + rótulo 'porta de correr'); CSS prototype/planner/planner.css:234-235,250-252
  - **React hoje:** app/src/editor/SceneLayers.tsx:196-203 (ItemShape desenha só <rect className='panel-rect'>, sem hachura, sem vão/folha/seta/rótulo)
  - **Restaurar:** Em ItemShape (ou num subcomponente Panel) do ramo isPanel, além do panel-rect emitir: (a) o loop de linhas diagonais .panel-hatch (o mesmo for(o=7;o<w+h;o+=7) com x1=max(0,o-h),y1=min(o,h),x2=min(o,w),y2=max(0,o-w)); (b) se len>=1.10, o vão .panel-gap, a folha .panel-leaf, a seta .panel-arr (marker-end url(#ah)) e o <text> 'porta de correr {largura}'. Manter o modelo Item/React e as classes CSS já existentes (planner.css:167-168,250-252 já têm os estilos). Sem tocar no domínio.
- [ ] **`paredes-grossas-espessura-e-cantos`** — Paredes grossas: espessura 15 e cantos miter/square (planta) — `ALTO` · esf. P · _regredido_
  - **Sintoma:** As paredes da casca ficam mais finas e com os cantos arredondados, dando ar de 'caixa desenhada à mão' em vez de planta técnica com paredes cheias e cantos retos.
  - **Protótipo:** prototype/planner/planner.js:204-207 (open path, stroke-width:15, stroke-linejoin:'miter', stroke-linecap:'square')
  - **React hoje:** app/src/editor/SceneLayers.tsx:61-69 (Floor: strokeWidth={11}, strokeLinejoin='round', strokeLinecap='round')
  - **Restaurar:** Em Floor (SceneLayers.tsx:62-68) trocar strokeWidth de 11 para 15 e strokeLinejoin/strokeLinecap de 'round' para 'miter'/'square', igualando o protótipo. Mudança puramente de atributos SVG, sem afetar a derivação do caminho da parede (que pode permanecer).
- [ ] **`rotulo-portao-de-enrolar`** — Rótulo do portão de enrolar na frente — `MÉDIO` · esf. P · _ausente_
  - **Sintoma:** A linha tracejada do portão de enrolar na frente da loja aparece sem o rótulo 'portão de enrolar · 2,60 m', então o usuário não sabe o que aquela linha representa.
  - **Protótipo:** prototype/planner/planner.js:212-213 (<text class='gate-t'> 'portão de enrolar · 2,60 m' em px(1.30), px(5.15)-8)
  - **React hoje:** app/src/editor/SceneLayers.tsx:70-73 (Floor desenha gate-line + 2 gate-post, mas nenhum <text className='gate-t'>)
  - **Restaurar:** Em Floor adicionar <text className='gate-t' x={frontW/2} y={b.maxY*SCALE - 8} fontSize={9.5}>portão de enrolar · {fmt(frontW/SCALE)} m</text>. O CSS .gate-t já existe em planner.css:174. Só falta emitir o elemento.
- [ ] **`setas-entrada-cliente-chevrons`** — Setas de entrada do cliente (chevrons grossos triplos) — `MÉDIO` · esf. P · _regredido_
  - **Sintoma:** As setas de fluxo do cliente abaixo da frente ficam menores/desalinhadas e menos legíveis do que no protótipo; o indicativo de fluxo de entrada perde força visual.
  - **Protótipo:** prototype/planner/planner.js:227-234 (drawZones: 3 chevrons preenchidos .ent-arr em dx -0.45/0/0.45 ancorados em ey=px(5.35))
  - **React hoje:** app/src/editor/SceneLayers.tsx:122-130 (Zones: arrow(dx) em dx -45/0/45px, ancorado em frontY+36 — offset vertical e ancoragem diferentes do protótipo)
  - **Restaurar:** Em Zones igualar o ponto de ancoragem vertical (protótipo ancora em ey=px(5.35) ≈ b.maxY*SCALE+20, React usa frontY+36) e conferir o glyph/offset das 3 setas para que fiquem coladas logo abaixo da frente como no protótipo. Ajuste de coordenadas no SVG, sem mexer no domínio.
- [ ] **`readout-cursor-vivo-e-info-peca`** — Readout: x/y do cursor ao vivo + info por peça arrastada — `MÉDIO` · esf. M · _regredido_
  - **Sintoma:** O readout no canto inferior não acompanha o cursor: passar o mouse pela planta não atualiza x/y, e ao arrastar uma peça não mostra nome/dimensões. Parece um label fixo em vez de uma régua viva.
  - **Protótipo:** prototype/planner/planner.js:668-673 (updateReadoutAt no pointermove mostra x/y do cursor em metros; updateReadoutItem mostra '<b>nome</b> · w×h m' durante arraste)
  - **React hoje:** app/src/editor/Planner.tsx:313-317 (readout só mostra x/y da PEÇA SELECIONADA estático e 'area · escala 1:50'; sem rastreio do cursor nem info da peça sendo movida)
  - **Restaurar:** Em Planner.tsx adicionar estado de cursor atualizado em onMove via toWorld quando não há drag (replicando updateReadoutAt, faixa -0.2..2.8 / -0.2..5.35) e, durante move/resize, exibir nome + fmt(w)×fmt(h) da peça arrastada. Tudo na camada React/SVG, sem tocar no motor/domínio.
- [ ] **`porta-2d-batente-e-rotulo`** — Porta 2D: batente branco preenchido + rótulo 'porta {w}m' — `MÉDIO` · esf. M · _simplificado_
  - **Sintoma:** A porta no 2D aparece só como linhas do arco de abertura, sem o retângulo branco do vão/batente nem o rótulo 'porta 0,80m'. Fica menos legível como porta de planta e não mostra a largura.
  - **Protótipo:** prototype/planner/planner.js:336-348 (drawDoor: <rect fill='#fff' stroke=col> do batente + folha + arco tracejado + <text> 'porta {w}m')
  - **React hoje:** app/src/editor/DoorSwing.tsx:12-38 (desenha só door-leaf fechada, door-leaf open e door-arc; sem retângulo de batente branco, sem cor da zona, sem rótulo 'porta {w}m')
  - **Restaurar:** Em DoorSwing.tsx (ou no ramo type==='porta' de ItemShape) acrescentar o <rect> branco do footprint da porta (fill #fff, stroke = cor da peça/zona, vector-effect non-scaling-stroke) sob o arco, e um <text className='item-dim'> 'porta {fmt(item.width)}m' abaixo. Reaproveita a geometria já calculada por doorSwingGeometry; mantém o swing paramétrico novo (não reverter).
- [ ] **`numeracao-zonas-01-cozinha`** — Numeração das zonas (01 · COZINHA) — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** A watermark da zona da cozinha aparece como 'COZINHA' sem o número de ordem '01 ·', quebrando a consistência com '02 · PREPARO' que ainda tem número.
  - **Protótipo:** prototype/planner/planner.js:225-226 (t1.textContent='01 · COZINHA'; t2.textContent='02 · PREPARO')
  - **React hoje:** app/src/editor/SceneLayers.tsx:126-127 (texto 'COZINHA' sem '01 ·'; '02 · PREPARO' mantém)
  - **Restaurar:** Em Zones trocar o texto da cozinha de 'COZINHA' para '01 · COZINHA' (SceneLayers.tsx:126). Mudança de string apenas.
- [ ] **`glyph-catalogo-porta-e-painel`** — Glyphs do catálogo: porta (swing) e painel (com hachura) — `BAIXO` · esf. P · _regredido_
  - **Sintoma:** No catálogo, o item 'Porta' aparece como um retângulo genérico igual aos outros (sem o ícone de porta com arco), e 'Painel divisor' aparece como barra lisa sem a textura hachurada, dificultando reconhecê-los de relance.
  - **Protótipo:** prototype/planner/planner.js:771-774 (glyph: 'painel' barra bege COM 3 linhas diagonais de hachura; 'porta' desenho de batente+arco; demais rect c/ barra de cor)
  - **React hoje:** app/src/editor/icons.tsx:31-55 (CatalogGlyph: painel/wall = barra bege LISA sem hachura; porta cai no glyph genérico de rect branco com barra colorida, sem desenho de porta)
  - **Restaurar:** Em CatalogGlyph adicionar caso entry.type==='porta' (mini batente + arco tracejado, como o SVG inline do protótipo planner.js:773) e, no caso painel/wall, acrescentar as 3 linhas diagonais de hachura sobre a barra bege (planner.js:772). Componente puramente de apresentação; sem mudança de dados.
- [ ] **`miniscale-barra-escala-fixa`** — Miniescala: barra de 1 m correta independente do zoom — `BAIXO` · esf. P · _regredido_
  - **Sintoma:** A régua de escala (0—1—2 m) no canto inferior direito nem sempre corresponde a 1 metro real na tela em zooms diferentes, então medir 'a olho' pela régua engana.
  - **Protótipo:** prototype/planner/index.html:83-86 + planner.css:129-135 (miniscale com duas barras representando 1 m cada)
  - **React hoje:** app/src/editor/Planner.tsx:319-322 (largura das barras = SCALE * view.zoom = 100*zoom px; a régua só representa 1 m real corretamente em torno de zoom específico e o rótulo '0—1—2 m' fica enganoso em outros zooms)
  - **Restaurar:** Em Planner.tsx garantir que cada barra da miniscale represente exatamente 1 m em px de tela (= SCALE * view.zoom) E que o rótulo bata — ou fixar a barra e recalcular dinamicamente quantos metros ela cobre. Ajuste só no componente React da miniscale, sem afetar a cena.
- [ ] **`cores-acento-por-peca-no-catalogo`** — Cores de acento por peça (madeira/laranja) ao inserir do catálogo — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** Quando o usuário insere uma batedeira ou estufa pelo catálogo, a barra de acento sai preta (cor da categoria) em vez do marrom/laranja que aparece na cena padrão, gerando inconsistência de cor para a mesma peça.
  - **Protótipo:** prototype/planner/planner.js:86-87 (DEFAULT_SCENE: batedeira color '#8A5A2B', estufa '#B5781F' — acento distinto da categoria cozinha #1A1A1A)
  - **React hoje:** app/src/domain/catalog.ts:79-90 + createItem (linha 131): CATALOG aplica sempre CATEGORY_COLORS por categoria; ao inserir batedeira/estufa pelo catálogo a barra de acento vem #1A1A1A, não o marrom/laranja. A cena padrão (templates/loja206.ts:31-32) acerta, mas o catálogo não.
  - **Restaurar:** Acrescentar uma cor de acento por-tipo opcional no RAW do catálogo (ex.: batedeira '#8A5A2B', estufa '#B5781F') usada por createItem quando não houver override, alinhando o insert do catálogo à cena padrão. Mudança de dados em domain/catalog.ts mantendo CATEGORY_COLORS como fallback — não altera arquitetura.

### Catálogo & ferramentas do editor  ·  11 itens

- [ ] **`3d-geometria-detalhada-toda`** — Geometria 3D artesanal por tipo (18 builders) — substituída por caixa única — `CRÍTICO` · esf. G · _regredido_
  - **Sintoma:** No 3D todo equipamento é um bloco retangular liso, indistinguível do vizinho. A geladeira, a vitrine, o forno, a batedeira, a estufa — todos viram a mesma caixa colorida. É literalmente o 'tudo um blocos' relatado.
  - **Protótipo:** props.js:84-297 (objeto B com 18 builders: geladeira, bibite, vitrine, batedeira, estufa, forno, balcao, caixa, prep, montagem, pia, estoque, apoio, lixeira, extintor, porta, wall, painel); consumidos em sim/sim-3d.js:142-143 via window.PROPS[it.t](it.w,it.h,h)
  - **React hoje:** app/src/view3d/Scene3D.tsx:71-84 (itemMesh) — cada item vira UM BoxGeometry(width,height,depth)
  - **Restaurar:** Portar os 18 builders de props.js para TS como um registry tipado (ex. domain/props3d.ts: Record<type, (w,d,h)=>THREE.Group>) e fazer Scene3D.itemMesh() chamar o builder do it.type quando existir, caindo no BoxGeometry só como fallback (igual sim-3d.js:142-149). Manter o BoxGeometry atual apenas para tipos sem builder/custom. Não mexer no domínio puro nem no levelOf/posição já corretos.
  - **Depende de:** Materiais procedurais (mat-procedurais-aco-madeira-pedra-vidro)
- [ ] **`mat-procedurais-aco-madeira-pedra-vidro`** — Materiais e texturas procedurais (aço escovado, madeira, pedra, vidro, glowGlass) — `ALTO` · esf. M · _regredido_
  - **Sintoma:** Superfícies chapadas e sem caráter: inox não parece inox (sem escovado), bancadas não têm veio de madeira nem tampo de pedra, vidros das geladeiras/vitrines não são translúcidos, visores de forno/estufa não têm o brilho âmbar quente. Tudo plástico.
  - **Protótipo:** props.js:11-57 (tex()/steelTex/woodTex/stoneTex + cache mats(): steel, steelDark, black, wood, stone, rosso, rossoDark, glass, glowGlass emissivo âmbar, screen emissivo, shelf, white, rubber)
  - **React hoje:** app/src/view3d/Scene3D.tsx:56-69 (archMaterial) — 5 MeshStandardMaterial lisos por arquétipo, cor chapada, sem textura nem emissivo
  - **Restaurar:** Portar o canvas-texture helper tex() e a paleta mats() de props.js:11-57 para um módulo de materiais Three.js compartilhado pelos builders 3D. Reutilizar nos builders portados. Pode ser lazy/cache como no protótipo. Não usar como material genérico de caixa — eles existem para alimentar a geometria detalhada.
- [ ] **`painel-divisor-ripado-logo-3d`** — Painel divisor 3D detalhado (ripado de madeira + banda rossa + logo 'All'Antico Panino') — `ALTO` · esf. M · _regredido_
  - **Sintoma:** O painel de fundo FOH/BOH — peça de marca, com o ripado e o letreiro 'All'Antico Panino' — aparece no 3D como uma parede bege lisa, sem ripas, sem banda vermelha, sem logo. Perde a identidade visual do espaço.
  - **Protótipo:** sim/sim-3d.js:157-188 (buildPanel3D: ripas alternadas 0xC69A64/0xB98F5C, banda 0xE2000F, CanvasTexture com texto italic 'All\'Antico Panino', vão de porta recuado); versão 2D em planner.js:307-335 (hachura + porta de correr)
  - **React hoje:** app/src/view3d/Scene3D.tsx:197-200 (painel cai no itemMesh genérico → BoxGeometry cor #EDE7D7)
  - **Restaurar:** Portar buildPanel3D (sim-3d.js:157-188) como builder do tipo 'painel' no registry 3D, incluindo o CanvasTexture do logo. Manter a posição/dimensão calculada pelo domínio. É o equivalente 3D do drawPanel 2D que já existe no React (SceneLayers só desenha rect simples para painel/wall).
  - **Depende de:** Geometria 3D artesanal (3d-geometria-detalhada-toda)
- [ ] **`modal-criar-equipamento`** — Modal 'Criar equipamento' (+Criar) — botão morto no React — `ALTO` · esf. G · _ausente_
  - **Sintoma:** O botão '+ Criar' no topo do Catálogo não faz nada (tooltip 'Em breve'). O usuário não consegue criar um equipamento sob medida (nome, largura/profund./altura, escolher volume 3D e cor) — recurso central do protótipo para montar layouts reais.
  - **Protótipo:** planner.js:851-896 (openModal/createFromModal/drawPreview/setArch/setMColor) + index.html:175-214 (modal-card, campos L/P/A, seg #m-arch 6 arquétipos, swatches #m-color, preview #m-prev, 'Criar e inserir')
  - **React hoje:** app/src/editor/Planner.tsx:263 (<button className="mini-add" title="Em breve">+ Criar</button> — sem onClick)
  - **Restaurar:** Implementar um <CreateEquipmentModal> React equivalente: campos largura/profund./altura, segmented de arquétipo (box/counter/fridge/shelf/panel/appliance), swatches de cor (as 6 do protótipo, index.html:199-206), preview ao vivo (drawPreview, planner.js:857-869) e ação 'Criar e inserir'. Ligar ao mecanismo de custom-models. Reaproveitar tipos CatalogEntry/Arch3D já existentes.
  - **Depende de:** Custom models / Meus modelos (custom-models-meus-modelos)
- [ ] **`custom-models-meus-modelos`** — Custom models / 'Meus modelos' (persistência, registro no catálogo, excluir, salvar peça como modelo) — `ALTO` · esf. G · _ausente_
  - **Sintoma:** Não existe a seção 'Meus modelos' no topo do catálogo, não há equipamento exemplo 'Char-broiler 2 bocas', não dá para salvar a peça selecionada como modelo reutilizável nem excluir um modelo criado. Modelos não persistem entre sessões.
  - **Protótipo:** planner.js:57-69 (LS_CUSTOM, CUSTOM[], regCustom, loadCustom/saveCustom, DEFAULT_CUSTOM com 'Char-broiler 2 bocas'), :776-805 (buildCatalog mostra 'Meus modelos' + botão del por modelo), :802-805 (delModel), :833-841 (saveAsModel a partir da peça selecionada)
  - **React hoje:** nenhum (Grep por custom/CUSTOM/Meus modelos/saveAsModel em app/src = 0 ocorrências)
  - **Restaurar:** Criar um store de custom models (via StorageAdapter já existente, não localStorage direto, p/ respeitar a arquitetura) que: registra tipos custom no índice do catálogo, renderiza 'Meus modelos' como primeira categoria na rail do catálogo (Planner.tsx:264-277) com botão de excluir por modelo, e adiciona ação 'Salvar como modelo' na peça selecionada (botão btn-savemodel do protótipo, planner.js:645-646). Incluir o seed 'Char-broiler 2 bocas' (props.js DEFAULT_CUSTOM). Custom usa fallback de geometria por arch (já suportado em Scene3D).
- [ ] **`ferramenta-parede-arraste`** — Ferramenta Parede por arraste (desenhar retângulo ortogonal com cota ao vivo) — `MÉDIO` · esf. M · _regredido_
  - **Sintoma:** O botão 'Parede' só joga uma paredinha fixa de 1,0 m no centro da planta, em vez de deixar o usuário desenhar a parede arrastando do ponto A ao B com o comprimento aparecendo ao vivo. Criar divisórias do tamanho certo fica trabalhoso.
  - **Protótipo:** planner.js:455-485 (wallRect/drawWallDraft/wallDown/wallMove/wallUp — arrasta de A a B, snap, espessura 0,12, cria parede com comprimento real e cota 'len m' ao vivo); setTool('wall') em :705-714; tecla W em :750
  - **React hoje:** app/src/editor/Planner.tsx:236 (botão 'Parede' → ed.addItem('wall') insere peça fixa 1,0×0,12 no centro). Sem modo de desenho por arraste.
  - **Restaurar:** Adicionar um tool 'wall' ao estado de ferramentas do Planner (hoje só 'select'|'measure', Planner.tsx:50) com o gesto pointerdown→move→up que desenha um draft retangular ortogonal (wallRect: escolhe orientação pelo maior delta, espessura 0,12) e cota de comprimento ao vivo, e ao soltar (len>=0,20) cria o item wall com width/depth reais via ed.addItem + patch. Reaproveitar toWorld/snapV já existentes. Manter o botão atual ou convertê-lo em toggle de modo.
- [ ] **`acabamentos-piso-parede`** — Acabamentos de piso e parede (porcelanato/cimento; panna/branco/oliva) com seletor no 3D — `MÉDIO` · esf. M · _ausente_
  - **Sintoma:** Não há como trocar o acabamento do piso (porcelanato x cimento queimado) nem a cor da parede (panna/branco/oliva). O 3D sempre mostra piso e paredes na mesma cor padrão, ignorando o campo finishes que já está salvo na cena.
  - **Protótipo:** sim/sim-3d.js:19-63 (finishes {floor:'porcelanato',wall:'panna'}, WALL_FIN paleta, makeFloorTex porcelanato/cimento, setFinish, persistência loja206_fin_v2, UI #fin3d com data-floor/data-wallfin); export inclui finishes em planner.js:919,936
  - **React hoje:** app/src/domain/templates/loja206.ts:55 (finishes:{floor:'porcelanato',wall:'panna'} existe no dado) mas nenhuma UI nem o Scene3D leem/escrevem finishes; Scene3D.tsx:27 piso é cor fixa #efe9db, :35-36 parede cor fixa #d8d2c4
  - **Restaurar:** Portar a textura procedural de piso (makeFloorTex, sim-3d.js:30-54) e a paleta de parede WALL_FIN para o Scene3D, lendo scene.finishes (já existe no tipo Finishes) em vez das cores fixas; e adicionar um seletor de acabamentos na barra do View3D (View3D.tsx header) que faz patch em scene.finishes via o store. Persistir pelo StorageAdapter, não por localStorage direto.
- [ ] **`undo-redo-historico`** — Undo/Redo (histórico de 80 passos, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) — `MÉDIO` · esf. M · _ausente_
  - **Sintoma:** Não dá para desfazer/refazer. Qualquer movimento, resize ou exclusão errada é permanente — Ctrl+Z não responde no editor. Trabalhar no layout fica arriscado.
  - **Protótipo:** planner.js:112-130 (hist[], hi, HMAX=80, pushHist/restoreHist/undo/redo, integrado a persist()); atalhos em :744-745
  - **React hoje:** nenhum (useScene.ts não mantém histórico; Grep por undo/redo/history no editor = 0). Não reverter o store reativo do useScene.
  - **Restaurar:** Adicionar uma pilha de histórico ao useScene (snapshots de RestaurantScene a cada mutação commitada, cap ~80) com undo()/redo() e ligar atalhos Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y. Implementar sobre o setScene atual (não reverter o store), tomando snapshot nos commits (fim de drag/resize, add, remove, patch). Adicionar botões de desfazer/refazer no topbar se desejado.
- [ ] **`arch-faltando-balcao-no-catalogo`** — Arquétipos/builders 3D de tipos sem arch no catálogo (balcao, apoio, lixeira, extintor) — `MÉDIO` · esf. M · _regredido_
  - **Sintoma:** Balcão (a divisa de atendimento), mesa de apoio, lixeira e extintor aparecem como blocos genéricos no 3D — a lixeira/extintor deveriam ser cilíndricos, o balcão deveria ter tampo de pedra e frente vermelha. O balcão nem sequer tem arquétipo definido (cai no default).
  - **Protótipo:** props.js:202-210 (B.balcao com counterBase+rosso), :267-269 (B.apoio), :271-274 (B.lixeira cilíndrica), :276-280 (B.extintor vermelho cilíndrico); archFromType em planner.js:822-829 mapeia balcao→counter, apoio→counter
  - **React hoje:** app/src/domain/catalog.ts:51 (balcao SEM campo arch → arch null), :68-70 (apoio/lixeira/extintor arch:'box'); Scene3D só muda material por arch, nunca geometria, e :198 pula extintor
  - **Restaurar:** Ao portar o registry 3D (item 3d-geometria-detalhada-toda), incluir os builders balcao/apoio/lixeira/extintor de props.js para que tenham forma própria; e preencher o arch faltante de 'balcao' em catalog.ts:51 (counter, como archFromType do protótipo). Decidir se extintor volta a renderizar no 3D (hoje Scene3D.tsx:198 o exclui) — o protótipo o desenha cilíndrico vermelho.
  - **Depende de:** Geometria 3D artesanal (3d-geometria-detalhada-toda)
- [ ] **`atalhos-teclado-editor`** — Atalhos de teclado do editor (R girar, W parede, D divisor, V select, M medir, setas movem, Del, F fit, Esc) — `BAIXO` · esf. M · _ausente_
  - **Sintoma:** Nenhum atalho funciona: não dá para girar com R, excluir com Delete, mover a peça com as setas, ajustar a vista com F, alternar ferramenta com V/M/W ou inserir divisor com D. Fluxo de edição fica todo no mouse, mais lento.
  - **Protótipo:** planner.js:740-760 (Delete/Backspace, R, V, M, F, setas com snap/shift, Esc) e :948-952 (D = inserir divisor)
  - **React hoje:** nenhum (Planner.tsx não registra keydown; só ações por clique de botão)
  - **Restaurar:** Adicionar um useEffect de keydown global no Planner (ignorando quando o foco está em input/contentEditable, como planner.js:741-742) mapeando para as ações já existentes no useScene (rotateItem, removeItem, duplicateItem, addItem('painel')/('wall'), moveItem por setas com passo snap/0,10 no shift) e para setTool/fit locais. Pura camada de UI sobre o store atual.
  - **Depende de:** Ferramenta Parede por arraste (ferramenta-parede-arraste); Undo/Redo (undo-redo-historico)
- [ ] **`swatches-criar-cor-frio-verde`** — Swatches de cor 'Frio' (#2A6FDB) e 'Verde' (#1F8A5B) com rótulos de zona no modal — `BAIXO` · esf. P · _simplificado_
  - **Sintoma:** As cores existem na paleta de propriedades, mas sem os rótulos de zona (Atend./Cozinha/Frio/Verde...) e sem o mapeamento cor→categoria que o modal de criação usa. Ao criar equipamento (quando o modal voltar) faltaria o vínculo cor↔categoria.
  - **Protótipo:** index.html:199-206 (#m-color: 6 swatches rotulados Atend./Cozinha/Estrut./Gerais/Frio/Verde) + colorToCat planner.js:830
  - **React hoje:** app/src/editor/Planner.tsx:24 (SWATCHES inclui as 6 cores, mas sem rótulos de zona) e o modal de criação onde elas seriam usadas não existe
  - **Restaurar:** Ao implementar o modal de criação, portar os 6 swatches rotulados (index.html:199-206) e a função colorToCat (planner.js:830) para derivar a categoria do equipamento custom a partir da cor. Manter a paleta atual nas Propriedades.
  - **Depende de:** Modal Criar equipamento (modal-criar-equipamento)

---

_Origem: `prototype/planner/` (referência visual, byte-idêntico à pasta local do dono) vs `app/src/` (port React).
78 itens do pente-fino automatizado (2D/Operação/Identidade/Catálogo) + 13 itens 3D de análise manual. O 3D, a
verificação adversarial e a síntese automática não rodaram por limite de sessão — completados à mão._