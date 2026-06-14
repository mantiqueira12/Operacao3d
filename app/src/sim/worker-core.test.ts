import { describe, expect, it } from 'vitest'
import { runSimulation } from './engine'
import { baseConfig } from './defaults'
import { SimController, type WorkerResponse } from './worker-core'

/** Coleta as mensagens postadas por um controller. */
function harness() {
  const out: WorkerResponse[] = []
  const ctl = new SimController((m) => out.push(m))
  return { out, ctl }
}

describe('SimController — protocolo', () => {
  it('init responde "ready" com a cena estática', () => {
    const { out, ctl } = harness()
    ctl.handle({ type: 'init', config: { ...baseConfig(), seed: 42 } })
    expect(out).toHaveLength(1)
    const m = out[0]
    expect(m.type).toBe('ready')
    if (m.type === 'ready') {
      expect(m.simTime).toBe(10 * 60)
      expect(m.scene.stations.length).toBeGreaterThan(5)
      expect(m.scene.pickupSlots.length).toBe(10)
      expect(m.scene.room.W).toBeGreaterThan(0)
    }
  })

  it('run emite KPIs periódicos e termina com "done"', () => {
    const { out, ctl } = harness()
    ctl.handle({ type: 'init', config: { ...baseConfig(), seed: 42 } })
    ctl.handle({ type: 'run', kpiEvery: 60 })
    const kpis = out.filter((m) => m.type === 'kpis')
    const done = out.filter((m) => m.type === 'done')
    expect(kpis.length).toBeGreaterThan(5) // ~12 snapshots ao longo do dia
    expect(done).toHaveLength(1)
  })

  it('run reproduz exatamente o runSimulation com a mesma seed', () => {
    const { out, ctl } = harness()
    ctl.handle({ type: 'init', config: { ...baseConfig(), seed: 123 } })
    ctl.handle({ type: 'run' })
    const done = out.find((m) => m.type === 'done')
    const ref = runSimulation({ ...baseConfig(), seed: 123 })
    expect(done?.type).toBe('done')
    if (done?.type === 'done') {
      expect(done.kpis.served).toBe(ref.served)
      expect(done.kpis.revenueNet).toBe(ref.revenueNet)
      expect(done.kpis.walkMetersTotal).toBe(ref.walkMetersTotal)
    }
  })

  it('step avança o relógio e emite um frame com posições', () => {
    const { out, ctl } = harness()
    ctl.handle({ type: 'init', config: { ...baseConfig(), seed: 9 } })
    out.length = 0
    ctl.handle({ type: 'step', simMin: 90, withKpis: true })
    const frame = out.find((m) => m.type === 'frame')
    expect(frame?.type).toBe('frame')
    if (frame?.type === 'frame') {
      expect(frame.frame.simTime).toBeGreaterThan(10 * 60)
      expect(frame.frame.operators.length).toBeGreaterThan(0)
      // padeiro presente (modo própria) → há operador 'padeiro'
      expect(frame.frame.operators.some((o) => o.role === 'padeiro')).toBe(true)
    }
    expect(out.some((m) => m.type === 'kpis')).toBe(true)
  })

  it('reset volta o relógio ao início do dia', () => {
    const { out, ctl } = harness()
    ctl.handle({ type: 'init', config: { ...baseConfig(), seed: 9 } })
    ctl.handle({ type: 'step', simMin: 120 })
    out.length = 0
    ctl.handle({ type: 'reset' })
    const ready = out.find((m) => m.type === 'ready')
    expect(ready?.type).toBe('ready')
    if (ready?.type === 'ready') expect(ready.simTime).toBe(10 * 60)
  })

  it('step trava o relógio no fim do dia (22:00)', () => {
    const { out, ctl } = harness()
    ctl.handle({ type: 'init', config: { ...baseConfig(), seed: 9 } })
    out.length = 0
    ctl.handle({ type: 'step', simMin: 999 }) // bem além do fim do dia
    const frame = out.find((m) => m.type === 'frame')
    expect(frame?.type).toBe('frame')
    if (frame?.type === 'frame') expect(frame.frame.simTime).toBeLessThanOrEqual(22 * 60 + 0.1)
  })

  it('snapshot (sem init prévio) usa o cenário padrão e emite frame + KPIs', () => {
    const { out, ctl } = harness()
    ctl.handle({ type: 'snapshot' })
    expect(out.some((m) => m.type === 'frame')).toBe(true)
    expect(out.some((m) => m.type === 'kpis')).toBe(true)
  })
})
