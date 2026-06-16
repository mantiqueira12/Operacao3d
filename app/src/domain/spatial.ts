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
import type { Item, RestaurantScene } from './types'
import { clearanceFor } from './catalog'

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

/* =====================================================================
   PLANTA NÍVEL ARQUITETO — circulação, zonas de trabalho, cotas e
   conformidade (sanitária SP + NBR 9050). Tudo puro, unidades em metros.
   ===================================================================== */

/** Severidade de circulação/cota (verde/laranja/vermelho). */
export type Severity = 'ok' | 'warn' | 'bad'

// Limiares de circulação (m) — sanitária SP / NBR 9050.
/** Corredor confortável (ideal de projeto). */
export const CIRC_IDEAL = 0.9
/** Mínimo aceitável: abaixo disso é `warn`. */
export const CIRC_MIN = 0.8
/** Crítico: abaixo disso é `bad`. */
export const CIRC_CRIT = 0.6
/** Piso de corredor: abaixo disso (< 0,20 m) o vão é ADJACÊNCIA — equipamentos
    essencialmente lado a lado —, não um corredor de circulação; fica fora da análise
    e do checklist para não soar alarme falso com a folga incidental entre peças
    vizinhas. De 0,20 m até CIRC_MIN é passagem estreita (sinalizada). */
export const CORRIDOR_FLOOR = 0.2
/** Diâmetro do giro acessível (cadeira de rodas), NBR 9050. */
export const TURN_CIRCLE = 1.5

/** Formata metros em pt-BR (vírgula decimal) para os textos do checklist. */
const fmtM = (v: number) => v.toFixed(2).replace('.', ',')

/** Classifica uma folga de circulação pelos limiares CIRC_*. */
export function classifyCirc(gap: number): Severity {
  if (gap < CIRC_CRIT) return 'bad'
  if (gap < CIRC_MIN) return 'warn'
  return 'ok'
}

/* ---------- (1) circulação na planta inteira ---------- */

/** Segmento de corredor (vão livre) entre duas peças/peça-parede, em metros. */
export interface CorridorSeg {
  x1: number
  y1: number
  x2: number
  y2: number
  /** vão livre do corredor (m) */
  gap: number
  level: Severity
}

/** Chave de deduplicação: arredonda para 5 cm e ordena os extremos. */
function segKey(x1: number, y1: number, x2: number, y2: number): string {
  const q = (v: number) => Math.round(v / 0.05) * 0.05
  const a: [number, number] = [q(x1), q(y1)]
  const b: [number, number] = [q(x2), q(y2)]
  // ordena os extremos para que A→B e B→A colidam na mesma chave
  const [p, qq] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a]
  return `${p[0].toFixed(2)},${p[1].toFixed(2)}|${qq[0].toFixed(2)},${qq[1].toFixed(2)}`
}

/**
 * Circulação da planta inteira: junta as folgas (`clearances`) de TODAS as peças
 * sólidas — vãos peça-vizinho e peça-parede — deduplica segmentos próximos
 * (quantização de 5 cm + extremos ordenados) e classifica pela largura do vão.
 * Foca os corredores de circulação: ignora vãos encostados (já filtrados por
 * `clearances`) e o pior caso por par (mantém o menor gap quando há duplicata).
 */
export function corridorAnalysis(scene: RestaurantScene): CorridorSeg[] {
  const poly = scene.room.polygon
  const items = scene.items
  const solids = items.filter(isSolid)
  const best = new Map<string, CorridorSeg>()
  for (const it of solids) {
    for (const c of clearances(it, items, poly)) {
      if (c.gap < CORRIDOR_FLOOR) continue // adjacência entre peças, não corredor
      const seg: CorridorSeg = {
        x1: c.from.x,
        y1: c.from.y,
        x2: c.to.x,
        y2: c.to.y,
        gap: c.gap,
        level: classifyCirc(c.gap),
      }
      const key = segKey(seg.x1, seg.y1, seg.x2, seg.y2)
      const prev = best.get(key)
      // mantém o segmento de menor vão (corredor mais apertado domina)
      if (!prev || seg.gap < prev.gap) best.set(key, seg)
    }
  }
  return [...best.values()]
}

/* ---------- (2) zonas de trabalho / segurança por peça ---------- */

export type WorkZoneKind = 'work' | 'hot' | 'door'

/** Retângulo de zona operacional/segurança de uma peça, em metros. */
export interface WorkZone {
  x: number
  y: number
  w: number
  h: number
  kind: WorkZoneKind
}

/**
 * Zonas de trabalho/segurança de uma peça (metadata por tipo vem do catálogo).
 *  - `work` (~0,90 m) e `door` (~0,60 m): faixa à FRENTE (lado +y), largura da peça.
 *  - `hot` (~0,40 m): moldura de afastamento em VOLTA da peça (forno/gás).
 * Tipos sem folga mapeada não projetam zona (lista vazia).
 */
