import { describe, expect, it } from 'vitest'
import {
  CIRC_CRIT,
  CIRC_IDEAL,
  CIRC_MIN,
  TURN_CIRCLE,
  classifyCirc,
  classifyGap,
  clampToPolygon,
  clearances,
  collides,
  collisionPairs,
  collisionSet,
  complianceChecks,
  corridorAnalysis,
  dimsToNeighbors,
  footprintInside,
  isSolid,
  levelOf,
  outOfBoundsSet,
  overlapsInHeight,
  overlapsInPlane,
  pointInPolygon,
  stackTopBelow,
  topOf,
  workZones,
} from './spatial'
import { loja206Scene } from './templates/loja206'
import type { Item, RestaurantScene } from './types'

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

describe('contenção na casca', () => {
  it('pointInPolygon: dentro/fora no "L"', () => {
    expect(pointInPolygon(1, 1, L_POLY)).toBe(true) // parte larga de cima
    expect(pointInPolygon(2.3, 1, L_POLY)).toBe(false) // recorte do L (y<3 só vai até x=2.0)
    expect(pointInPolygon(2.3, 4, L_POLY)).toBe(true) // parte de baixo vai até x=2.6
  })
  it('footprintInside: peça encostada no canto conta como dentro', () => {
    const it = mk({ id: 'a', x: 0, y: 0, width: 1, depth: 1 })
    expect(footprintInside(it, L_POLY)).toBe(true)
  })
  it('footprintInside: peça invadindo o recorte do "L" → fora', () => {
    const it = mk({ id: 'a', x: 1.6, y: 0.5, width: 1, depth: 0.5 }) // x até 2.6 com y<3
    expect(footprintInside(it, L_POLY)).toBe(false)
  })
  it('outOfBoundsSet reúne só as peças sólidas fora da casca', () => {
    const dentro = mk({ id: 'in', x: 0.1, y: 0.1, width: 0.5, depth: 0.5 })
    const fora = mk({ id: 'out', x: 2.2, y: 0.5, width: 0.8, depth: 0.5 })
    const porta = mk({ id: 'door', type: 'porta', x: 2.2, y: 0.5, width: 0.8, depth: 0.12 })
    expect(outOfBoundsSet([dentro, fora, porta], L_POLY)).toEqual(new Set(['out']))
  })
})

describe('clampToPolygon', () => {
  it('mantém a peça dentro de um retângulo simples', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    expect(clampToPolygon(10, 10, 1, 1, room)).toEqual({ x: 3, y: 3 })
    expect(clampToPolygon(-5, 2, 1, 1, room)).toEqual({ x: 0, y: 2 })
  })
  it('empurra a peça para fora do recorte do "L" (cola na parede x=2)', () => {
    const r = clampToPolygon(2.3, 1, 0.6, 0.6, L_POLY)
    expect(r.x + 0.6).toBeLessThanOrEqual(2.0 + 1e-6) // direita não passa de x=2
    expect(r.y).toBeCloseTo(1) // y preservado
  })
  it('peça larga na parte de baixo do "L" não é empurrada (zona permitida)', () => {
    const r = clampToPolygon(0.2, 4, 2.2, 0.5, L_POLY)
    expect(r.x).toBeCloseTo(0.2)
    expect(r.y).toBeCloseTo(4)
  })
})

/* =====================================================================
   PLANTA NÍVEL ARQUITETO
   ===================================================================== */

let idc = 0
const scene206 = (): RestaurantScene => loja206Scene(() => `p${++idc}`)

