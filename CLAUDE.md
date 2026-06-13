# Operacao3d — Memória do Projeto

> Leia este arquivo e `docs/STATE.md` **antes** de qualquer ação. Atualize `docs/STATE.md`
> **ao final** do seu turno. Estado mora em `STATE.md`, não no chat (economia de tokens).

## Visão

Super ferramenta de **arquitetura para restaurantes**, futuro **módulo de uma plataforma SaaS**.
Fluxo central: **2D (planta)** → **3D (avaliação de espaço/dimensões)** → **Simulação da operação**
(layout + equipamentos + cardápio + funcionários + demanda → gargalos, filas, capacidade, P&L).

Cliente-âncora / caso real de validação: **All'Antico Panino — Loja 206**.

## Princípios inegociáveis

1. **MVP custo-0.** Tudo roda no cliente; deploy estático em tier grátis. Sem servidor pago no MVP.
2. **Cloud-ready desde já.** Código escrito na linguagem do ambiente web; nuvem entra via
   adaptadores, sem reescrita.
3. **Validar antes de codar.** Confirmar premissa/decisão antes de implementar.
4. **Economia de tokens.** Poucos arquivos `.md`, enxutos. Estado em `docs/STATE.md`.
5. **Multi-agente.** Qualquer agente pode parar e outro continuar a partir de `docs/STATE.md`.

## Stack-alvo (decidida)

- **Frontend:** Framework completo — **React + Vite + TypeScript** (canônico).
  Alternativa registrada para revisitar: **Svelte**.
- **Persistência:** camada `StorageAdapter` (interface). MVP = `localStorage`; nuvem = Supabase/D1
  (tier grátis), trocável sem mexer na UI.
- **3D:** Three.js. **2D:** SVG/Canvas. **Simulação (DES):** motor em TypeScript no cliente
  (Web Worker), com o Python como *golden reference* de validação.
- **Deploy:** estático grátis (Cloudflare Pages / Vercel / GitHub Pages).

## Estado atual do código

`prototype/` contém o **v0 (protótipo de referência)** — NÃO é a base final, é a fonte da verdade
funcional a ser portada:

- `prototype/planner/` — app vanilla (SVG + Three.js via CDN, `localStorage`):
  - `index.html` + `planner.js` + `planner.css` + `props.js` → editor 2D.
  - `operacao.html` + `sim/sim-core.js` (motor DES) + `sim-2d.js` + `sim-3d.js` + `sim-ui.js`.
- `prototype/python-simulator/` — simulador SimPy + Streamlit (`app.py`, `src/simulation.py`).
  Redundante com `sim-core.js`; será **golden reference**, não motor de produção.

### Dívidas conhecidas a resolver na migração
- Tudo hardcoded para "Loja 206" (geometria, área, catálogo) → tornar multi-projeto.
- Sem build/módulos/tipos → migrar para TS modular.
- Dois motores de simulação (JS + Python) → eleger 1 canônico (TS).
- Persistência acoplada a `localStorage` → `StorageAdapter`.

## Estrutura da base nova

`app/` — aplicação React + Vite + TypeScript (alvo do produto). Ainda casca inicial.
CI em `.github/workflows/ci.yml` roda lint + typecheck + build a cada push.

## Como rodar

App novo (React/Vite/TS):
```bash
cd app && npm install && npm run dev   # http://localhost:5173
```
Protótipo de referência (custo-0, sem build):
```bash
cd prototype/planner && python3 -m http.server 8080   # http://localhost:8080
```
Python sim: `cd prototype/python-simulator && pip install -r requirements.txt && streamlit run app.py`

## Convenções de trabalho

- Branch de desenvolvimento: `claude/upbeat-mendel-m8bom6`. Não criar PR sem pedido explícito.
- Commits claros e descritivos. Rodar/validar antes de afirmar que algo funciona.
- Personas/agentes disponíveis e suas áreas: `docs/AGENTS.md`.
