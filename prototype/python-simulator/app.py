"""
Streamlit Dashboard: All Antico Panino Operation Simulator
Pipeline model com operadores fixo/volante e pedidos multi-item.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from src.simulation import AllAnticopaninoEnv, MenuItem, OperatorConfig, DEFAULT_MENU, STATIONS
from src.financials import project_financials
from src.report import generate_csv_report

st.set_page_config(page_title="All Antico Panino - Simulator", page_icon="🍞", layout="wide")

st.title("🍞 All Antico Panino — Operation Simulator")
st.markdown("Simule a operação com **pipeline de estações** e operadores fixo/volante.")

DEMAND_PROFILES = {
    "Taxa Fixa": None,
    "Dia Normal": {10: 0.5, 11: 1.0, 12: 2.5, 13: 2.0, 14: 1.5, 15: 0.8, 16: 0.5, 17: 0.8, 18: 1.5, 19: 2.0, 20: 1.5, 21: 0.8},
    "Dia de Pico": {10: 0.8, 11: 1.5, 12: 3.5, 13: 3.0, 14: 2.0, 15: 1.2, 16: 0.8, 17: 1.2, 18: 2.5, 19: 3.0, 20: 2.0, 21: 1.0},
    "Shopping Cheio": {10: 1.0, 11: 2.0, 12: 4.0, 13: 3.5, 14: 2.5, 15: 1.5, 16: 1.0, 17: 1.5, 18: 3.0, 19: 3.5, 20: 2.5, 21: 1.5},
}

if "scenarios" not in st.session_state:
    st.session_state.scenarios = []

# ============================================================================
# Sidebar
# ============================================================================

with st.sidebar:
    st.header("⚙️ Configuração")

    # --- Equipe ---
    with st.expander("👥 Equipe e Estações", expanded=True):
        op_mode = st.radio("Modo de operação", ["Polivalente", "Pipeline (fixo + volante)"],
                           help="Polivalente: todos fazem tudo. Pipeline: cada um na sua praça.")

        if op_mode == "Polivalente":
            num_ops = st.number_input("Operadores", 1, 6, 2)
            operators_config = None
            num_operators = num_ops
        else:
            st.caption("Fixos trabalham só na sua praça. Volantes cobrem qualquer uma.")
            cols = st.columns(4)
            fixo_caixa = cols[0].number_input("Caixa", 0, 3, 0, key="fc")
            fixo_prep = cols[1].number_input("Preparo", 0, 3, 0, key="fp")
            fixo_forno = cols[2].number_input("Forno", 0, 3, 1, key="ff")
            fixo_montagem = cols[3].number_input("Montag.", 0, 3, 0, key="fm")
            num_volantes = st.number_input("Volantes", 0, 4, 1, key="nv")

            total_ops = fixo_caixa + fixo_prep + fixo_forno + fixo_montagem + num_volantes
            st.metric("Total operadores", total_ops)

            operators_config = []
            for _ in range(fixo_caixa):
                operators_config.append(OperatorConfig("fixo", "caixa"))
            for _ in range(fixo_prep):
                operators_config.append(OperatorConfig("fixo", "prep"))
            for _ in range(fixo_forno):
                operators_config.append(OperatorConfig("fixo", "forno"))
            for _ in range(fixo_montagem):
                operators_config.append(OperatorConfig("fixo", "montagem"))
            for _ in range(num_volantes):
                operators_config.append(OperatorConfig("volante"))

            num_operators = total_ops

            if total_ops == 0:
                st.error("Configure pelo menos 1 operador.")
            elif num_volantes == 0:
                covered = set()
                if fixo_caixa > 0: covered.add("caixa")
                if fixo_prep > 0: covered.add("prep")
                if fixo_forno > 0: covered.add("forno")
                if fixo_montagem > 0: covered.add("montagem")
                missing = set(STATIONS) - covered
                if missing:
                    st.warning(f"Sem volante, faltam fixos em: {', '.join(missing)}")

    # --- Equipamento ---
    num_ovens = st.number_input("🔥 Fornos", 1, 3, 1)
    oven_time_pct = st.slider("⏳ Tempo forno (% do preparo)", 20, 80, 50, 5) / 100

    st.divider()

    # --- Demanda ---
    demand_mode = st.selectbox("📈 Perfil de Demanda", list(DEMAND_PROFILES.keys()))
    if demand_mode == "Taxa Fixa":
        client_rate = st.number_input("📊 Clientes/minuto", 0.5, 5.0, 2.0, 0.5)
        demand_profile = None
    else:
        demand_profile = DEMAND_PROFILES[demand_mode]
        client_rate = 2.0
        chart_data = pd.DataFrame({
            "Hora": [f"{h}:00" for h in sorted(demand_profile.keys())],
            "Cl/min": [demand_profile[h] for h in sorted(demand_profile.keys())]
        })
        st.bar_chart(chart_data.set_index("Hora"), height=120)

    sim_hours = st.slider("⏱️ Duração (horas)", 1, 16, 8)
    simulation_time = sim_hours * 60

    st.divider()

    # --- Pedidos multi-item ---
    with st.expander("📦 Pedidos Multi-Item"):
        multi_item = st.checkbox("Clientes podem pedir vários itens")
        if multi_item:
            p1 = st.slider("% pedidos 1 item", 0, 100, 60, key="p1")
            p2 = st.slider("% pedidos 2 itens", 0, 100, 30, key="p2")
            p3 = max(0, 100 - p1 - p2)
            st.caption(f"% pedidos 3 itens: {p3}%")
            if p1 + p2 > 100:
                st.warning("Soma excede 100%")
            multi_item_probs = [p1 / 100, p2 / 100, p3 / 100]
        else:
            multi_item_probs = None

    # --- Cardápio ---
    with st.expander("🍕 Cardápio"):
        menu_items = []
        for i, default in enumerate(DEFAULT_MENU):
            st.markdown(f"**{default.name}**")
            cols = st.columns(3)
            price = cols[0].number_input("R$", value=default.price, min_value=0.0, step=5.0, key=f"pr_{i}")
            cost = cols[1].number_input("Custo", value=default.cost, min_value=0.0, step=2.0, key=f"co_{i}")
            prob = cols[2].number_input("Prob%", value=int(default.probability * 100), min_value=0, max_value=100, step=5, key=f"pb_{i}")
            menu_items.append(MenuItem(default.name, default.prep_time_base, default.oven_required, price, cost, prob / 100))

    # --- Custos ---
    with st.expander("💰 Custos"):
        fixed_costs = st.number_input("Fixos mensais (R$)", value=15000.0, step=1000.0)
        labor_cost = st.number_input("Mão-de-obra/op/mês (R$)", value=3000.0, step=500.0)
        days_per_month = st.number_input("Dias/mês", value=26, min_value=1, max_value=31)
        hours_per_day = st.number_input("Horas/dia", value=float(sim_hours), min_value=1.0, max_value=16.0)

    st.divider()

    monte_carlo = st.checkbox("🎲 Monte Carlo")
    mc_runs = st.number_input("Rodadas", 5, 50, 20) if monte_carlo else 1

    st.divider()
    st.info("**Vitre Shopping, Campos do Jordão**\nLoja 10,45 m² | Forno deck 60×62 cm")

# ============================================================================
# Simulação
# ============================================================================

def run_single_sim(seed=42):
    sim = AllAnticopaninoEnv(
        num_operators=num_operators if operators_config is None else 2,
        client_arrival_rate=client_rate,
        simulation_time=simulation_time,
        random_seed=seed,
        menu=menu_items,
        num_ovens=num_ovens,
        oven_time_pct=oven_time_pct,
        demand_profile=demand_profile,
        operators_config=operators_config,
        multi_item_probs=multi_item_probs,
    )
    return sim.run(), sim.events


can_run = True
if op_mode != "Polivalente" and operators_config is not None:
    if len(operators_config) == 0:
        can_run = False
    has_vol = any(op.role == "volante" for op in operators_config)
    if not has_vol:
        covered = {op.station for op in operators_config if op.role == "fixo"}
        if set(STATIONS) - covered:
            can_run = False

if st.button("▶️ RODAR SIMULAÇÃO", use_container_width=True, type="primary", disabled=not can_run):
    try:
        if monte_carlo and mc_runs > 1:
            with st.spinner(f"🔄 Rodando {mc_runs} simulações..."):
                all_metrics = []
                for i in range(mc_runs):
                    m, _ = run_single_sim(seed=42 + i)
                    all_metrics.append(m)
                metrics, events = run_single_sim(seed=42)
                numeric_keys = [k for k in metrics if isinstance(metrics[k], (int, float))
                                and k not in ("total_simulation_time", "num_ovens")]
                mc_stats = {}
                for key in numeric_keys:
                    vals = [m[key] for m in all_metrics]
                    mean = sum(vals) / len(vals)
                    mc_stats[key] = {
                        "mean": mean,
                        "min": min(vals),
                        "max": max(vals),
                        "std": (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5,
                    }
        else:
            with st.spinner("🔄 Simulando..."):
                metrics, events = run_single_sim(seed=42)
                mc_stats = None
    except Exception as e:
        st.error(f"Erro: {e}")
        st.stop()

    fin = project_financials(
        metrics, hours_per_day=hours_per_day, days_per_month=days_per_month,
        fixed_costs_monthly=fixed_costs, labor_cost_per_operator=labor_cost,
        num_operators=num_operators if operators_config is None else len(operators_config),
    )

    st.success("✅ Simulação concluída!")

    # --- Operacionais ---
    st.subheader("📊 Métricas Operacionais")
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Chegadas", int(metrics["num_clients_arrived"]))
    c2.metric("Atendidos", int(metrics["num_clients_served"]), delta=f"{metrics['service_rate']:.1f}%")
    c3.metric("Desistiram", int(metrics["num_clients_balked"]), delta_color="inverse")
    c4.metric("Tempo Serviço", f"{metrics['avg_wait_time']:.1f} min")
    c5.metric("Throughput", f"{metrics['throughput']:.0f}/h")

    if metrics["num_clients_in_progress"] > 0:
        st.caption(f"ℹ️ {metrics['num_clients_in_progress']} em atendimento ao fim da simulação")
    if metrics.get("items_per_order", 1) > 1:
        st.caption(f"📦 Média {metrics['items_per_order']:.1f} itens por pedido")

    # --- Financeiras ---
    st.subheader("💰 Financeiro")
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Receita", f"R${metrics['total_revenue']:,.0f}")
    c2.metric("Ticket Médio", f"R${metrics['ticket_medio']:.0f}")
    c3.metric("Receita/Hora", f"R${metrics['revenue_per_hour']:.0f}")
    c4.metric("Food Cost", f"{metrics['food_cost_pct']:.0f}%",
              delta="ok" if metrics['food_cost_pct'] <= 35 else "alto",
              delta_color="normal" if metrics['food_cost_pct'] <= 35 else "inverse")
    c5.metric("Margem Bruta", f"R${metrics['gross_margin']:,.0f}")

    # --- Projeções ---
    st.subheader("📈 Projeções")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Receita/Mês", f"R${fin.revenue_monthly:,.0f}")
    c2.metric("Custos/Mês", f"R${fin.total_costs_monthly:,.0f}")
    c3.metric("Lucro/Mês", f"R${fin.profit_monthly:,.0f}",
              delta="positivo" if fin.profit_monthly >= 0 else "negativo",
              delta_color="normal" if fin.profit_monthly >= 0 else "inverse")
    be = fin.break_even_customers_daily
    c4.metric("Break-Even", f"{be:.0f} cl/dia" if be < float("inf") else "N/A")

    # --- Utilização por operador ---
    st.subheader("👥 Utilização por Operador")

    op_detail = metrics.get("operators_detail", [])
    if op_detail:
        labels = [f"Op.{r['id']} ({r['role']}/{r['station']})" for r in op_detail]

        fig_ops = go.Figure()
        colors = ["#1f6feb" if r["role"] == "volante" else "#d29922" for r in op_detail]
        fig_ops.add_trace(go.Bar(
            x=labels,
            y=[r["utilization"] for r in op_detail],
            marker_color=colors,
            text=[f"{r['utilization']}%" for r in op_detail],
            textposition="auto",
        ))
        fig_ops.update_layout(
            height=250, yaxis_range=[0, 100],
            yaxis_title="Utilização %",
            showlegend=False,
            margin=dict(t=20, b=40),
        )
        st.plotly_chart(fig_ops, use_container_width=True)

        st.caption("🔵 Volante | 🟡 Fixo")

    # --- Utilização por estação ---
    st.subheader("🏭 Utilização por Estação")

    stations_detail = metrics.get("stations_detail", {})
    if stations_detail:
        station_names_pt = {"caixa": "Caixa", "prep": "Preparo", "forno": "Forno", "montagem": "Montagem"}
        st_data = []
        for s in STATIONS:
            sd = stations_detail.get(s, {})
            st_data.append({
                "Estação": station_names_pt.get(s, s),
                "Tarefas": sd.get("tasks", 0),
                "Tempo Ocupado (min)": sd.get("busy_time", 0),
            })
        st.dataframe(pd.DataFrame(st_data), use_container_width=True, hide_index=True)

    # --- Gauges ---
    st.subheader("⚙️ Utilização Geral")
    c1, c2 = st.columns(2)

    with c1:
        fig = go.Figure(go.Indicator(
            mode="gauge+number", value=metrics["operator_utilization"],
            title={'text': "Operadores (média) %"},
            gauge={'axis': {'range': [0, 100]}, 'bar': {'color': "darkblue"},
                   'steps': [{'range': [0, 60], 'color': "lightgreen"},
                             {'range': [60, 85], 'color': "lightyellow"},
                             {'range': [85, 100], 'color': "lightcoral"}]}
        ))
        fig.update_layout(height=250)
        st.plotly_chart(fig, use_container_width=True)

    with c2:
        fig = go.Figure(go.Indicator(
            mode="gauge+number", value=metrics["oven_utilization"],
            title={'text': f"Forno ({num_ovens}x) %"},
            gauge={'axis': {'range': [0, 100]}, 'bar': {'color': "darkred"},
                   'steps': [{'range': [0, 50], 'color': "lightgreen"},
                             {'range': [50, 80], 'color': "lightyellow"},
                             {'range': [80, 100], 'color': "lightcoral"}]}
        ))
        fig.update_layout(height=250)
        st.plotly_chart(fig, use_container_width=True)

    # --- Mix de vendas ---
    if metrics.get("items_sold"):
        st.subheader("🍕 Mix de Vendas")
        items_df = pd.DataFrame([
            {"Item": k, "Qty": v} for k, v in sorted(metrics["items_sold"].items(), key=lambda x: -x[1])
        ])
        st.bar_chart(items_df.set_index("Item"), height=200)

    # --- Monte Carlo ---
    if mc_stats:
        st.subheader("🎲 Monte Carlo")
        display_keys = {
            "num_clients_served": "Atendidos", "service_rate": "Taxa serviço (%)",
            "avg_wait_time": "Tempo serviço (min)", "throughput": "Throughput (/h)",
            "total_revenue": "Receita (R$)", "ticket_medio": "Ticket médio (R$)",
            "food_cost_pct": "Food cost (%)", "operator_utilization": "Util. operadores (%)",
        }
        mc_rows = []
        for key, label in display_keys.items():
            if key in mc_stats:
                s = mc_stats[key]
                mc_rows.append({"Métrica": label, "Média": f"{s['mean']:.1f}",
                                "Mín": f"{s['min']:.1f}", "Máx": f"{s['max']:.1f}",
                                "± Desvio": f"{s['std']:.1f}"})
        st.dataframe(pd.DataFrame(mc_rows), use_container_width=True, hide_index=True)

    # --- Gargalos ---
    st.subheader("🔴 Gargalos")
    gargalos = []
    if metrics["service_rate"] < 50:
        gargalos.append(f"🔴 **CAPACIDADE INSUFICIENTE** — {metrics['service_rate']:.0f}% atendidos")
    if metrics["oven_utilization"] > 85:
        gargalos.append(f"⚠️ **FORNO saturado** ({metrics['oven_utilization']:.0f}%)")
    if metrics["operator_utilization"] > 85:
        gargalos.append(f"⚠️ **OPERADORES no limite** ({metrics['operator_utilization']:.0f}%)")

    # Station bottleneck
    if stations_detail:
        max_station = max(stations_detail.items(), key=lambda x: x[1].get("busy_time", 0))
        if max_station[1]["busy_time"] > 0:
            ratio = max_station[1]["busy_time"] / max(1, sum(s["busy_time"] for s in stations_detail.values()))
            if ratio > 0.4:
                names = {"caixa": "Caixa", "prep": "Preparo", "forno": "Forno", "montagem": "Montagem"}
                gargalos.append(f"⚠️ **Estação gargalo: {names.get(max_station[0], max_station[0])}** "
                                f"({max_station[1]['busy_time']:.0f} min ocupada, {ratio*100:.0f}% do tempo total)")

    if metrics["food_cost_pct"] > 35:
        gargalos.append(f"⚠️ **Food cost alto** ({metrics['food_cost_pct']:.0f}%)")

    for g in gargalos:
        st.warning(g)
    if not gargalos:
        st.success("✅ Operação bem dimensionada!")

    # --- Recomendações ---
    st.subheader("💡 Recomendações")
    recos = []
    if metrics["service_rate"] < 50:
        recos.append("🔴 **CAPACIDADE CRÍTICA** — Aumente operadores ou otimize preparo")
    elif metrics["service_rate"] < 80:
        recos.append("🟡 **CAPACIDADE APERTADA** — Pouca margem para picos")
    if metrics["oven_utilization"] > 90:
        recos.append("🔥 **FORNO SATURADO** — Adicione segundo forno ou fixo dedicado")
    if fin.profit_monthly < 0:
        recos.append(f"📉 **PREJUÍZO** R${abs(fin.profit_monthly):,.0f}/mês — Revise custos ou volume")

    if op_detail:
        idle_ops = [op for op in op_detail if op["utilization"] < 30]
        busy_ops = [op for op in op_detail if op["utilization"] > 90]
        if idle_ops:
            labels = [f"Op.{op['id']}({op['station']})" for op in idle_ops]
            recos.append(f"💤 **Operadores ociosos**: {', '.join(labels)} — Considere remanejamento")
        if busy_ops:
            labels = [f"Op.{op['id']}({op['station']})" for op in busy_ops]
            recos.append(f"🏃 **Sobrecarregados**: {', '.join(labels)} — Adicione reforço nessa praça")

    if metrics["service_rate"] >= 80 and metrics["operator_utilization"] < 80:
        recos.append("✅ **Operação equilibrada** — Boa capacidade com margem")

    for r in recos:
        st.info(r)

    # --- Resumo ---
    with st.expander("📋 Resumo Técnico"):
        resumo = {
            "Métrica": [
                "Chegaram", "Atendidos", "Desistiram", "Em andamento",
                "Taxa serviço", "Tempo serviço médio", "Throughput",
                "Util. operadores", "Util. forno", "Itens/pedido",
                "Receita", "Food cost", "Ticket médio",
                "Receita mensal", "Lucro mensal", "Break-even",
            ],
            "Valor": [
                str(metrics["num_clients_arrived"]), str(metrics["num_clients_served"]),
                str(metrics["num_clients_balked"]), str(metrics["num_clients_in_progress"]),
                f"{metrics['service_rate']}%", f"{metrics['avg_wait_time']:.1f} min",
                f"{metrics['throughput']:.1f}/h",
                f"{metrics['operator_utilization']}%", f"{metrics['oven_utilization']}%",
                f"{metrics.get('items_per_order', 1):.1f}",
                f"R${metrics['total_revenue']:,.0f}", f"{metrics['food_cost_pct']}%",
                f"R${metrics['ticket_medio']:.0f}",
                f"R${fin.revenue_monthly:,.0f}", f"R${fin.profit_monthly:,.0f}",
                f"{fin.break_even_customers_daily:.0f} cl/dia" if fin.break_even_customers_daily < float("inf") else "N/A",
            ],
        }
        st.dataframe(pd.DataFrame(resumo), use_container_width=True, hide_index=True)

    # --- Log ---
    with st.expander("📜 Log de Eventos (últimos 50)"):
        if events:
            ev_df = pd.DataFrame(events[-50:])
            ev_df["time"] = ev_df["time"].apply(lambda t: f"{t:.1f} min")
            st.dataframe(ev_df, use_container_width=True, hide_index=True)

    # --- Export ---
    st.subheader("📥 Exportar")
    config_dict = {
        "Modo": op_mode,
        "Operadores": num_operators if operators_config is None else len(operators_config),
        "Fornos": num_ovens, "Demanda": demand_mode,
        "Multi-item": "Sim" if multi_item_probs else "Não",
        "Duração (h)": sim_hours,
    }
    if operators_config:
        fixo_summary = {}
        vol_count = 0
        for op in operators_config:
            if op.role == "fixo":
                fixo_summary[op.station] = fixo_summary.get(op.station, 0) + 1
            else:
                vol_count += 1
        config_dict["Fixos"] = str(fixo_summary)
        config_dict["Volantes"] = vol_count

    csv_content = generate_csv_report(metrics, config_dict, fin)
    st.download_button("⬇️ Baixar Relatório (CSV)", data=csv_content,
                       file_name="relatorio_antico_panino.csv", mime="text/csv",
                       use_container_width=True)

    # --- Cenários ---
    st.divider()
    st.subheader("🔄 Comparar Cenários")
    sc_name = st.text_input("Nome do cenário",
                             value=f"{op_mode}_{num_operators if operators_config is None else len(operators_config)}op")
    if st.button("💾 Salvar Cenário"):
        st.session_state.scenarios.append({
            "name": sc_name, "config": config_dict, "metrics": metrics,
            "financials": {"revenue_monthly": fin.revenue_monthly,
                           "profit_monthly": fin.profit_monthly,
                           "break_even": fin.break_even_customers_daily},
        })
        st.success(f"'{sc_name}' salvo! ({len(st.session_state.scenarios)} cenários)")

    if len(st.session_state.scenarios) >= 2:
        comp_keys = {
            "num_clients_served": "Atendidos", "service_rate": "Taxa (%)",
            "throughput": "Throughput (/h)", "operator_utilization": "Util. op (%)",
            "oven_utilization": "Util. forno (%)", "total_revenue": "Receita (R$)",
            "ticket_medio": "Ticket médio", "food_cost_pct": "Food cost (%)",
        }
        comp_data = {"Métrica": list(comp_keys.values())}
        for sc in st.session_state.scenarios[-3:]:
            vals = []
            for key in comp_keys:
                v = sc["metrics"].get(key, 0)
                vals.append(f"{v:.1f}" if isinstance(v, float) else str(v))
            comp_data[sc["name"]] = vals
        comp_data["Métrica"].extend(["Receita/mês", "Lucro/mês"])
        for sc in st.session_state.scenarios[-3:]:
            f = sc["financials"]
            comp_data[sc["name"]].extend([f"R${f['revenue_monthly']:,.0f}", f"R${f['profit_monthly']:,.0f}"])
        st.dataframe(pd.DataFrame(comp_data), use_container_width=True, hide_index=True)

        if st.button("🗑️ Limpar"):
            st.session_state.scenarios = []
            st.rerun()

else:
    st.info("👉 Configure a equipe e clique **'RODAR SIMULAÇÃO'**.")
    st.divider()
    st.subheader("Como funciona:")
    st.markdown("""
    **Pipeline de produção:** Caixa → Preparo → Forno → Montagem

    **Operadores Fixos:** trabalham só na sua praça (ex: fixo no forno)
    **Operadores Volantes:** cobrem qualquer praça conforme demanda

    **Pedidos multi-item:** clientes podem pedir 1-3 itens por vez

    Configure, rode e compare cenários para encontrar o dimensionamento ideal.
    """)

st.divider()
st.markdown("**All Antico Panino** — Vitre Shopping, Campos do Jordão | Simulador v3.0")