describe('classifyCirc', () => {
  it('aplica os limiares de circulação (CIRC_*)', () => {
    expect(classifyCirc(0.5)).toBe('bad') // < CIRC_CRIT (0,60)
    expect(classifyCirc(CIRC_CRIT)).toBe('warn') // 0,60 é limite inferior do warn
    expect(classifyCirc(0.7)).toBe('warn') // entre CRIT e MIN
    expect(classifyCirc(CIRC_MIN)).toBe('ok') // 0,80 já é aceitável
    expect(classifyCirc(1.2)).toBe('ok')
  })
  it('constantes na ordem esperada', () => {
    expect(CIRC_CRIT).toBeLessThan(CIRC_MIN)
    expect(CIRC_MIN).toBeLessThanOrEqual(CIRC_IDEAL)
    expect(TURN_CIRCLE).toBeCloseTo(1.5)
  })
})

describe('corridorAnalysis', () => {
  it('mede o corredor central entre duas peças (4×4)', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const a = mk({ id: 'a', x: 0, y: 1.5, width: 1, depth: 1 })
    const b = mk({ id: 'b', x: 2.0, y: 1.5, width: 1, depth: 1 }) // vão de 1,00 m entre a e b
    const segs = corridorAnalysis({ room: { polygon: room }, items: [a, b] })
    // o vão a↔b aparece uma vez (deduplicado), com gap ~1,00 (ok)
    const central = segs.find((s) => Math.abs(s.gap - 1.0) < 0.05)
    expect(central).toBeDefined()
    expect(central!.level).toBe('ok')
  })

  it('deduplica o segmento compartilhado por duas peças vizinhas', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    // duas peças encostadas nas paredes opostas, vão de 0,70 m entre elas
    const a = mk({ id: 'a', x: 0, y: 1.5, width: 1, depth: 1 })
    const b = mk({ id: 'b', x: 1.7, y: 1.5, width: 1, depth: 1 })
    const segs = corridorAnalysis({ room: { polygon: room }, items: [a, b] })
    // a→b (right de a) e b→a (left de b) descrevem o MESMO corredor → 1 segmento
    const mid = segs.filter((s) => Math.abs(s.gap - 0.7) < 0.02)
    expect(mid).toHaveLength(1)
    expect(mid[0].level).toBe('warn') // 0,70 < CIRC_MIN
  })

  it('classifica vão crítico como bad', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const a = mk({ id: 'a', x: 1, y: 1.5, width: 1, depth: 1 })
    const b = mk({ id: 'b', x: 2.4, y: 1.5, width: 1, depth: 1 }) // 0,40 m
    const segs = corridorAnalysis({ room: { polygon: room }, items: [a, b] })
    const crit = segs.find((s) => Math.abs(s.gap - 0.4) < 0.02)
    expect(crit).toBeDefined()
    expect(crit!.level).toBe('bad')
  })

  it('ignora marcadores (porta/extintor) — não geram corredor', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const a = mk({ id: 'a', x: 1, y: 1.5, width: 1, depth: 1 })
    const door = mk({ id: 'd', type: 'porta', x: 2.4, y: 1.5, width: 0.8, depth: 0.12 })
    // a porta não é sólida: a peça mede até a parede direita (x=4), não até a porta
    const withDoor = corridorAnalysis({ room: { polygon: room }, items: [a, door] })
    const right = withDoor.find((s) => Math.abs(s.y1 - 2.0) < 0.01 && s.x1 >= 2.0)
    expect(right).toBeDefined()
    expect(right!.gap).toBeCloseTo(2) // 4 - (1+1) = 2 m até a parede, ignorando a porta
  })

  it('Loja 206: produz segmentos e ao menos um corredor apertado/crítico', () => {
    const segs = corridorAnalysis(scene206())
    expect(segs.length).toBeGreaterThan(0)
    expect(segs.some((s) => s.level === 'warn' || s.level === 'bad')).toBe(true)
  })
})

