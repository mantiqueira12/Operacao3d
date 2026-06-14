"""Projeções financeiras a partir de métricas de simulação."""

from dataclasses import dataclass
from typing import Dict


@dataclass
class FinancialProjection:
    revenue_daily: float
    cost_daily: float
    margin_daily: float
    food_cost_pct: float
    ticket_medio: float
    revenue_monthly: float
    cost_monthly: float
    labor_cost_monthly: float
    fixed_costs_monthly: float
    total_costs_monthly: float
    profit_monthly: float
    break_even_customers_daily: float
    break_even_days: float


def project_financials(
    metrics: Dict,
    hours_per_day: float = 8.0,
    days_per_month: int = 26,
    fixed_costs_monthly: float = 15000.0,
    labor_cost_per_operator: float = 3000.0,
    num_operators: int = 2,
) -> FinancialProjection:
    hours_simulated = metrics["total_simulation_time"] / 60
    if hours_simulated <= 0:
        return _empty_projection(fixed_costs_monthly, labor_cost_per_operator, num_operators, days_per_month)

    scale = hours_per_day / hours_simulated

    revenue_daily = metrics["total_revenue"] * scale
    cost_daily = metrics["total_cost"] * scale

    margin_daily = revenue_daily - cost_daily
    food_cost_pct = metrics["food_cost_pct"]
    ticket_medio = metrics["ticket_medio"]

    revenue_monthly = revenue_daily * days_per_month
    cost_monthly = cost_daily * days_per_month
    labor_cost_monthly = labor_cost_per_operator * num_operators
    total_costs_monthly = cost_monthly + labor_cost_monthly + fixed_costs_monthly
    profit_monthly = revenue_monthly - total_costs_monthly

    daily_fixed = (fixed_costs_monthly + labor_cost_monthly) / days_per_month
    margin_per_customer = (margin_daily / metrics["num_clients_served"] * scale) if metrics["num_clients_served"] > 0 else 0
    break_even_daily = daily_fixed / margin_per_customer if margin_per_customer > 0 else float("inf")

    throughput_daily = metrics["throughput"] * hours_per_day
    break_even_days = break_even_daily / throughput_daily if throughput_daily > 0 else float("inf")

    return FinancialProjection(
        revenue_daily=round(revenue_daily, 2),
        cost_daily=round(cost_daily, 2),
        margin_daily=round(margin_daily, 2),
        food_cost_pct=round(food_cost_pct, 1),
        ticket_medio=round(ticket_medio, 2),
        revenue_monthly=round(revenue_monthly, 2),
        cost_monthly=round(cost_monthly, 2),
        labor_cost_monthly=round(labor_cost_monthly, 2),
        fixed_costs_monthly=round(fixed_costs_monthly, 2),
        total_costs_monthly=round(total_costs_monthly, 2),
        profit_monthly=round(profit_monthly, 2),
        break_even_customers_daily=round(break_even_daily, 0),
        break_even_days=round(break_even_days, 1),
    )


def _empty_projection(fixed, labor_per_op, num_ops, days):
    labor = labor_per_op * num_ops
    total = fixed + labor
    return FinancialProjection(
        revenue_daily=0, cost_daily=0, margin_daily=0,
        food_cost_pct=0, ticket_medio=0,
        revenue_monthly=0, cost_monthly=0,
        labor_cost_monthly=labor, fixed_costs_monthly=fixed,
        total_costs_monthly=total, profit_monthly=-total,
        break_even_customers_daily=float("inf"), break_even_days=float("inf"),
    )
