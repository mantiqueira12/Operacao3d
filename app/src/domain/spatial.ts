/**
 * Geometria espacial das peças: níveis (elevação base), colisão volumétrica e
 * folgas/cotas de circulação (vãos para vizinhos e paredes).
 *
 * Tudo puro e testável. Unidades em metros. O plano usa (x, y); a vertical usa
 * `level` (base) … `level + height` (topo). Duas peças só colidem se ocupam o
 * mesmo volume — sobrepõem-se no plano E nas faixas de altura. Isso permite
 * empilhar (uma sobre a outra) e pôr em prateleira sem falso conflito.
 *
 * Premissa de `clearances`: a casca é retilínea/ortogonal (retângulo ou "L"),
 * como nas plantas reais do projeto. As paredes são as arestas do polígono.
 */
import type { Item } from './types'

const EPS = 1e-3

/** Tipos que NÃO participam de colisão/folga (marcadores ou itens de parede). */
const NON_SOLID = new Set(['porta', 'extintor'])

/** Limiares de circulação (m), portados do protótipo. */
export const GAP_BAD = 0.6 // < 0,60 m: circulação crítica (vermelho)
export const GAP_WARN = 0.9 // < 0,90 m: circulação apertada (laranja)
export const TOUCH = 0.03 // < 3 cm: encostado — não cotamos

export type GapLevel = 'bad' | 'warn' | 'ok'

export function classifyGap(gap: number): GapLevel {
  if (gap < GAP_BAD) return 'bad'
  if (gap < GAP_WARN) return 'warn'
  return 'ok'
}

/** Elevação da base da peça (m). Ausente/negativo = 0 (no piso). */
export function levelOf(it: Pick<Item, 'level'>): number {
  return Math.max(0, it.level ?? 0)
}

/** Topo da peça (m) = base + altura. */
export function topOf(it: Item): number {
  return levelOf(it) + Math.max(0, it.height)
}

/** A peça é um volume sólido (participa de colisão/folga)? */
export function isSolid(it: Item): boolean {
  return !NON_SOLID.has(it.type)
}

/** Sobreposição 1D (negativa/zero = sem sobreposição). */
function span(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

/** Sobrepõem-se no plano (footprint)? */
export function overlapsInPlane(a: Item, b: Item): boolean {
  return (
    span(a.x, a.x + a.width, b.x, b.x + b.width) > EPS &&
    span(a.y, a.y + a.depth, b.y, b.y + b.depth) > EPS
  )
}

/** As faixas verticais [base, topo] se cruzam? */
export function overlapsInHeight(a: Item, b: Item): boolean {
  return span(levelOf(a), topOf(a), levelOf(b), topOf(b)) > EPS
}

/** Colisão real: as duas peças ocupam o mesmo volume (plano ∩ altura). */
export function collides(a: Item, b: Item): boolean {
  return isSolid(a) && isSolid(b) && overlapsInPlane(a, b) && overlapsInHeight(a, b)
}

export interface CollisionPair {
  a: Item
  b: Item
}

/** Todos os pares de peças que ocupam o mesmo volume. */
export function collisionPairs(items: Item[]): CollisionPair[] {
  const pairs: CollisionPair[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (collides(items[i], items[j])) pairs.push({ a: items[i], b: items[j] })
    }
  }
  return pairs
}

/** Conjunto de ids em conflito (para destaque visual ao vivo). */
export function collisionSet(items: Item[]): Set<string> {
  const out = new Set<string>()
  for (const { a, b } of collisionPairs(items)) {
    out.add(a.id)
    out.add(b.id)
  }
  return out
}

/**
 * Topo máximo das peças sólidas sob esta (mesmo footprint), p/ "empilhar em cima".
 * `null` se não houver nada abaixo para apoiar.
 */
export function stackTopBelow(it: Item, items: Item[]): number | null {
  const below = items.filter((o) => o.id !== it.id && isSolid(o) && overlapsInPlane(it, o))
  if (!below.length) return null
  return Math.max(...below.map((o) => topOf(o)))
}

/* ---------- folgas / cotas de circulação ---------- */

export type Dir = 'left' | 'right' | 'top' | 'bottom'

export interface Clearance {
  dir: Dir
  /** vão livre em metros */
  gap: number
  /** extremos da linha de cota, em metros */
  from: { x: number; y: number }
  to: { x: number; y: number }
  /** o que limita o vão */
  target: 'wall' | 'item'
  level: GapLevel
}

