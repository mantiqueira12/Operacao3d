/* Monte Carlo: roda N réplicas do motor com seeds diferentes e agrega os KPIs (médias,
   desvio, IC95). Base do cross-check estatístico com o golden Python.

   Por que NÃO igualdade com o Python: são modelos diferentes (DES espacial com A* × pipeline
   SimPy; cardápios e taxas distintos). A validação é DIRECIONAL/estatística — ver
   `crossCheckVsPython` e docs/STATE.md. */

import { DAY_START, runSimulation, type SimKPIs } from './engine'
import type { SceneItem, SimConfig } from './types'

export interface KpiStat {
  mean: number
  std: number // desvio-padrão amostral (n-1)
  min: number
  max: number
  ci95: number // semi-largura do IC de 95% (1.96·std/√n)
  n: number
}

export interface ReplicaResult {
  n: number
  seeds: number[]
  arrived: KpiStat
  served: KpiStat
  balkPct: KpiStat
  serviceRate: KpiStat
  throughputPerHour: KpiStat
  avgWaitMin: KpiStat
  revenueNet: KpiStat
  margin: KpiStat
  avgTicket: KpiStat
  raw: SimKPIs[]
}

export interface ReplicaOptions {
  n?: number // nº de réplicas (default 12)
  seeds?: number[] // seeds explícitos (sobrepõe n/baseSeed)
  baseSeed?: number // 1ª seed (default 1); seeds = baseSeed..baseSeed+n-1
  scene?: SceneItem[]
  dt?: number
  until?: number
}

function aggregate(vals: number[]): KpiStat {
  const n = vals.length
  const mean = vals.reduce((a, b) => a + b, 0) / n
  const variance = n > 1 ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0
  const std = Math.sqrt(variance)
  const ci95 = n > 1 ? (1.96 * std) / Math.sqrt(n) : 0
  return { mean: +mean.toFixed(3), std: +std.toFixed(3), min: Math.min(...vals), max: Math.max(...vals), ci95: +ci95.toFixed(3), n }
}

/** Roda N réplicas (seeds distintos) e devolve estatísticas agregadas dos KPIs. */
export function runReplicas(config: SimConfig, opts: ReplicaOptions = {}): ReplicaResult {
  const n = opts.n ?? 12
  const baseSeed = opts.baseSeed ?? 1
  const seeds = opts.seeds ?? Array.from({ length: n }, (_, i) => baseSeed + i)
  const raw = seeds.map((seed) => runSimulation({ ...config, seed }, opts.scene, { dt: opts.dt, until: opts.until }))
  const pick = (f: (k: SimKPIs) => number) => aggregate(raw.map(f))
  return {
    n: seeds.length,
    seeds,
    arrived: pick((k) => k.arrived),
    served: pick((k) => k.served),
    balkPct: pick((k) => k.balkPct),
    serviceRate: pick((k) => k.serviceRate),
    throughputPerHour: pick((k) => k.throughputPerHour),
    avgWaitMin: pick((k) => k.avgWaitMin),
    revenueNet: pick((k) => k.revenueNet),
    margin: pick((k) => k.margin),
    avgTicket: pick((k) => k.avgTicket),
    raw,
  }
}

/* ----------------------------------------------------------- cross-check Python */

/** Cenário Python comparável: sobrecarga (taxa 120/h, 8 h, 2 operadores). */
export const PYTHON_SCENARIO = { ratePerHour: 120, hours: 8, operators: 2, menuItems: 4 }

/**
 * Golden do simulador Python (SimPy), 20 réplicas do cenário base de sobrecarga
 * (rate 2/min=120/h, 480min=8h, 2 ops, cardápio de 4 itens). Reproduzido em 2026-06-14:
 *   cd prototype/python-simulator && python3 -c "from src.simulation import AllAnticopaninoEnv; ..."
 * É um MODELO DIFERENTE do motor TS — usado só para comparação direcional/ordem de grandeza.
 */
export const PYTHON_GOLDEN = {
  served: { mean: 110.3, std: 5.3 },
  serviceRate: { mean: 11.5, std: 0.9 },
  throughputPerHour: { mean: 13.8, std: 0.7 },
  revenue: { mean: 6948, std: 137 },
}

export interface CrossCheckRow {
  metric: string
  ts: number
  python: number
  ratio: number // ts / python
  tol: number
  within: boolean
}

export interface CrossCheckReport {
  scenario: typeof PYTHON_SCENARIO
  rows: CrossCheckRow[]
  pass: boolean
}

/**
 * Roda o motor TS no cenário comparável ao Python e mede a concordância de ordem de grandeza
 * dos KPIs robustos (throughput de saturação, taxa de atendimento, servidos). Tolerância
 * relativa larga (default 0.5) porque os modelos são diferentes — o que se valida é que ambos
 * convergem para a MESMA capacidade operacional (~14 cli/h com 2 operadores) sob sobrecarga.
 */
export function crossCheckVsPython(config: SimConfig, opts: { n?: number; tol?: number } = {}): CrossCheckReport {
  const tol = opts.tol ?? 0.5
  const until = DAY_START + PYTHON_SCENARIO.hours * 60
  const rep = runReplicas({ ...config, rate: PYTHON_SCENARIO.ratePerHour, ops: PYTHON_SCENARIO.operators }, { n: opts.n ?? 12, until })
  const mk = (metric: string, ts: number, python: number, t = tol): CrossCheckRow => {
    const ratio = python !== 0 ? ts / python : 0
    return { metric, ts: +ts.toFixed(2), python, ratio: +ratio.toFixed(2), tol: t, within: Math.abs(ts - python) / python <= t }
  }
  const rows: CrossCheckRow[] = [
    mk('throughputPerHour', rep.throughputPerHour.mean, PYTHON_GOLDEN.throughputPerHour.mean),
    mk('serviceRate', rep.serviceRate.mean, PYTHON_GOLDEN.serviceRate.mean),
    mk('served', rep.served.mean, PYTHON_GOLDEN.served.mean),
  ]
  return { scenario: PYTHON_SCENARIO, rows, pass: rows.every((r) => r.within) }
}