export function workZones(item: Item): WorkZone[] {
  const meta = clearanceFor(item.type)
  if (!meta) return []
  const x = item.x
  const y = item.y
  const w = item.width
  const d = item.depth
  if (meta.kind === 'hot') {
    // moldura em volta: bbox expandida pela profundidade da folga
    const g = meta.depth
    return [{ x: x - g, y: y - g, w: w + 2 * g, h: d + 2 * g, kind: 'hot' }]
  }
  // work / door: faixa à frente (lado +y), mesma largura da peça
  return [{ x, y: y + d, w, h: meta.depth, kind: meta.kind }]
}

/* ---------- (4) cotas da peça aos vizinhos/paredes ---------- */

/** Cota dirigida da peça ao vizinho/parede mais próximo (uma por direção). */
export interface NeighborDim {
  x1: number
  y1: number
  x2: number
  y2: number
  /** distância livre (m) */
  value: number
  level: Severity
}

/**
 * Cotas da peça aos vizinhos/paredes nas 4 direções (cima/baixo/esq/dir): a menor
 * folga em cada lado, com endpoints, valor (m) e severidade pelos limiares CIRC_*.
 * Reutiliza `clearances` (mesma lógica de vão e recorte do "L"). Lados encostados
 * (< TOUCH) são omitidos, exatamente como em `clearances`.
 */
export function dimsToNeighbors(
  item: Item,
  items: Item[],
  poly: Array<[number, number]>,
): NeighborDim[] {
  return clearances(item, items, poly).map((c) => ({
    x1: c.from.x,
    y1: c.from.y,
    x2: c.to.x,
    y2: c.to.y,
    value: c.gap,
    level: classifyCirc(c.gap),
  }))
}

/* ---------- (5) checklist de conformidade ---------- */

export type ComplianceSeverity = 'info' | 'warn' | 'error'

/** Item do checklist de conformidade (sanitária SP + NBR 9050). */
export interface ComplianceIssue {
  id: string
  severity: ComplianceSeverity
  title: string
  detail: string
  /** ids das peças envolvidas */
  itemIds: string[]
}

/** Distância entre as bordas (footprints) de duas peças no plano (0 se sobrepõem). */
function edgeDistance(a: Item, b: Item): number {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0)
  const dy = Math.max(a.y - (b.y + b.depth), b.y - (a.y + a.depth), 0)
  return Math.hypot(dx, dy)
}

/**
 * Maior círculo livre (diâmetro, m) que cabe numa janela do FOH sem tocar peças
 * sólidas nem sair da casca. Heurística: varre uma grade fina de centros candidatos
 * dentro do FOH e mede a folga até a peça/borda mais próxima. Suficiente para
 * verificar o giro Ø1,50 m da NBR 9050 (não precisa do círculo ótimo exato).
 */
function largestTurnCircle(scene: RestaurantScene): number {
  const poly = scene.room.polygon
  const ys = poly.map((p) => p[1])
  const xs = poly.map((p) => p[0])
  const maxY = Math.max(...ys)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const fohDepth = scene.room.fohDepth ?? 0
  const fohTop = maxY - fohDepth // limite superior (y) do FOH
  const solids = scene.items.filter(isSolid)
  const step = 0.1
  let best = 0
  for (let cx = minX; cx <= maxX + EPS; cx += step) {
    for (let cy = fohTop; cy <= maxY + EPS; cy += step) {
      if (!pointInPolygon(cx, cy, poly)) continue
      // raio até a peça sólida mais próxima (clamp do centro à bbox da peça)
      let r = Infinity
      for (const o of solids) {
        const nx = Math.max(o.x, Math.min(cx, o.x + o.width))
        const ny = Math.max(o.y, Math.min(cy, o.y + o.depth))
        r = Math.min(r, Math.hypot(cx - nx, cy - ny))
      }
      // raio até as paredes ortogonais da bbox do FOH (esq/dir/frente).
      // O lado do BOH (fohTop) não é parede: a circulação segue para a cozinha,
      // e o painel divisor — quando presente — já entra como peça sólida acima.
      r = Math.min(r, cx - minX, maxX - cx, maxY - cy)
      if (r > best) best = r
    }
  }
  return best * 2
}

/**
 * Checklist de conformidade da cena (sanitária estadual SP — Portaria CVS 5/2013 —
 * e acessibilidade NBR 9050:2020). Cada item cita a norma no `detail` e lista as
 * peças envolvidas. Severidades: `error` (não conforme), `warn` (atenção), `info`.
 */