interface VEdge {
  x: number
  y0: number
  y1: number
}
interface HEdge {
  y: number
  x0: number
  x1: number
}

/** Arestas verticais/horizontais do polígono (casca ortogonal). */
function polyEdges(poly: Array<[number, number]>): { v: VEdge[]; h: HEdge[] } {
  const v: VEdge[] = []
  const h: HEdge[] = []
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    if (Math.abs(x1 - x2) < EPS && Math.abs(y1 - y2) > EPS) {
      v.push({ x: x1, y0: Math.min(y1, y2), y1: Math.max(y1, y2) })
    } else if (Math.abs(y1 - y2) < EPS && Math.abs(x1 - x2) > EPS) {
      h.push({ y: y1, x0: Math.min(x1, x2), x1: Math.max(x1, x2) })
    }
  }
  return { v, h }
}

/**
 * Folgas (vãos) da peça para o vizinho/parede mais próximo em cada direção.
 * Considera apenas obstáculos que cruzam a faixa de altura da peça — um objeto
 * numa prateleira alta não bloqueia a circulação no piso. Retorna no máximo 4
 * cotas (uma por lado), omitindo as que estão encostadas (< TOUCH).
 */
export function clearances(
  item: Item,
  items: Item[],
  poly: Array<[number, number]>,
): Clearance[] {
  const x0 = item.x
  const y0 = item.y
  const x1 = item.x + item.width
  const y1 = item.y + item.depth
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const { v, h } = polyEdges(poly)
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const obstacles = items.filter(
    (o) => o.id !== item.id && isSolid(o) && overlapsInHeight(o, item),
  )

  function leftRight(side: 'left' | 'right'): Clearance | null {
    // parede da casca dentro da faixa perpendicular (y) da peça
    let wall = side === 'left' ? minX : maxX
    for (const e of v) {
      if (span(e.y0, e.y1, y0, y1) <= EPS) continue
      if (side === 'left' && e.x <= x0 + EPS) wall = Math.max(wall, e.x)
      if (side === 'right' && e.x >= x1 - EPS) wall = Math.min(wall, e.x)
    }
    let edge = wall
    let target: 'wall' | 'item' = 'wall'
    for (const o of obstacles) {
      if (span(o.y, o.y + o.depth, y0, y1) <= EPS) continue
      if (side === 'left' && o.x + o.width <= x0 + EPS && o.x + o.width > edge) {
        edge = o.x + o.width
        target = 'item'
      }
      if (side === 'right' && o.x >= x1 - EPS && o.x < edge) {
        edge = o.x
        target = 'item'
      }
    }
    const gap = side === 'left' ? x0 - edge : edge - x1
    if (gap < TOUCH) return null
    return {
      dir: side,
      gap,
      from: side === 'left' ? { x: edge, y: cy } : { x: x1, y: cy },
      to: side === 'left' ? { x: x0, y: cy } : { x: edge, y: cy },
      target,
      level: classifyGap(gap),
    }
  }

  function topBottom(side: 'top' | 'bottom'): Clearance | null {
    let wall = side === 'top' ? minY : maxY
    for (const e of h) {
      if (span(e.x0, e.x1, x0, x1) <= EPS) continue
      if (side === 'top' && e.y <= y0 + EPS) wall = Math.max(wall, e.y)
      if (side === 'bottom' && e.y >= y1 - EPS) wall = Math.min(wall, e.y)
    }
    let edge = wall
    let target: 'wall' | 'item' = 'wall'
    for (const o of obstacles) {
      if (span(o.x, o.x + o.width, x0, x1) <= EPS) continue
      if (side === 'top' && o.y + o.depth <= y0 + EPS && o.y + o.depth > edge) {
        edge = o.y + o.depth
        target = 'item'
      }
      if (side === 'bottom' && o.y >= y1 - EPS && o.y < edge) {
        edge = o.y
        target = 'item'
      }
    }
    const gap = side === 'top' ? y0 - edge : edge - y1
    if (gap < TOUCH) return null
    return {
      dir: side,
      gap,
      from: side === 'top' ? { x: cx, y: edge } : { x: cx, y: y1 },
      to: side === 'top' ? { x: cx, y: y0 } : { x: cx, y: edge },
      target,
      level: classifyGap(gap),
    }
  }

  return [leftRight('left'), leftRight('right'), topBottom('top'), topBottom('bottom')].filter(
    (c): c is Clearance => c !== null,
  )
}

/* ---------- contenção na casca (peça fora do polígono) ---------- */

