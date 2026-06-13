"""
SimPy Model: All Antico Panino Fast-Casual Operation Simulator

Pipeline model com operadores fixo/volante e pedidos multi-item.

Estações (praças):
  caixa    → toma pedido, cobra
  prep     → corta ingredientes, monta base
  forno    → aquece/assa a schiacciata
  montagem → finaliza, emprata, entrega

Operadores:
  fixo    → trabalha só na sua praça
  volante → trabalha em qualquer praça conforme demanda
"""

import simpy
import random
from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class MenuItem:
    name: str
    prep_time_base: float  # minutos (tempo total de produção)
    oven_required: bool
    price: float = 0.0
    cost: float = 0.0
    probability: float = 0.25


@dataclass
class OperatorConfig:
    role: str  # "fixo" or "volante"
    station: str = ""  # para fixo: "caixa", "prep", "forno", "montagem"


@dataclass
class StationTask:
    station: str
    duration: float
    done_event: object


STATIONS = ["caixa", "prep", "forno", "montagem"]

DEFAULT_MENU = [
    MenuItem("La Spaccata", prep_time_base=8, oven_required=True, price=92.0, cost=28.0, probability=0.40),
    MenuItem("Panino Simples", prep_time_base=6, oven_required=True, price=45.0, cost=14.0, probability=0.30),
    MenuItem("Crema", prep_time_base=3, oven_required=False, price=25.0, cost=8.0, probability=0.15),
    MenuItem("Bebida", prep_time_base=1, oven_required=False, price=15.0, cost=3.0, probability=0.15),
]


