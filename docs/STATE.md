# STATE — Checkpoint vivo

> Ponto de partida entre agentes. Leia no início, atualize no fim do turno.
> Mantenha curto. Última atualização: 2026-06-13.

## Agora
- **Motor de simulação (DES) — loop dinâmico portado.** `app/src/sim/engine.ts`: classe
  `SimEngine` encapsula todo o estado (clientes, operadores, filas, métricas S, pão BR, locks).
  Portado fiel de `sim-core.js`: demanda (Poisson + curva horária), ciclo do cliente
  (chegada→fila→PDV→preparo→retirada→saída), FSM dos atendentes (volante/fixo), FSM do padeiro
  (BOH: farinha→batedeira→estufa→forno→estoque), tick(dt), computeKPIs() + breadKPIs +
  flowDistances. Função `runSimulation(cfg, scene, {dt,until})` roda o dia headless e devolve
  KPIs. 9 testes novos (43 no total): sanidade do dia, reprodutibilidade por seed, resposta a
  carga (mais demanda → mais desistência), passo de tempo. Lint+typecheck+build OK.
- **Melhorias deliberadas sobre o original** (documentadas no topo do `engine.ts`):
  (a) RNG semeável → runs reprodutíveis; (b) `stepAlong` consome o orçamento de velocidade
  inteiro (movimento dt-independente; o original avançava só 1 célula de 0,05 m por tick,
  acoplando a velocidade do operador à taxa de quadros); (c) sem heatmap/trilhas (visuais).
- **Web Worker pronto.** `worker-core.ts`: classe `SimController` (núcleo PURO e testável,
  recebe um `post`) com protocolo de mensagens `init|run|step|reset|snapshot` →
  `ready|kpis|frame|done|error`. `worker.ts`: shell fino que liga `self.onmessage/postMessage`
  ao controller e gerencia o laço ao vivo (`play`/`pause` com setInterval). `engine.ts` ganhou
  `snapshot()` (frame leve serializável: posições de clientes/operadores) e `sceneSnapshot()`
  (cena estática: estações, bloqueadores, slots, geometria). 7 testes novos (50 no total):
  protocolo, `run` reproduz `runSimulation`, KPIs periódicos, frame com posições, clamp no fim
  do dia, captura de erro. Lint+typecheck+build OK.
- Fundação espacial antes disso: `types/defaults/rng/geometry/nav` (8 testes) + editor 2D React.

## Próximo (continuar o motor DES)
1. **Cross-check** estatístico vs Python (médias ±tolerância sobre N réplicas com seeds) +
   adapter RestaurantScene(editor) → SceneItem[](sim).
2. **Painel de simulação na UI** React: instanciar o Worker
   (`new Worker(new URL('./sim/worker.ts', import.meta.url), {type:'module'})`), rodar, ver
   KPIs ao vivo, gargalos, P&L, pão; depois animação 2D (e 3D) a partir dos frames.

## Dívida do port (validar com o dono antes de mudar)
- **Contagem dupla served × balkedPickup:** se o cliente abandona a retirada (timeout) mas um
  operador já pegou a tarefa, ele ainda "entrega" e conta `served++` (além de `balkedPickup++`).
  Logo served+balked pode passar de `arrived` (~69 num dia base, seed 42). É FIEL ao
  `sim-core.js` (mesma lógica em `delivering`). Decisão pendente: manter (fidelidade) ou
  cancelar a tarefa no abandono.

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