export function complianceChecks(scene: RestaurantScene): ComplianceIssue[] {
  const out: ComplianceIssue[] = []
  const items = scene.items
  const solids = items.filter(isSolid)

  // (a) corredores abaixo do mínimo de circulação
  const corridors = corridorAnalysis(scene)
  const bad = corridors.filter((c) => c.level === 'bad')
  const warn = corridors.filter((c) => c.level === 'warn')
  if (bad.length) {
    out.push({
      id: 'circ-critica',
      severity: 'error',
      title: 'Corredor de circulação crítico',
      detail: `Há ${bad.length} vão(s) abaixo de ${fmtM(CIRC_CRIT)} m. A circulação interna de cozinha deve permitir passagem segura (CVS 5/2013); o mínimo de projeto adotado é ${fmtM(CIRC_MIN)} m.`,
      itemIds: [],
    })
  } else if (warn.length) {
    out.push({
      id: 'circ-apertada',
      severity: 'warn',
      title: 'Corredor de circulação apertado',
      detail: `Há ${warn.length} vão(s) entre ${fmtM(CIRC_CRIT)} e ${fmtM(CIRC_MIN)} m. Recomenda-se ${fmtM(CIRC_IDEAL)} m para circulação confortável (CVS 5/2013).`,
      itemIds: [],
    })
  }

  // (b) giro acessível Ø1,50 m no FOH (área do cliente) — NBR 9050
  if ((scene.room.fohDepth ?? 0) > 0) {
    const turn = largestTurnCircle(scene)
    if (turn < TURN_CIRCLE - EPS) {
      out.push({
        id: 'giro-foh',
        severity: 'warn',
        title: 'Falta área de giro Ø1,50 m no atendimento',
        detail: `O maior círculo livre no FOH é Ø${fmtM(turn)} m; a NBR 9050 exige Ø${fmtM(TURN_CIRCLE)} m para manobra de cadeira de rodas (giro de 360°).`,
        itemIds: [],
      })
    }
  }

  // (c) forno a gás: afastamento (hot zone) livre de outras peças + exaustão
  const fornos = solids.filter((it) => it.type === 'forno')
  for (const forno of fornos) {
    const zone = workZones(forno).find((z) => z.kind === 'hot')
    if (zone) {
      const intruders = solids.filter(
        (o) =>
          o.id !== forno.id &&
          o.x < zone.x + zone.w - EPS &&
          o.x + o.width > zone.x + EPS &&
          o.y < zone.y + zone.h - EPS &&
          o.y + o.depth > zone.y + EPS,
      )
      if (intruders.length) {
        out.push({
          id: `forno-afastamento-${forno.id}`,
          severity: 'error',
          title: 'Forno (gás) sem afastamento de segurança',
          detail: `Equipamento de cocção a gás exige afastamento livre (~0,40 m) e exaustão/coifa sobre o ponto (CVS 5/2013, NR-13/NBR 14518). Há ${intruders.length} peça(s) dentro da zona de calor.`,
          itemIds: [forno.id, ...intruders.map((o) => o.id)],
        })
      }
    }
  }

  // (d) higiene: pia de lavagem distante do preparo/montagem (cruzamento de fluxo)
  const pias = solids.filter((it) => it.type === 'pia')
  const preps = solids.filter((it) => it.type === 'prep' || it.type === 'montagem')
  if (pias.length && preps.length) {
    let nearest = Infinity
    let pair: [string, string] | null = null
    for (const pia of pias) {
      for (const prep of preps) {
        const d = edgeDistance(pia, prep)
        if (d < nearest) {
          nearest = d
          pair = [pia.id, prep.id]
        }
      }
    }
    if (pair && nearest > 2.0 + EPS) {
      out.push({
        id: 'pia-distante-preparo',
        severity: 'warn',
        title: 'Pia distante da bancada de preparo',
        detail: `A pia de higienização mais próxima do preparo está a ${fmtM(nearest)} m. Boas práticas (CVS 5/2013) pedem lavatório acessível junto à manipulação para evitar contaminação cruzada.`,
        itemIds: pair,
      })
    }
  }

  // (e) ausência de pia/lavatório na cozinha (BOH) — higiene obrigatória
  if (!pias.length && (preps.length || solids.some((it) => it.type === 'forno'))) {
    out.push({
      id: 'sem-pia',
      severity: 'error',
      title: 'Cozinha sem lavatório/pia',
      detail: 'Estabelecimento de manipulação de alimentos exige lavatório exclusivo para higienização das mãos e utensílios na área de produção (CVS 5/2013).',
      itemIds: [],
    })
  }

  // (f) peças fora da casca (layout inválido) — informativo de bloqueio
  const oob = [...outOfBoundsSet(items, scene.room.polygon)]
  if (oob.length) {
    out.push({
      id: 'fora-da-casca',
      severity: 'error',
      title: 'Peça fora dos limites da planta',
      detail: `${oob.length} peça(s) ultrapassam o perímetro/recorte do espaço. Reposicione dentro da casca antes de prosseguir.`,
      itemIds: oob,
    })
  }

  // (g) colisões volumétricas remanescentes — informativo
  const cset = [...collisionSet(items)]
  if (cset.length) {
    out.push({
      id: 'colisao',
      severity: 'warn',
      title: 'Sobreposição de equipamentos',
      detail: `${cset.length} peça(s) ocupam o mesmo volume. Verifique empilhamento intencional ou ajuste o layout.`,
      itemIds: cset,
    })
  }

  return out
}