class AllAnticopaninoEnv:

    def __init__(self,
                 num_operators: int = 2,
                 client_arrival_rate: float = 2.0,
                 simulation_time: float = 480,
                 random_seed: int = 42,
                 menu: Optional[List[MenuItem]] = None,
                 num_ovens: int = 1,
                 oven_time_pct: float = 0.5,
                 demand_profile: Optional[Dict[int, float]] = None,
                 start_hour: int = 10,
                 operators_config: Optional[List[OperatorConfig]] = None,
                 caixa_time: float = 1.5,
                 montagem_time: float = 1.5,
                 multi_item_probs: Optional[List[float]] = None):

        if simulation_time <= 0:
            raise ValueError(f"simulation_time deve ser > 0, recebeu {simulation_time}")
        if client_arrival_rate <= 0 and demand_profile is None:
            raise ValueError(f"client_arrival_rate deve ser > 0, recebeu {client_arrival_rate}")
        if num_ovens < 1:
            raise ValueError(f"num_ovens deve ser >= 1, recebeu {num_ovens}")

        if operators_config is None:
            if num_operators < 1:
                raise ValueError(f"num_operators deve ser >= 1, recebeu {num_operators}")
            operators_config = [OperatorConfig("volante") for _ in range(num_operators)]

        has_volante = any(op.role == "volante" for op in operators_config)
        if not has_volante:
            fixo_stations = {op.station for op in operators_config if op.role == "fixo"}
            missing = set(STATIONS) - fixo_stations
            if missing:
                raise ValueError(f"Sem volante, faltam fixos em: {', '.join(missing)}")

        self.env = simpy.Environment()
        self.operators_config = operators_config
        self.num_operators = len(operators_config)
        self.client_arrival_rate = client_arrival_rate
        self.simulation_time = simulation_time
        self.num_ovens = num_ovens
        self.oven_time_pct = oven_time_pct
        self.demand_profile = demand_profile
        self.start_hour = start_hour
        self.caixa_time = caixa_time
        self.montagem_time = montagem_time
        self.multi_item_probs = multi_item_probs

        random.seed(random_seed)

        self.oven = simpy.Resource(self.env, num_ovens)
        self.task_queue = simpy.FilterStore(self.env)

        self.menu = list(menu) if menu else list(DEFAULT_MENU)
        self._normalize_probabilities()

        self.stats = {
            "num_clients_served": 0,
            "num_clients_arrived": 0,
            "num_clients_balked": 0,
            "num_clients_in_progress": 0,
            "total_service_time": 0,
            "oven_busy_time": 0,
            "total_revenue": 0.0,
            "total_cost": 0.0,
            "items_sold": {},
            "total_items_count": 0,
        }

        self.op_stats = [
            {"busy_time": 0.0, "tasks": 0, "role": op.role, "station": op.station}
            for op in operators_config
        ]
        self.station_stats = {s: {"busy_time": 0.0, "tasks": 0} for s in STATIONS}
        self.events = []

        for i, op in enumerate(operators_config):
            self.env.process(self._operator_loop(i, op.role, op.station))

    def _normalize_probabilities(self):
        total = sum(item.probability for item in self.menu)
        if total > 0 and abs(total - 1.0) > 0.01:
            for item in self.menu:
                item.probability /= total

    def add_event(self, timestamp, event_type, details):
        self.events.append({"time": round(timestamp, 2), "type": event_type, "details": details})

    def _get_current_arrival_rate(self):
        if not self.demand_profile:
            return self.client_arrival_rate
        current_hour = self.start_hour + int(self.env.now / 60)
        return self.demand_profile.get(current_hour, self.client_arrival_rate)

    # ----- operator processes -----

    def _operator_loop(self, op_id, role, station):
        while True:
            if role == "fixo" and station:
                task = yield self.task_queue.get(lambda t, s=station: t.station == s)
            else:
                task = yield self.task_queue.get()

            yield self.env.timeout(task.duration)

            self.op_stats[op_id]["busy_time"] += task.duration
            self.op_stats[op_id]["tasks"] += 1
            self.station_stats[task.station]["busy_time"] += task.duration
            self.station_stats[task.station]["tasks"] += 1

            task.done_event.succeed()

    def _submit_and_wait(self, station, duration):
        done = self.env.event()
        self.task_queue.put(StationTask(station, duration, done))
        yield done

    # ----- item pipeline -----

    def _process_item(self, item, item_done):
        variation = random.uniform(0.8, 1.2)

        if item.prep_time_base > 1:
            if item.oven_required:
                prep_time = item.prep_time_base * (1 - self.oven_time_pct) * variation
            else:
                prep_time = item.prep_time_base * 0.8 * variation
            yield from self._submit_and_wait("prep", prep_time)

        if item.oven_required:
            oven_req = self.oven.request()
            yield oven_req
            forno_time = item.prep_time_base * self.oven_time_pct * variation
            yield from self._submit_and_wait("forno", forno_time)
            self.oven.release(oven_req)
            self.stats["oven_busy_time"] += forno_time

        mont_time = self.montagem_time if item.prep_time_base > 1 else 0.5
        yield from self._submit_and_wait("montagem", mont_time)

        item_done.succeed()

    # ----- customer process -----

    def customer_process(self, customer_id):
        arrival_time = self.env.now
        self.add_event(arrival_time, "ARRIVAL", f"Cliente #{customer_id} chegou")

        customers_ahead = self.stats["num_clients_in_progress"]
        estimated_wait = customers_ahead * 5 / max(self.num_operators, 1)
        if estimated_wait > 15:
            self.add_event(arrival_time, "BALKING", f"Cliente #{customer_id} desistiu")
            self.stats["num_clients_balked"] += 1
            return

        self.stats["num_clients_in_progress"] += 1

        items = self._generate_order()
        self.stats["total_items_count"] += len(items)

        yield from self._submit_and_wait("caixa", self.caixa_time)

        self.add_event(self.env.now, "ORDER",
                       f"Cliente #{customer_id}: {', '.join(i.name for i in items)}")

        item_events = []
        for item in items:
            done = self.env.event()
            item_events.append(done)
            self.env.process(self._process_item(item, done))
        yield simpy.events.AllOf(self.env, item_events)

        service_time = self.env.now - arrival_time
        revenue = sum(it.price for it in items)
        cost = sum(it.cost for it in items)

        self.stats["total_service_time"] += service_time
        self.stats["total_revenue"] += revenue
        self.stats["total_cost"] += cost
        for it in items:
            self.stats["items_sold"][it.name] = self.stats["items_sold"].get(it.name, 0) + 1

        self.stats["num_clients_in_progress"] -= 1
        self.stats["num_clients_served"] += 1

        self.add_event(self.env.now, "SERVED",
                       f"Cliente #{customer_id} servido ({len(items)} itens, R${revenue:.0f})")

    # ----- order generation -----

    def _generate_order(self) -> List[MenuItem]:
        if self.multi_item_probs:
            num_main = random.choices(
                range(1, len(self.multi_item_probs) + 1),
                weights=self.multi_item_probs,
            )[0]
        else:
            num_main = 1

        items = []
        for _ in range(num_main):
            rand = random.random()
            cumulative = 0.0
            selected = self.menu[-1]
            for menu_item in self.menu:
                cumulative += menu_item.probability
                if rand < cumulative:
                    selected = menu_item
                    break
            items.append(selected)

        has_panino = any(it.oven_required for it in items)
        if has_panino and random.random() < 0.7:
            beverages = [m for m in self.menu if not m.oven_required and m.prep_time_base <= 1]
            if beverages:
                items.append(random.choice(beverages))

        return items

    # ----- arrival generator -----

    def client_generator(self):
        customer_id = 0
        while True:
            rate = self._get_current_arrival_rate()
            if rate <= 0:
                yield self.env.timeout(1)
                continue
            inter_arrival = random.expovariate(rate)
            yield self.env.timeout(inter_arrival)
            customer_id += 1
            self.stats["num_clients_arrived"] += 1
            self.env.process(self.customer_process(customer_id))

    # ----- run -----

    def run(self) -> Dict:
        self.env.process(self.client_generator())
        self.env.run(until=self.simulation_time)
        return self.get_metrics()

    # ----- metrics -----

    def get_metrics(self) -> Dict:
        served = self.stats["num_clients_served"]
        arrived = self.stats["num_clients_arrived"]
        balked = self.stats["num_clients_balked"]
        in_progress = self.stats["num_clients_in_progress"]

        avg_wait = self.stats["total_service_time"] / served if served > 0 else 0
        avg_prep = avg_wait

        total_op_capacity = self.num_operators * self.simulation_time
        total_op_busy = sum(op["busy_time"] for op in self.op_stats)
        operator_util = total_op_busy / total_op_capacity if total_op_capacity > 0 else 0

        oven_util = self.stats["oven_busy_time"] / (self.num_ovens * self.simulation_time) if self.simulation_time > 0 else 0

        throughput = (served / self.simulation_time) * 60 if self.simulation_time > 0 else 0
        service_rate = (served / arrived * 100) if arrived > 0 else 0

        revenue = self.stats["total_revenue"]
        cost = self.stats["total_cost"]
        ticket_medio = revenue / served if served > 0 else 0
        hours = self.simulation_time / 60
        revenue_per_hour = revenue / hours if hours > 0 else 0
        food_cost_pct = (cost / revenue * 100) if revenue > 0 else 0
        gross_margin = revenue - cost

        operators_detail = []
        for i, op in enumerate(self.op_stats):
            util = op["busy_time"] / self.simulation_time * 100 if self.simulation_time > 0 else 0
            operators_detail.append({
                "id": i + 1,
                "role": op["role"],
                "station": op["station"] or "qualquer",
                "utilization": round(min(util, 100), 1),
                "tasks": op["tasks"],
            })

        stations_detail = {}
        for station, st in self.station_stats.items():
            stations_detail[station] = {
                "busy_time": round(st["busy_time"], 1),
                "tasks": st["tasks"],
            }

        items_per_order = self.stats["total_items_count"] / served if served > 0 else 0

        return {
            "num_clients_arrived": arrived,
            "num_clients_served": served,
            "num_clients_balked": balked,
            "num_clients_in_progress": in_progress,
            "service_rate": round(service_rate, 1),
            "avg_wait_time": round(avg_wait, 2),
            "avg_prep_time": round(avg_prep, 2),
            "operator_utilization": round(min(operator_util * 100, 100), 1),
            "oven_utilization": round(min(oven_util * 100, 100), 1),
            "throughput": round(throughput, 2),
            "total_simulation_time": self.simulation_time,
            "num_ovens": self.num_ovens,
            "total_revenue": round(revenue, 2),
            "total_cost": round(cost, 2),
            "gross_margin": round(gross_margin, 2),
            "ticket_medio": round(ticket_medio, 2),
            "revenue_per_hour": round(revenue_per_hour, 2),
            "food_cost_pct": round(food_cost_pct, 1),
            "items_sold": dict(self.stats["items_sold"]),
            "items_per_order": round(items_per_order, 1),
            "operators_detail": operators_detail,
            "stations_detail": stations_detail,
        }
