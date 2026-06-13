import { describe, expect, it } from 'vitest'
import { boundsOf, clampPosition, rotated, snap } from './geometry'
import type { Item } from '../domain'

describe('snap', () => {
  it('encaixa na grade', () => {
    expect(snap(0.13, 0.05)).toBeCloseTo(0.15)
    expect(snap(0.12, 0.05)).toBeCloseTo(0.1)
  })
  it('grade <= 0 não altera', () => {
    expect(snap(0.137, 0)).toBe(0.137)
  })
})

describe('boundsOf', () => {
  it('calcula a caixa envolvente', () => {
    expect(boundsOf([[0, 0], [2, 0], [2.6, 3], [0, 5.15]])).toEqual({
      minX: 0,
      minY: 0,
      maxX: 2.6,
      maxY: 5.15,
    })
  })
})

describe('clampPosition', () => {
  const b = { minX: 0, minY: 0, maxX: 2.6, maxY: 5.15 }
  it('prende dentro dos limites', () => {
    expect(clampPosition(-1, -1, 1, 1, b)).toEqual({ x: 0, y: 0 })
    expect(clampPosition(10, 10, 1, 1, b)).toEqual({ x: 1.6, y: 4.15 })
  })
  it('peça maior que a casca encosta no mínimo', () => {
    expect(clampPosition(5, 5, 10, 10, b)).toEqual({ x: 0, y: 0 })
  })
})

describe('rotated', () => {
  it('troca width e depth mantendo o centro', () => {
    const item = { x: 1, y: 1, width: 2, depth: 0.5 } as Item
    const r = rotated(item, 0)
    expect(r.width).toBe(0.5)
    expect(r.depth).toBe(2)
    expect(r.x + r.width / 2).toBeCloseTo(2) // centro x preservado
    expect(r.y + r.depth / 2).toBeCloseTo(1.25) // centro y preservado
  })
})
