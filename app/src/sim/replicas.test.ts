import { describe, expect, it } from 'vitest'
import { baseConfig } from './defaults'
import { DAY_START } from './engine'
import { crossCheckVsPython, PYTHON_GOLDEN, runReplicas } from './replicas'
import type { SimConfig } from './types'

function cfg(over: Partial<SimConfig> = {}): SimConfig {
  return { ...baseConfig(), ...over }
}

describe('runReplicas — agregação', () => {
  const rep = runReplicas(cfg({ rate: 30, ops: 2 }), { n: 6 })
  it('roda o nº pedido de réplicas com seeds distintos', () => {
    expect(rep.n).toBe(6)
    expect(new Set(rep.seeds).size).toBe(6)
    expect(rep.raw).toHaveLength(6)
  })
  it('estatísticas coerentes (min ≤ mean ≤ max, IC ≥ 0)', () => {
    for (const s of [rep.served, rep.serviceRate, rep.throughputPerHour, rep.revenueNet]) {
      expect(s.min).toBeLessThanOrEqual(s.mean)
      expect(s.mean).toBeLessThanOrEqual(s.max)
      expect(s.ci95).toBeGreaterThanOrEqual(0)
      expect(s.n).toBe(6)
    }
  })
  it('é determinístico (mesmos seeds ⇒ mesma média)', () => {
    const again = runReplicas(cfg({ rate: 30, ops: 2 }), { n: 6 })
    expect(again.served.mean).toBe(rep.served.mean)
    expect(again.revenueNet.mean).toBe(rep.revenueNet.mean)
  })
})

describe('comportamento direcional (monotonicidade sob carga)', () => {
  const calmo = runReplicas(cfg({ rate: 18, ops: 2 }), { n: 5 })
  const base = runReplicas(cfg({ rate: 30, ops: 2 }), { n: 5 })
  const cheio = runReplicas(cfg({ rate: 120, ops: 2 }), { n: 5, until: DAY_START + 480 })

  it('taxa de atendimento cai à medida que a demanda sobe', () => {
    expect(calmo.serviceRate.mean).toBeGreaterThan(base.serviceRate.mean)
    expect(base.serviceRate.mean).toBeGreaterThan(cheio.serviceRate.mean)
  })
  it('desistência na fila cresce com a demanda', () => {
    expect(cheio.balkPct.mean).toBeGreaterThan(calmo.balkPct.mean)
    expect(calmo.balkPct.mean).toBeLessThan(10)
    expect(cheio.balkPct.mean).toBeGreaterThan(30)
  })
  it('throughput satura com 2 operadores (~13–18 cli/h em qualquer carga)', () => {
    for (const r of [calmo, base, cheio]) {
      expect(r.throughputPerHour.mean).toBeGreaterThan(10)
      expect(r.throughputPerHour.mean).toBeLessThan(20)
    }
  })
})

describe('cross-check estatístico vs Python (golden)', () => {
  const report = crossCheckVsPython(cfg(), { n: 10 })

  it('passa a comparação de ordem de grandeza nos KPIs robustos', () => {
    expect(report.pass).toBe(true)
    for (const row of report.rows) expect(row.within).toBe(true)
  })

  it('throughput de saturação converge com o Python (~14 cli/h, ±35%)', () => {
    const thr = report.rows.find((r) => r.metric === 'throughputPerHour')!
    expect(Math.abs(thr.ts - PYTHON_GOLDEN.throughputPerHour.mean) / PYTHON_GOLDEN.throughputPerHour.mean).toBeLessThan(0.35)
  })

  it('sob sobrecarga, ambos perdem a maioria dos clientes (atendimento baixo)', () => {
    const sr = report.rows.find((r) => r.metric === 'serviceRate')!
    expect(sr.ts).toBeLessThan(30)
    expect(sr.ts).toBeGreaterThan(3)
  })
})
