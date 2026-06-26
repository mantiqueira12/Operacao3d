import { describe, expect, it } from 'vitest'
import { blankScene, makeRectangularRoom } from './roomShapes'

describe('makeRectangularRoom', () => {
  it('cria um retângulo W×D com 4 vértices e área rotulada', () => {
    const r = makeRectangularRoom(4, 5)
    expect(r.polygon).toEqual([[0, 0], [4, 0], [4, 5], [0, 5]])
    expect(r.labeledAreaM2).toBe(20)
  })
  it('FOH ~40% da profundidade, com teto de 2,5 m', () => {
    expect(makeRectangularRoom(4, 5).fohDepth).toBe(2)
    expect(makeRectangularRoom(4, 10).fohDepth).toBe(2.5) // 4,0 capado em 2,5
  })
  it('garante mínimo de 1 m e arredonda a 2 casas', () => {
    const r = makeRectangularRoom(0.3, 3.333)
    expect(r.polygon[2][0]).toBe(1) // largura mínima 1 m
    expect(r.polygon[2][1]).toBe(3.33)
  })
})

describe('blankScene', () => {
  it('sala retangular padrão 4×5, sem peças, com o nome no carimbo', () => {
    const s = blankScene({ unit: 'Bistrô X' })
    expect(s.items).toHaveLength(0)
    expect(s.titleBlock?.unit).toBe('Bistrô X')
    expect(s.room.polygon).toEqual([[0, 0], [4, 0], [4, 5], [0, 5]])
  })
})