describe('workZones', () => {
  it('forno → moldura de calor (hot) em volta, ~0,40 m', () => {
    const forno = mk({ id: 'f', type: 'forno', x: 1, y: 1, width: 0.9, depth: 0.7 })
    const zs = workZones(forno)
    expect(zs).toHaveLength(1)
    const z = zs[0]
    expect(z.kind).toBe('hot')
    expect(z.x).toBeCloseTo(0.6) // 1 - 0.4
    expect(z.y).toBeCloseTo(0.6)
    expect(z.w).toBeCloseTo(0.9 + 0.8)
    expect(z.h).toBeCloseTo(0.7 + 0.8)
  })

  it('geladeira/estufa/bibite → vão de porta (door) à frente (+y), ~0,60 m', () => {
    for (const type of ['geladeira', 'estufa', 'bibite']) {
      const it = mk({ id: type, type, x: 1, y: 1, width: 0.7, depth: 0.6 })
      const z = workZones(it)[0]
      expect(z.kind).toBe('door')
      expect(z.x).toBeCloseTo(1)
      expect(z.y).toBeCloseTo(1.6) // y + depth
      expect(z.w).toBeCloseTo(0.7)
      expect(z.h).toBeCloseTo(0.6)
    }
  })

  it('caixa/prep/montagem/pia → faixa de trabalho (work) à frente, ~0,90 m', () => {
    for (const type of ['caixa', 'prep', 'montagem', 'pia']) {
      const it = mk({ id: type, type, x: 0.5, y: 2, width: 1.2, depth: 0.6 })
      const z = workZones(it)[0]
      expect(z.kind).toBe('work')
      expect(z.y).toBeCloseTo(2.6) // y + depth
      expect(z.h).toBeCloseTo(0.9)
      expect(z.w).toBeCloseTo(1.2)
    }
  })

  it('tipo sem folga mapeada (lixeira/estoque/porta) → nenhuma zona', () => {
    expect(workZones(mk({ id: 'a', type: 'lixeira' }))).toEqual([])
    expect(workZones(mk({ id: 'b', type: 'estoque' }))).toEqual([])
    expect(workZones(mk({ id: 'c', type: 'porta' }))).toEqual([])
  })
})

describe('dimsToNeighbors', () => {
  it('cota até as 4 paredes (sem vizinhos), com severidade', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const it = mk({ id: 'a', x: 1.5, y: 1.5, width: 1, depth: 1 })
    const dims = dimsToNeighbors(it, [it], room)
    expect(dims).toHaveLength(4)
    for (const d of dims) {
      expect(d.value).toBeCloseTo(1.5)
      expect(d.level).toBe('ok') // 1,5 ≥ CIRC_MIN
    }
  })

  it('cota até o vizinho mais próximo e marca severidade pelo vão', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const it = mk({ id: 'a', x: 1, y: 1, width: 1, depth: 1 })
    const right = mk({ id: 'b', x: 2.5, y: 1, width: 0.5, depth: 1 }) // 0,50 m → crítico
    const dims = dimsToNeighbors(it, [it, right], room)
    const r = dims.find((d) => Math.abs(d.value - 0.5) < 0.02)!
    expect(r).toBeDefined()
    expect(r.level).toBe('bad')
  })

  it('omite o lado encostado (gap < TOUCH)', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const it = mk({ id: 'a', x: 0, y: 1, width: 1, depth: 1 }) // colado na parede esquerda
    const dims = dimsToNeighbors(it, [it], room)
    expect(dims.length).toBe(3) // sem a cota da esquerda
  })

  it('Loja 206: a peça tem ao menos uma cota dimensionada', () => {
    const scene = scene206()
    const montagem = scene.items.find((i) => i.type === 'montagem')!
    const dims = dimsToNeighbors(montagem, scene.items, scene.room.polygon)
    expect(dims.length).toBeGreaterThan(0)
  })
})

