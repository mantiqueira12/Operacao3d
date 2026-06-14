import { describe, expect, it } from 'vitest'
import {
  classifyGap,
  clearances,
  collides,
  collisionPairs,
  collisionSet,
  isSolid,
  levelOf,
  overlapsInHeight,
  overlapsInPlane,
  stackTopBelow,
  topOf,
} from './spatial'
import type { Item } from './types'

/** Cria uma peça mínima para teste (defaults sensatos). */
function mk(over: Partial<Item> & { id: string }): Item {
  return {
    type: 'caixa',
    name: over.id,
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 1,
    color: '#000',
    ...over,
  }
}

// Casca em "L" da Loja 206 (referência), retilínea.
const L_POLY: Array<[number, number]> = [
  [0, 0],
  [2.0, 0],
  [2.0, 3.0],
  [2.6, 3.0],
  [2.6, 5.15],
  [0, 5.15],
]

describe('níveis', () => {
  it('levelOf trata ausente/negativo como 0', () => {
    expect(levelOf({ level: undefined })).toBe(0)
    expect(levelOf({ level: -2 })).toBe(0)
    expect(levelOf({ level: 0.9 })).toBe(0.9)
  })
  it('topOf = base + altura', () => {
    expect(topOf(mk({ id: 'a', level: 0.9, height: 0.4 }))).toBeCloseTo(1.3)
    expect(topOf(mk({ id: 'b', height: 1.05 }))).toBeCloseTo(1.05)
  })
})

describe('isSolid', () => {
  it('exclui marcadores (porta, extintor)', () => {
    expect(isSolid(mk({ id: 'a', type: 'forno' }))).toBe(true)
    expect(isSolid(mk({ id: 'b', type: 'porta' }))).toBe(false)
    expect(isSolid(mk({ id: 'c', type: 'extintor' }))).toBe(false)
  })
})

describe('overlapsInPlane', () => {
  it('detecta sobreposição de footprint', () => {
    const a = mk({ id: 'a', x: 0, y: 0, width: 1, depth: 1 })
    const b = mk({ id: 'b', x: 0.5, y: 0.5, width: 1, depth: 1 })
    expect(overlapsInPlane(a, b)).toBe(true)
  })
  it('encostadas (gap 0) não contam como sobreposição', () => {
    const a = mk({ id: 'a', x: 0, y: 0, width: 1, depth: 1 })
    const b = mk({ id: 'b', x: 1, y: 0, width: 1, depth: 1 })
    expect(overlapsInPlane(a, b)).toBe(false)
  })
})

describe('overlapsInHeight / collides', () => {
  const base = mk({ id: 'a', x: 0, y: 0, width: 1, depth: 1, level: 0, height: 1 })

  it('mesmo footprint e mesmo piso → colide', () => {
    const b = mk({ id: 'b', x: 0.2, y: 0.2, level: 0, height: 1 })
    expect(overlapsInHeight(base, b)).toBe(true)
    expect(collides(base, b)).toBe(true)
  })

  it('mesmo footprint mas em prateleira acima → NÃO colide', () => {
    const shelf = mk({ id: 'b', x: 0.2, y: 0.2, level: 1.5, height: 0.4 })
    expect(overlapsInPlane(base, shelf)).toBe(true)
    expect(overlapsInHeight(base, shelf)).toBe(false)
    expect(collides(base, shelf)).toBe(false)
  })

  it('empilhada exatamente no topo → faixas só se tocam, NÃO colide', () => {
    const onTop = mk({ id: 'b', x: 0.2, y: 0.2, level: 1, height: 0.5 })
    expect(collides(base, onTop)).toBe(false)
  })

  it('faixas verticais que se cruzam parcialmente → colide', () => {
    const tall = mk({ id: 'b', x: 0.2, y: 0.2, level: 0.5, height: 1 })
    expect(collides(base, tall)).toBe(true)
  })

  it('marcador (porta) nunca colide', () => {
    const door = mk({ id: 'b', type: 'porta', x: 0.2, y: 0.2, level: 0, height: 2.1 })
    expect(collides(base, door)).toBe(false)
  })
})

