import { describe, expect, it } from 'vitest'
import { findNearestVertex, snapVertex } from './roomEdit'

const RECT: Array<[number, number]> = [
  [0, 0],
  [4, 0],
  [4, 5],
  [0, 5],
]

describe('findNearestVertex', () => {
  it('acha o vértice dentro da tolerância', () => {
    expect(findNearestVertex(RECT, 0.03, 0.04, 0.06)).toBe(0)
    expect(findNearestVertex(RECT, 3.98, 5.01, 0.06)).toBe(2)
  })
  it('retorna null quando nada está perto', () => {
    expect(findNearestVertex(RECT, 2, 2.5, 0.06)).toBeNull()
  })
  it('pega o mais próximo quando há mais de um candidato', () => {
    // (4.02, 0.4) está mais perto de [4,0] (idx 1) que de [4,5] (idx 2)
    expect(findNearestVertex(RECT, 4.02, 0.4, 0.5)).toBe(1)
  })
  it('polígono vazio devolve null', () => {
    expect(findNearestVertex([], 0, 0, 1)).toBeNull()
  })
})

describe('snapVertex', () => {
  it('encaixa x/y em outros vértices e emite uma guia por eixo', () => {
    // arrastando o vértice 2 ([4,5]) para perto do x do vértice 0 (x=0)
    const r = snapVertex(RECT, 2, 0.03, 5, [], [], 0.06)
    expect(r.x).toBe(0)
    expect(r.y).toBe(5)
    expect(r.guides.some((g) => g.orient === 'v' && g.pos === 0)).toBe(true)
  })
  it('encaixa em bordas de peças', () => {
    // x=1,98 → borda 2 (vértices vizinhos em 0/4); y=2,49 → borda 2,5 (vizinhos em 0/5)
    const r = snapVertex(RECT, 2, 1.98, 2.49, [2], [2.5], 0.06)
    expect(r.x).toBe(2)
    expect(r.y).toBe(2.5)
    expect(r.guides).toHaveLength(2)
  })
  it('sem candidato próximo mantém o ponto e não gera guias', () => {
    const r = snapVertex(RECT, 2, 2.5, 2.5, [], [], 0.06)
    expect(r).toEqual({ x: 2.5, y: 2.5, guides: [] })
  })
})