describe('complianceChecks', () => {
  it('Loja 206: detecta giro Ø1,50 m insuficiente no FOH e afastamento do forno', () => {
    const issues = complianceChecks(scene206())
    const ids = issues.map((i) => i.id)
    expect(ids).toContain('giro-foh')
    expect(issues.find((i) => i.id === 'giro-foh')!.severity).toBe('warn')
    // forno tem peças na zona de calor → afastamento não conforme
    const forno = issues.find((i) => i.id.startsWith('forno-afastamento'))
    expect(forno).toBeDefined()
    expect(forno!.severity).toBe('error')
    expect(forno!.itemIds.length).toBeGreaterThanOrEqual(2)
    // cada item cita a norma no detalhe
    for (const i of issues) expect(i.detail.length).toBeGreaterThan(0)
  })

  it('acusa cozinha sem pia/lavatório', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const prep = mk({ id: 'prep', type: 'prep', x: 1, y: 1, width: 1.4, depth: 0.6 })
    const issues = complianceChecks({ room: { polygon: room }, items: [prep] })
    expect(issues.map((i) => i.id)).toContain('sem-pia')
    expect(issues.find((i) => i.id === 'sem-pia')!.severity).toBe('error')
  })

  it('acusa pia distante (> 2 m) do preparo', () => {
    const room: Array<[number, number]> = [[0, 0], [6, 0], [6, 6], [0, 6]]
    const prep = mk({ id: 'prep', type: 'prep', x: 0, y: 0, width: 1, depth: 0.6 })
    const pia = mk({ id: 'pia', type: 'pia', x: 4, y: 4, width: 0.6, depth: 0.55 })
    const issues = complianceChecks({ room: { polygon: room }, items: [prep, pia] })
    const issue = issues.find((i) => i.id === 'pia-distante-preparo')
    expect(issue).toBeDefined()
    expect(issue!.severity).toBe('warn')
    expect(issue!.itemIds).toEqual(['pia', 'prep'])
  })

  it('pia colada ao preparo → sem alerta de distância', () => {
    const room: Array<[number, number]> = [[0, 0], [6, 0], [6, 6], [0, 6]]
    const prep = mk({ id: 'prep', type: 'prep', x: 0, y: 0, width: 1, depth: 0.6 })
    const pia = mk({ id: 'pia', type: 'pia', x: 1.1, y: 0, width: 0.6, depth: 0.55 })
    const issues = complianceChecks({ room: { polygon: room }, items: [prep, pia] })
    expect(issues.map((i) => i.id)).not.toContain('pia-distante-preparo')
  })

  it('forno com afastamento livre → sem alerta de segurança', () => {
    const room: Array<[number, number]> = [[0, 0], [6, 0], [6, 6], [0, 6]]
    const forno = mk({ id: 'forno', type: 'forno', x: 2.5, y: 2.5, width: 0.9, depth: 0.7 })
    const pia = mk({ id: 'pia', type: 'pia', x: 0, y: 0, width: 0.6, depth: 0.55 })
    const issues = complianceChecks({ room: { polygon: room }, items: [forno, pia] })
    expect(issues.map((i) => i.id).some((id) => id.startsWith('forno-afastamento'))).toBe(false)
  })

  it('sinaliza corredor crítico (< CIRC_CRIT) como erro', () => {
    const room: Array<[number, number]> = [[0, 0], [6, 0], [6, 6], [0, 6]]
    const pia = mk({ id: 'pia', type: 'pia', x: 0, y: 0, width: 0.6, depth: 0.55 })
    const a = mk({ id: 'a', type: 'prep', x: 2, y: 2, width: 1, depth: 1 })
    const b = mk({ id: 'b', type: 'apoio', x: 3.3, y: 2, width: 1, depth: 1 }) // vão 0,30 m
    const issues = complianceChecks({ room: { polygon: room }, items: [pia, a, b] })
    expect(issues.map((i) => i.id)).toContain('circ-critica')
    expect(issues.find((i) => i.id === 'circ-critica')!.severity).toBe('error')
  })

  it('cena vazia (sem produção) → sem checks de cozinha', () => {
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const issues = complianceChecks({ room: { polygon: room }, items: [] })
    expect(issues.map((i) => i.id)).not.toContain('sem-pia')
  })
})
