# ⚡ Quick Start — All Antico Panino Simulator

## 30 segundos para começar

### Windows:
Duplo-clique em `run.bat`

Ou abra terminal e execute:
```bash
cd "C:\Users\acer\Documents\all-antico-panino-simulator"
streamlit run app.py
```

### O navegador abrirá automaticamente em http://localhost:8501

---

## 🎯 Seu primeiro teste

1. **Deixe os valores padrão:**
   - 👥 2 operadores
   - 📊 2 clientes/minuto
   - ⏱️ 8 horas

2. **Clique em "▶️ RODAR SIMULAÇÃO"**

3. **Veja o resultado:**
   - Espera ver algo como:
     - ✅ **Atendidos: ~150** (de 900+ que chegaram)
     - ⚠️ **Taxa de serviço: ~16%** (MÁS, precisa aumentar)
     - **Desistiram: 777** (clientes que saíram por fila muito longa)

---

## 🔄 Testando cenários

### Cenário 1: Adicione um operador
- Mude para **3 operadores**
- Clique "RODAR SIMULAÇÃO"
- Veja como taxa de serviço melhora

### Cenário 2: Teste com mais clientes
- Mude para **3 clientes/minuto**
- Veja se sistema aguenta

### Cenário 3: Simule período curto
- Mude duração para **4 horas** (períodalunch)
- Veja se 2 operadores conseguem

---

## 💡 O que significa cada métrica?

| Métrica | O que significa | Ideal |
|---------|------------------|-------|
| **Atendidos** | Clientes que conseguiram fazer pedido | Alto |
| **Desistiram** | Clientes que saíram por fila longa | Baixo |
| **Taxa de serviço** | % de clientes atendidos | > 80% |
| **Espera Média** | Tempo que esperam na fila | < 5 min |
| **Utilização** | Quanto operador/forno está ocupado | 70-85% |

---

## 🔴 Se vir CRÍTICA...

Se o simulador mostrar:
- ❌ Taxa de serviço < 50%
- ⚠️ Muitos clientes desistem

**Significa:** Sistema não aguenta esse volume. Opções:
1. **Aumentar operadores** (+1 ou +2)
2. **Otimizar prep** (reduzir tempo — treinar, processos mais rápidos)
3. **Adicionar equipamento** (segundo forno, saladette maior)

---

## 📝 Próximos passos

1. ✅ **Teste diferentes cenários**
   - 2 ops vs 3 ops vs 4 ops?
   - 1 cliente/min vs 2 vs 3?
   - 4h vs 8h vs 16h?

2. **Quando tiver dúvidas:**
   - "Quero testar com forno duplo"
   - "Quanto tempo de prep precisaria pra 100 clientes/hora?"
   - "Qual a máxima taxa com 2 operadores?"

3. **Eu refinei o modelo** e você testa

---

## 🛠️ Modificando o modelo

Se quiser **mudar tempos de prep**, cardápio, etc:

Edite `src/simulation.py`, procure por:
```python
self.menu = {
    "La Spaccata": MenuConfig("La Spaccata", prep_time_base=8, oven_required=True),
    # mudar 8 para outro número
}
```

Depois rode novamente e veja como muda.

---

## ❓ Dúvidas?

Rode um teste, veja os resultados, e me diga:
- "Taxa de serviço está em 16%, como melhoro?"
- "Quero simular forno duplo, como funciona?"
- "Preciso de qual estrutura para atender 100 clientes/hora?"

Eu refino o código e você testa de novo.

---

**All Antico Panino — Vitre Shopping, Campos do Jordão | May 2026**