/** Ponto dentro do polígono (ray casting par/ímpar). */
export function pointInPolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * O footprint da peça está inteiramente dentro da casca? Amostra cantos, meios das
 * arestas e o centro, com leve recuo (1 cm) para tolerar encostar na parede. Adequado
 * a cascas ortogonais (retângulo / "L"), as do projeto.
 */
export function footprintInside(item: Item, poly: Array<[number, number]>): boolean {
  const e = 0.01
  const x0 = item.x
  const y0 = item.y
  const x1 = item.x + item.width
  const y1 = item.y + item.depth
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const pts: Array<[number, number]> = [
    [x0, y0], [x1, y0], [x0, y1], [x1, y1],
    [cx, y0], [cx, y1], [x0, cy], [x1, cy],
    [cx, cy],
  ]
  for (const [px, py] of pts) {
    const ix = px + Math.sign(cx - px) * Math.min(e, Math.abs(cx - px))
    const iy = py + Math.sign(cy - py) * Math.min(e, Math.abs(cy - py))
    if (!pointInPolygon(ix, iy, poly)) return false
  }
  return true
}

/** Ids das peças sólidas cujo footprint sai da casca (layout inválido). */
export function outOfBoundsSet(items: Item[], poly: Array<[number, number]>): Set<string> {
  const out = new Set<string>()
  for (const it of items) {
    if (!isSolid(it)) continue
    if (!footprintInside(it, poly)) out.add(it.id)
  }
  return out
}

/* ---------- clamp ao polígono (travar arraste dentro da casca) ---------- */

interface Cell {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Células da grade do polígono cujo centro cai FORA dele (regiões proibidas, ex.: recorte do "L"). */
function forbiddenCells(poly: Array<[number, number]>): Cell[] {
  const xs = [...new Set(poly.map((p) => p[0]))].sort((a, b) => a - b)
  const ys = [...new Set(poly.map((p) => p[1]))].sort((a, b) => a - b)
  const out: Cell[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2
      const cy = (ys[j] + ys[j + 1]) / 2
      if (!pointInPolygon(cx, cy, poly)) out.push({ x0: xs[i], y0: ys[j], x1: xs[i + 1], y1: ys[j + 1] })
    }
  }
  return out
}

/**
 * Posição mais próxima de (x, y) que mantém o footprint (w×d) dentro da casca
 * ortogonal (retângulo/"L"). Prende à bbox e depois empurra para fora das regiões
 * proibidas (o recorte do "L") pela borda mais próxima. Se a peça não couber fora do
 * recorte, devolve o clamp na bbox (e a sinalização "fora-da-casca" assume).
 */
export function clampToPolygon(
  x: number,
  y: number,
  w: number,
  d: number,
  poly: Array<[number, number]>,
): { x: number; y: number } {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const clampBbox = (px: number, py: number) => ({
    x: Math.min(Math.max(px, minX), Math.max(minX, maxX - w)),
    y: Math.min(Math.max(py, minY), Math.max(minY, maxY - d)),
  })
  let { x: cx, y: cy } = clampBbox(x, y)
  const forb = forbiddenCells(poly)
  for (let iter = 0; iter < 6; iter++) {
    let worst: { cell: Cell; area: number } | null = null
    for (const f of forb) {
      const ox = Math.min(cx + w, f.x1) - Math.max(cx, f.x0)
      const oy = Math.min(cy + d, f.y1) - Math.max(cy, f.y0)
      if (ox > EPS && oy > EPS && (worst === null || ox * oy > worst.area)) worst = { cell: f, area: ox * oy }
    }
    if (worst === null) break
    const f = worst.cell
    const cands = [clampBbox(f.x0 - w, cy), clampBbox(f.x1, cy), clampBbox(cx, f.y0 - d), clampBbox(cx, f.y1)]
    let pick: { x: number; y: number } | null = null
    let best = Infinity
    for (const c of cands) {
      const ox = Math.min(c.x + w, f.x1) - Math.max(c.x, f.x0)
      const oy = Math.min(c.y + d, f.y1) - Math.max(c.y, f.y0)
      if (ox > EPS && oy > EPS) continue // ainda sobrepõe a célula proibida → inválido
      const dist = Math.hypot(c.x - cx, c.y - cy)
      if (dist < best) {
        best = dist
        pick = c
      }
    }
    if (pick === null) break
    cx = pick.x
    cy = pick.y
  }
  return { x: cx, y: cy }
}
