import { describe, expect, it } from 'vitest'
import {
  CATALOG,
  CATEGORY_COLORS,
  catalogEntries,
  createItem,
  getCatalogEntry,
  loja206Scene,
  polygonArea,
} from './index'

describe('catálogo', () => {
  it('todas as entradas têm dimensões positivas e categoria coerente', () => {
    for (const [cat, entries] of Object.entries(CATALOG)) {
      expect(entries.length).toBeGreaterThan(0)
      for (const e of entries) {
        expect(e.category).toBe(cat)
        expect(e.width).toBeGreaterThan(0)
        expect(e.depth).toBeGreaterThan(0)
        expect(e.height).toBeGreaterThan(0)
        expect(e.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })

  it('não há tipos duplicados', () => {
    const types = catalogEntries().map((e) => e.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('cor padrão deriva da categoria', () => {
    expect(getCatalogEntry('forno')?.color).toBe(CATEGORY_COLORS.cozinha)
    expect(getCatalogEntry('caixa')?.color).toBe(CATEGORY_COLORS.atendimento)
  })
})

describe('createItem', () => {
  it('usa os padrões do catálogo', () => {
    const it = createItem('forno', 'p1')
    expect(it.id).toBe('p1')
    expect(it.name).toBe('Forno focaccia')
    expect(it.width).toBe(0.9)
    expect(it.height).toBe(1.6)
  })

  it('aplica overrides', () => {
    const it = createItem('forno', 'p2', { x: 1, y: 2, color: '#000000', name: 'Forno X' })
    expect(it.x).toBe(1)
    expect(it.y).toBe(2)
    expect(it.color).toBe('#000000')
    expect(it.name).toBe('Forno X')
  })

  it('lança para tipo desconhecido', () => {
    expect(() => createItem('inexistente', 'p3')).toThrow()
  })
})

describe('polygonArea', () => {
  it('calcula área de retângulo', () => {
    expect(polygonArea([[0, 0], [2, 0], [2, 3], [0, 3]])).toBeCloseTo(6)
  })

  it('retorna 0 para menos de 3 vértices', () => {
    expect(polygonArea([[0, 0], [1, 1]])).toBe(0)
  })

  it('é invariante à orientação (horário/anti-horário)', () => {
    const cw = polygonArea([[0, 0], [0, 3], [2, 3], [2, 0]])
    expect(cw).toBeCloseTo(6)
  })
})

describe('template Loja 206', () => {
  it('gera cena com casca, itens e ids únicos', () => {
    let n = 0
    const scene = loja206Scene(() => `p${++n}`)

    expect(scene.items).toHaveLength(11)
    expect(scene.room.labeledAreaM2).toBe(11)
    const ids = scene.items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(scene.titleBlock?.unit).toBe('Loja 206')
  })

  it('área geométrica da casca bate com o esperado (~11,59 m²)', () => {
    const scene = loja206Scene(() => 'x')
    expect(polygonArea(scene.room.polygon)).toBeCloseTo(11.59, 2)
  })
})
