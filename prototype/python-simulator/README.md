# 🍞 All Antico Panino — Operation Simulator

Simulador de operações para validar layout, equipamentos e fluxos **antes de inaugurar** a loja.

## 📋 O que é?

Uma ferramenta de **análise operacional** baseada em Simulação Discreta de Eventos (DES) que:
- Simula chegada realista de clientes (Poisson distribution)
- Modela operadores preparando pedidos
- Identifica **gargalos** (qual equipamento engarrafa?)
- Calcula **capacidade** (quantos clientes/hora consegue atender?)
- Testa diferentes cenários (2 vs 3 operadores, diferentes taxas de chegada, etc)

## 🚀 Começar

### 1. Instalar dependências

```bash
cd "C:\Users\acer\Documents\all-antico-panino-simulator"
pip install -r requirements.txt
```

### 2. Rodar o simulador

```bash
streamlit run app.py
```

A UI abre em `http://localhost:8501`

## 📊 Como usar

1. **Configure na barra lateral:**
   - Número de operadores (1-4)
   - Taxa de clientes/minuto (0.5-5)
   - Duração da simulação (1-16 horas)

2. **Clique em "RODAR SIMULAÇÃO"**
   - Leva 2-3 segundos por simulação
   - Resultados aparecem em tempo real

3. **Analise os resultados:**
   - **Taxa de serviço**: % de clientes atendidos vs. chegaram
   - **Tempo na fila**: Qual espera média
   - **Utilização**: Quanto ocupados estão operadores/forno
   - **Gargalos**: Onde está o problema

## 🔬 Exemplo: Cenário Crítico

**Cenário:** 2 operadores, 2 clientes/minuto, 8 horas

```
Chegadas: 932 clientes
Atendidos: 150 clientes
Desistiram: 777 clientes
Taxa de serviço: 16.1% ❌

CRÍTICA: Sistema NÃO aguenta. Precisa:
- Aumentar para 3-4 operadores
- OU otimizar tempo de prep
- OU adicionar segundo forno
```

## 🏗️ Arquitetura

```
app.py
├── src/simulation.py (SimPy model)
│   └── AllAnticopaninoEnv
│       ├── Recursos: operadores, forno
│       ├── Processo: cliente_process()
│       └── Métricas: wait_time, utilization, etc
└── Streamlit UI
    ├── Sidebar: inputs
    ├── Simulação
    └── Dashboard: métricas, gráficos, recomendações
```

## 📈 Modificando o modelo

### Alterar cardápio

Em `src/simulation.py`, na classe `AllAnticopaninoEnv.__init__()`:

```python
self.menu = {
    "La Spaccata": MenuConfig("La Spaccata", prep_time_base=8, oven_required=True),
    "Panino Simples": MenuConfig("Panino Simples", prep_time_base=6, oven_required=True),
    # ... adicionar mais itens
}
```

### Alterar tempo de prep

```python
"La Spaccata": MenuConfig("La Spaccata", prep_time_base=7, oven_required=True)  # muda de 8 para 7 min
```

### Alterar tolerância de fila (clientes que desistem)

Em `customer_process()`:

```python
if estimated_wait > 15:  # atualmente 15 min, aumenta para 20
    # cliente desiste
```

## 🔄 Próximas iterações (coconstrução)

Para iterar o modelo comigo:

1. **Descreva o que quer testar:**
   - "Quero saber se 3 operadores com forno duplo aguenta 50 clientes/hora"
   - "Quanto tempo de prep precisaria pra 120 clientes/hora com 2 operadores?"

2. **Eu refino o código** (aumenta operadores, ajusta forno, etc)

3. **Você roda a simulação** e vemos os resultados

## 📝 Limitações

- **Não é visualização 3D** (é análise quantitativa)
- **Cardápio fixo** (pode customizar em código)
- **Sem layout visual** (foco em métricas, não em movimento)
- **Simplificado**: não modela (ainda):
  - Pausas de operadores (café, etc)
  - Sazonalidade (picos/vales)
  - Diferentes tipos de clientes (takeout vs delivery)

## 🔗 Stack

- **SimPy 4.1** — Simulação discreta de eventos
- **Streamlit 1.28** — UI web
- **Plotly 5.17** — Gráficos interativos
- **Pandas 2.0** — Dados e tabelas
- **NumPy 1.24** — Cálculos numéricos

## 📌 Próximas fases

- [ ] Fase 1: Validar modelo básico (semana 1) ✅
- [ ] Fase 2: Integrar planta visual 3D (Babylon.js?)
- [ ] Fase 3: Histórico de eventos e análise de gargalos detalhada
- [ ] Fase 4: Exportar relatório PDF para apresentar a sócios

## 📧 Contato

Rafael Game (GastroBSC)  
All Antico Panino — Vitre Shopping, Campos do Jordão
