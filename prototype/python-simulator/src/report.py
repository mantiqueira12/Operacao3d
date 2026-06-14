"""Exportação de relatório CSV."""

import csv
import io
from typing import Dict, Optional
from datetime import datetime


def generate_csv_report(
    metrics: Dict,
    config: Dict,
    financials: Optional[Dict] = None,
) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["All Antico Panino - Relatorio de Simulacao"])
    writer.writerow(["Gerado em", datetime.now().strftime("%Y-%m-%d %H:%M")])
    writer.writerow([])

    writer.writerow(["== CONFIGURACAO =="])
    for k, v in config.items():
        writer.writerow([k, v])
    writer.writerow([])

    writer.writerow(["== METRICAS OPERACIONAIS =="])
    op_keys = [
        ("Clientes chegaram", "num_clients_arrived"),
        ("Clientes atendidos", "num_clients_served"),
        ("Clientes desistiram", "num_clients_balked"),
        ("Em andamento (fim sim)", "num_clients_in_progress"),
        ("Taxa de servico (%)", "service_rate"),
        ("Espera media (min)", "avg_wait_time"),
        ("Tempo preparo medio (min)", "avg_prep_time"),
        ("Utilizacao operadores (%)", "operator_utilization"),
        ("Utilizacao forno (%)", "oven_utilization"),
        ("Throughput (clientes/hora)", "throughput"),
    ]
    for label, key in op_keys:
        writer.writerow([label, metrics.get(key, "")])
    writer.writerow([])

    writer.writerow(["== METRICAS FINANCEIRAS =="])
    fin_keys = [
        ("Receita total (R$)", "total_revenue"),
        ("Custo ingredientes (R$)", "total_cost"),
        ("Margem bruta (R$)", "gross_margin"),
        ("Food cost (%)", "food_cost_pct"),
        ("Ticket medio (R$)", "ticket_medio"),
        ("Receita/hora (R$)", "revenue_per_hour"),
    ]
    for label, key in fin_keys:
        writer.writerow([label, metrics.get(key, "")])
    writer.writerow([])

    if financials:
        writer.writerow(["== PROJECOES =="])
        proj_keys = [
            ("Receita diaria (R$)", "revenue_daily"),
            ("Custo diario (R$)", "cost_daily"),
            ("Margem diaria (R$)", "margin_daily"),
            ("Receita mensal (R$)", "revenue_monthly"),
            ("Custos totais mensais (R$)", "total_costs_monthly"),
            ("Lucro mensal (R$)", "profit_monthly"),
            ("Break-even (clientes/dia)", "break_even_customers_daily"),
        ]
        for label, key in proj_keys:
            val = getattr(financials, key, "") if hasattr(financials, key) else financials.get(key, "")
            writer.writerow([label, val])
        writer.writerow([])

    if metrics.get("items_sold"):
        writer.writerow(["== ITENS VENDIDOS =="])
        writer.writerow(["Item", "Quantidade"])
        for item, qty in sorted(metrics["items_sold"].items(), key=lambda x: -x[1]):
            writer.writerow([item, qty])

    return output.getvalue()
