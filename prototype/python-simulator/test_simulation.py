"""Tests for the All Antico Panino simulation engine (pipeline model)."""

import pytest
from src.simulation import AllAnticopaninoEnv, MenuItem, OperatorConfig, DEFAULT_MENU, STATIONS
from src.financials import project_financials


class TestBasicRun:
    def test_returns_expected_keys(self):
        sim = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=1.0, simulation_time=60, random_seed=42)
        metrics = sim.run()
        for key in ["num_clients_arrived", "num_clients_served", "num_clients_balked",
                     "num_clients_in_progress", "service_rate", "avg_wait_time",
                     "operator_utilization", "oven_utilization", "throughput",
                     "total_revenue", "ticket_medio", "food_cost_pct",
                     "items_sold", "operators_detail", "stations_detail", "items_per_order"]:
            assert key in metrics, f"Missing: {key}"

    def test_clients_arrive(self):
        sim = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=1.0, simulation_time=60, random_seed=42)
        assert sim.run()["num_clients_arrived"] > 0

    def test_short_simulation(self):
        sim = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=1.0, simulation_time=10, random_seed=42)
        assert sim.run()["num_clients_arrived"] >= 0


class TestClientAccounting:
    def test_accounting_balanced(self):
        sim = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=1.5, simulation_time=480, random_seed=42)
        m = sim.run()
        total = m["num_clients_served"] + m["num_clients_balked"] + m["num_clients_in_progress"]
        assert total == m["num_clients_arrived"], (
            f"{m['num_clients_served']}+{m['num_clients_balked']}+{m['num_clients_in_progress']}="
            f"{total} != {m['num_clients_arrived']}")

    def test_high_volume_accounting(self):
        sim = AllAnticopaninoEnv(num_operators=3, client_arrival_rate=2.0, simulation_time=480, random_seed=99)
        m = sim.run()
        assert m["num_clients_served"] + m["num_clients_balked"] + m["num_clients_in_progress"] == m["num_clients_arrived"]


class TestInputValidation:
    def test_zero_operators_raises(self):
        with pytest.raises(ValueError):
            AllAnticopaninoEnv(num_operators=0)

    def test_negative_rate_raises(self):
        with pytest.raises(ValueError):
            AllAnticopaninoEnv(client_arrival_rate=-1)

    def test_zero_time_raises(self):
        with pytest.raises(ValueError):
            AllAnticopaninoEnv(simulation_time=0)

    def test_zero_ovens_raises(self):
        with pytest.raises(ValueError):
            AllAnticopaninoEnv(num_ovens=0)

    def test_missing_station_coverage_raises(self):
        with pytest.raises(ValueError, match="faltam fixos"):
            AllAnticopaninoEnv(operators_config=[
                OperatorConfig("fixo", "caixa"),
                OperatorConfig("fixo", "forno"),
            ])


class TestPipelineModel:
    def test_fixo_volante_runs(self):
        config = [
            OperatorConfig("fixo", "forno"),
            OperatorConfig("volante"),
        ]
        sim = AllAnticopaninoEnv(
            operators_config=config, client_arrival_rate=0.5,
            simulation_time=120, random_seed=42)
        m = sim.run()
        assert m["num_clients_served"] > 0

    def test_all_fixo_runs(self):
        config = [
            OperatorConfig("fixo", "caixa"),
            OperatorConfig("fixo", "prep"),
            OperatorConfig("fixo", "forno"),
            OperatorConfig("fixo", "montagem"),
        ]
        sim = AllAnticopaninoEnv(
            operators_config=config, client_arrival_rate=0.5,
            simulation_time=120, random_seed=42)
        m = sim.run()
        assert m["num_clients_served"] > 0

    def test_operators_detail_populated(self):
        config = [
            OperatorConfig("fixo", "forno"),
            OperatorConfig("volante"),
        ]
        sim = AllAnticopaninoEnv(
            operators_config=config, client_arrival_rate=0.5,
            simulation_time=120, random_seed=42)
        m = sim.run()
        assert len(m["operators_detail"]) == 2
        assert m["operators_detail"][0]["role"] == "fixo"
        assert m["operators_detail"][1]["role"] == "volante"

    def test_stations_detail_populated(self):
        sim = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=0.5,
                                 simulation_time=120, random_seed=42)
        m = sim.run()
        for station in STATIONS:
            assert station in m["stations_detail"]

    def test_more_operators_better_throughput(self):
        m1 = AllAnticopaninoEnv(num_operators=1, client_arrival_rate=0.5,
                                simulation_time=480, random_seed=42).run()
        m3 = AllAnticopaninoEnv(num_operators=3, client_arrival_rate=0.5,
                                simulation_time=480, random_seed=42).run()
        assert m3["service_rate"] >= m1["service_rate"]


