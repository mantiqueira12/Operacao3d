import { describe, expect, it } from 'vitest'
import { baseConfig } from './defaults'
import { DAY_END, DAY_START, runSimulation, SimEngine } from './engine'
import type { SimConfig } from './types'

function cfg(over: Partial<SimConfig> = {}): SimConfig {
  return { ...baseConfig(), ...over }
}

describe('motor DES — projeto em branco (multi-projeto)', () => {
  it('cena vazia ([]) NÃO cai no DEFAULT_SCENE da 206 (sem estações-fantasma)', () => {
    const eng = new SimEngine(cfg(), [])
    expect(eng.sceneSnapshot().stations.length).toBe(0)
  })
  it('cena ausente (undefined) usa o fallback Loja 206', () => {
    const eng = new SimEngine(cfg())
    expect(eng.sceneSnapshot().stations.length).toBeGreaterThan(0)
  })
})

describe('motor DES — sanidade do dia', () => {
  const k = runSimulation(cfg({ seed: 42 }))

  it('roda o dia inteiro (10:00→22:00 = 12 h)', () => {
    expect(k.elapsedHours).toBeCloseTo(12, 1)
  })
  it('atende clientes e fatura', () => {
    expect(k.arrived).toBeGreaterThan(50)
    expect(k.served).toBeGreaterThan(20)
    expect(k.served).toBeLessThanOrEqual(k.arrived)
    expect(k.revenueNet).toBeGreaterThan(0)
    expect(k.avgTicket).toBeGreaterThan(0)
  })
  it('operadores caminham e têm utilização plausível', () => {
    expect(k.walkMetersTotal).toBeGreaterThan(0)
    expect(k.walkMetersPerOrder).toBeGreaterThan(0)
    for (const u of k.opUtilizationPct) {
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThanOrEqual(100)
    }
  })
  it('produz pães no fundo (padeiro ativo)', () => {
    expect(k.bread.baked).toBeGreaterThan(0)
    expect(k.bread.consumed).toBeGreaterThan(0)
    expect(k.bread.mode).toBe('propria')
  })
  it('percentuais ficam nos limites', () => {
    expect(k.balkPct).toBeGreaterThanOrEqual(0)
    expect(k.balkPct).toBeLessThanOrEqual(100)
    expect(k.slaPct).toBeGreaterThanOrEqual(0)
    expect(k.slaPct).toBeLessThanOrEqual(100)
  })
})

describe('motor DES — reprodutibilidade', () => {
  it('mesma seed ⇒ KPIs idênticos', () => {
    const a = runSimulation(cfg({ seed: 7 }))
    const b = runSimulation(cfg({ seed: 7 }))
    expect(a.served).toBe(b.served)
    expect(a.arrived).toBe(b.arrived)
    expect(a.revenueNet).toBe(b.revenueNet)
    expect(a.walkMetersTotal).toBe(b.walkMetersTotal)
    expect(a.bread.baked).toBe(b.bread.baked)
  })
  it('seeds diferentes ⇒ trajetórias diferentes', () => {
    const a = runSimulation(cfg({ seed: 1 }))
    const b = runSimulation(cfg({ seed: 999 }))
    // estocástico: pelo menos um KPIs de contagem difere
    expect(a.arrived !== b.arrived || a.served !== b.served).toBe(true)
  })
})

describe('motor DES — resposta a carga', () => {
  it('demanda muito maior aumenta desistência na fila', () => {
    const calmo = runSimulation(cfg({ seed: 5, rate: 12 }))
    const lotado = runSimulation(cfg({ seed: 5, rate: 120 }))
    expect(lotado.arrived).toBeGreaterThan(calmo.arrived)
    expect(lotado.balked).toBeGreaterThan(calmo.balked)
  })
})

describe('motor DES — passo de tempo', () => {
  it('avança o relógio e dispara chegadas', () => {
    const eng = new SimEngine(cfg({ seed: 3 }))
    expect(eng.simTime).toBe(DAY_START)
    for (let n = 0; n < 200; n++) {
      eng.simTime += 0.1
      eng.tick(0.1)
    }
    expect(eng.simTime).toBeGreaterThan(DAY_START)
    expect(eng.S.nextId).toBeGreaterThan(0) // já chegaram clientes
    expect(eng.simTime).toBeLessThan(DAY_END)
  })
})