describe('collisionPairs / collisionSet', () => {
  it('reúne todos os pares e ids em conflito', () => {
    const items = [
      mk({ id: 'a', x: 0, y: 0, width: 1, depth: 1 }),
      mk({ id: 'b', x: 0.5, y: 0.5, width: 1, depth: 1 }), // colide com a
      mk({ id: 'c', x: 3, y: 3, width: 1, depth: 1 }), // longe
    ]
    expect(collisionPairs(items)).toHaveLength(1)
    expect(collisionSet(items)).toEqual(new Set(['a', 'b']))
  })
  it('cena sem conflito → conjunto vazio', () => {
    const items = [
      mk({ id: 'a', x: 0, y: 0 }),
      mk({ id: 'b', x: 2, y: 0 }),
    ]
    expect(collisionSet(items).size).toBe(0)
  })
})

describe('stackTopBelow', () => {
  it('retorna o topo da peça sob o mesmo footprint', () => {
    const bancada = mk({ id: 'a', x: 0, y: 0, width: 1.2, depth: 0.6, level: 0, height: 0.9 })
    const micro = mk({ id: 'b', x: 0.3, y: 0.1, width: 0.5, depth: 0.4 })
    expect(stackTopBelow(micro, [bancada, micro])).toBeCloseTo(0.9)
  })
  it('null quando não há nada abaixo', () => {
    const solo = mk({ id: 'a', x: 5, y: 5 })
    const outro = mk({ id: 'b', x: 0, y: 0 })
    expect(stackTopBelow(solo, [solo, outro])).toBeNull()
  })
})

describe('classifyGap', () => {
  it('aplica os limiares de circulação', () => {
    expect(classifyGap(0.4)).toBe('bad')
    expect(classifyGap(0.75)).toBe('warn')
    expect(classifyGap(1.2)).toBe('ok')
    expect(classifyGap(0.6)).toBe('warn') // limite inferior inclusivo no 'warn'
    expect(classifyGap(0.9)).toBe('ok')
  })
})

describe('clearances', () => {
  it('mede o vão até a parede da casca (sem vizinhos)', () => {
    // peça 1×1 no centro de uma sala 4×4
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const it = mk({ id: 'a', x: 1.5, y: 1.5, width: 1, depth: 1 })
    const cs = clearances(it, [it], room)
    const byDir = Object.fromEntries(cs.map((c) => [c.dir, c]))
    expect(byDir.left.gap).toBeCloseTo(1.5)
    expect(byDir.right.gap).toBeCloseTo(1.5)
    expect(byDir.top.gap).toBeCloseTo(1.5)
    expect(byDir.bottom.gap).toBeCloseTo(1.5)
    expect(byDir.left.target).toBe('wall')
  })

  it('mede o vão até o vizinho mais próximo (não a parede)', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const it = mk({ id: 'a', x: 1, y: 1, width: 1, depth: 1 })
    const right = mk({ id: 'b', x: 2.7, y: 1, width: 0.5, depth: 1 }) // 0,70 m à direita
    const cs = clearances(it, [it, right], room)
    const r = cs.find((c) => c.dir === 'right')!
    expect(r.gap).toBeCloseTo(0.7)
    expect(r.target).toBe('item')
    expect(r.level).toBe('warn')
  })

  it('ignora vizinhos em outro nível (não bloqueiam a circulação)', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const it = mk({ id: 'a', x: 1, y: 1, width: 1, depth: 1, level: 0, height: 1 })
    const high = mk({ id: 'b', x: 2.2, y: 1, width: 0.5, depth: 1, level: 1.5, height: 0.4 })
    const r = clearances(it, [it, high], room).find((c) => c.dir === 'right')!
    // deve medir até a parede (x=4), não até a peça alta
    expect(r.target).toBe('wall')
    expect(r.gap).toBeCloseTo(2)
  })

  it('omite o lado encostado (gap < 3 cm)', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const it = mk({ id: 'a', x: 0, y: 1, width: 1, depth: 1 }) // encostado na parede esquerda
    const cs = clearances(it, [it], room)
    expect(cs.find((c) => c.dir === 'left')).toBeUndefined()
    expect(cs.find((c) => c.dir === 'right')).toBeDefined()
  })

  it('respeita o recorte do "L": parede direita mais próxima na faixa estreita', () => {
    // peça na parte de cima do L (y < 3), onde a parede direita é x = 2.0
    const it = mk({ id: 'a', x: 0.5, y: 1, width: 1, depth: 1 })
    const r = clearances(it, [it], L_POLY).find((c) => c.dir === 'right')!
    expect(r.gap).toBeCloseTo(0.5) // 2.0 - 1.5
    expect(r.target).toBe('wall')
  })
})
