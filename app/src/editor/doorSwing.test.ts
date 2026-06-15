import { describe, expect, it } from 'vitest'
import { doorSwingGeometry } from './doorSwingGeometry'

/** Distância euclidiana entre dois pontos. */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('doorSwingGeometry — porta horizontal', () => {
  it('dobradiça à esquerda e ponta fechada à direita (padrão)', () => {
    const g = doorSwingGeometry({ x: 0, y: 0, width: 0.8, depth: 0.12 })
    expect(g.hinge.x).toBeCloseTo(0)
    expect(g.hinge.y).toBeCloseTo(0)
    expect(g.closedEnd.x).toBeCloseTo(0.8)
    expect(g.closedEnd.y).toBeCloseTo(0)
    expect(g.radius).toBeCloseTo(0.8)
  })

  it('ponta aberta fica a um raio da dobradiça e perpendicular à folha fechada', () => {
    const g = doorSwingGeometry({ x: 0, y: 0, width: 0.8, depth: 0.12 })
    // a folha aberta tem o mesmo comprimento (raio) da fechada
    expect(dist(g.hinge, g.openEnd)).toBeCloseTo(0.8)
    // perpendicular: folha fechada ao longo de +x, folha aberta ao longo de +y
    expect(g.openEnd.x).toBeCloseTo(0)
    expect(g.openEnd.y).toBeCloseTo(0.8)
  })

  it('flip move a dobradiça para a ponta oposta', () => {
    const g = doorSwingGeometry({ x: 0, y: 0, width: 0.8, depth: 0.12 }, true)
    expect(g.hinge.x).toBeCloseTo(0.8)
    expect(g.hinge.y).toBeCloseTo(0)
    expect(g.closedEnd.x).toBeCloseTo(0)
    expect(g.closedEnd.y).toBeCloseTo(0)
    expect(dist(g.hinge, g.openEnd)).toBeCloseTo(0.8)
  })
})

describe('doorSwingGeometry — porta vertical', () => {
  it('dobradiça no topo e ponta fechada na base (padrão)', () => {
    const g = doorSwingGeometry({ x: 0, y: 0, width: 0.12, depth: 0.8 })
    expect(g.hinge.x).toBeCloseTo(0)
    expect(g.hinge.y).toBeCloseTo(0)
    expect(g.closedEnd.x).toBeCloseTo(0)
    expect(g.closedEnd.y).toBeCloseTo(0.8)
    expect(g.radius).toBeCloseTo(0.8)
    // abre para dentro (+x), perpendicular à folha vertical
    expect(g.openEnd.x).toBeCloseTo(0.8)
    expect(g.openEnd.y).toBeCloseTo(0)
    expect(dist(g.hinge, g.openEnd)).toBeCloseTo(0.8)
  })

  it('flip move a dobradiça para a base', () => {
    const g = doorSwingGeometry({ x: 0, y: 0, width: 0.12, depth: 0.8 }, true)
    expect(g.hinge.x).toBeCloseTo(0)
    expect(g.hinge.y).toBeCloseTo(0.8)
    expect(g.closedEnd.x).toBeCloseTo(0)
    expect(g.closedEnd.y).toBeCloseTo(0)
  })
})