class TestMultiItem:
    def test_multi_item_orders(self):
        sim = AllAnticopaninoEnv(
            num_operators=3, client_arrival_rate=0.5, simulation_time=120,
            random_seed=42, multi_item_probs=[0.4, 0.4, 0.2])
        m = sim.run()
        assert m["items_per_order"] > 1.0

    def test_single_item_default(self):
        sim = AllAnticopaninoEnv(
            num_operators=2, client_arrival_rate=0.5, simulation_time=120, random_seed=42)
        m = sim.run()
        assert m["items_per_order"] >= 1.0

    def test_multi_item_higher_ticket(self):
        m_single = AllAnticopaninoEnv(
            num_operators=3, client_arrival_rate=0.3, simulation_time=480,
            random_seed=42, multi_item_probs=None).run()
        m_multi = AllAnticopaninoEnv(
            num_operators=3, client_arrival_rate=0.3, simulation_time=480,
            random_seed=42, multi_item_probs=[0.3, 0.4, 0.3]).run()
        assert m_multi["ticket_medio"] >= m_single["ticket_medio"]


class TestEquipment:
    def test_two_ovens_lower_utilization(self):
        m1 = AllAnticopaninoEnv(num_operators=3, client_arrival_rate=0.8,
                                simulation_time=480, random_seed=42, num_ovens=1).run()
        m2 = AllAnticopaninoEnv(num_operators=3, client_arrival_rate=0.8,
                                simulation_time=480, random_seed=42, num_ovens=2).run()
        assert m2["oven_utilization"] <= m1["oven_utilization"]


class TestFinancials:
    def test_revenue_positive(self):
        m = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=0.5,
                               simulation_time=480, random_seed=42).run()
        assert m["total_revenue"] > 0
        assert m["ticket_medio"] > 0

    def test_food_cost_reasonable(self):
        m = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=0.5,
                               simulation_time=480, random_seed=42).run()
        assert 0 < m["food_cost_pct"] < 100

    def test_projection(self):
        m = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=0.5,
                               simulation_time=480, random_seed=42).run()
        fin = project_financials(m, hours_per_day=8, days_per_month=26)
        assert fin.revenue_monthly > 0
        assert fin.break_even_customers_daily > 0


class TestDemandProfile:
    def test_profile_runs(self):
        profile = {10: 0.5, 11: 1.0, 12: 2.5, 13: 2.0, 14: 1.0}
        m = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=1.0,
                               simulation_time=300, random_seed=42, demand_profile=profile).run()
        assert m["num_clients_arrived"] > 0

    def test_zero_rate_no_crash(self):
        profile = {10: 0.0, 11: 0.0, 12: 1.0}
        m = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=1.0,
                               simulation_time=180, random_seed=42, demand_profile=profile).run()
        assert m["num_clients_arrived"] >= 0


class TestCustomMenu:
    def test_custom_menu(self):
        custom = [MenuItem("Teste", 5, False, 50, 15, 1.0)]
        m = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=0.5,
                               simulation_time=60, random_seed=42, menu=custom).run()
        assert "Teste" in m["items_sold"]


class TestEventLog:
    def test_events_collected(self):
        sim = AllAnticopaninoEnv(num_operators=2, client_arrival_rate=0.5,
                                 simulation_time=60, random_seed=42)
        sim.run()
        assert len(sim.events) > 0
        assert all("time" in e and "type" in e for e in sim.events)
