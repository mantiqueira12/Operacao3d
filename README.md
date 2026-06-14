# Operacao3d

Super ferramenta de **arquitetura para restaurantes** — futuro módulo de plataforma SaaS.
Fluxo: **2D (planta)** → **3D (espaço/dimensões)** → **simulação da operação**
(layout, equipamentos, cardápio, funcionários e demanda).

## Como navegar
- **`CLAUDE.md`** — memória do projeto (visão, princípios, stack, como rodar). Comece por aqui.
- **`docs/STATE.md`** — checkpoint vivo: o que está em andamento e o próximo passo (handoff entre agentes).
- **`docs/AGENTS.md`** — personas seniores que colaboram no projeto.
- **`prototype/`** — protótipo de referência (v0): app vanilla (`planner/`) + simulador Python (`python-simulator/`).

## Rodar o protótipo (custo-0, sem build)
```bash
cd prototype/planner && python3 -m http.server 8080   # http://localhost:8080
```
