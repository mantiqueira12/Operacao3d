/* Geometria da casca a partir do polígono da cena (`scene.room.polygon`), com a Loja 206
   como geometria PADRÃO. Port fiel de sim-core.js (linhas 11-37, 153-176), agora paramétrico.

   `makeGeometry(polygon)` deriva bbox, dimensões e o teste `inShell` (point-in-polygon)
   para QUALQUER casca; o motor consome `geo.*` em vez de constantes hardcoded. Os símbolos
   `ROOM/W/D/CUT_X/CUT_Y/GATE/OUT/inShell` permanecem exportados como o default da Loja 206
   (derivados de `makeGeometry(ROOM)`), preservando byte-a-byte o comportamento do 206. */

import type { SceneItem, Station } from './types'

/** Casca derivada de um polígono: bbox, dimensões e teste de pertencimento. */
export interface Geometry {
  polygon: Array<[number, number]>
  minX: number
  maxX: number
  minY: number
  maxY: number
  /** largura útil (= maxX) — compatível com o antigo `W`. */
  W: number
  /** profundidade útil (= maxY) — compatível com o antigo `D`. */
  D: number
  /** linha do portão / frente (= maxY) — compatível com o antigo `GATE`. */
  GATE: number
  /** calçada externa dos clientes (margem ao redor da bbox). */
  OUT: { x0: number; x1: number; y1: number }
  inShell(x: number, y: number): boolean
}

/** Polígono da Loja 206 (recorte em L). Geometria PADRÃO/fallback do motor. */
export const ROOM: Array<[number, number]> = [
  [0, 0],
  [2.0, 0],
  [2.0, 3.0],
  [2.6, 3.0],
  [2.6, 5.15],
  [0, 5.15],
]
export const CUT_X = 2.0
export const CUT_Y = 3.0

/**
 * Deriva a geometria da casca a partir de um polígono (vértices [x, y] em metros).
 *
 * - bbox: minX/maxX/minY/maxY; `W=maxX, D=maxY, GATE=maxY`.
 * - `OUT = { x0: minX-0.9, x1: maxX+0.9, y1: maxY+1.75 }` (calçada externa).
 *   Para o polígono da Loja 206 → `{ x0: -0.9, x1: 3.5, y1: 6.9 }` (idêntico ao antigo).
 * - `inShell(x,y)`: ray-cast point-in-polygon + guardas de bbox (x<minX || y<minY || y>maxY).
 *   Para o polígono da Loja 206 reproduz exatamente o antigo teste em L sobre a grade 0.05.
 */
export function makeGeometry(polygon: Array<[number, number]>): Geometry {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of polygon) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const W = maxX
  const D = maxY
  const GATE = maxY
  const OUT = { x0: minX - 0.9, x1: maxX + 0.9, y1: maxY + 1.75 }
  const inShell = (x: number, y: number): boolean => {
    if (x < minX || y < minY || y > maxY) return false
    if (pointInPolygon(polygon, x, y)) return true
    // Inclusão de borda: pontos sobre uma aresta contam como dentro (semântica `<=`),
    // garantindo paridade com a casca em L do 206 nos vértices/arestas da grade.
    return pointOnBoundary(polygon, x, y)
  }
  return { polygon, minX, maxX, minY, maxY, W, D, GATE, OUT, inShell }
}

/** Ray-cast clássico: true se (x,y) está estritamente dentro do polígono. */
function pointInPolygon(poly: Array<[number, number]>, x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** true se (x,y) cai sobre uma aresta do polígono (dentro de uma tolerância numérica). */
function pointOnBoundary(poly: Array<[number, number]>, x: number, y: number): boolean {
  const eps = 1e-9
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi)
    if (Math.abs(cross) > eps) continue
    if (
      x >= Math.min(xi, xj) - eps &&
      x <= Math.max(xi, xj) + eps &&
      y >= Math.min(yi, yj) - eps &&
      y <= Math.max(yi, yj) + eps
    )
      return true
  }
  return false
}

/** Geometria PADRÃO (Loja 206), derivada de `makeGeometry(ROOM)`. */
export const GEO_206: Geometry = makeGeometry(ROOM)
export const W = GEO_206.W
export const D = GEO_206.D
export const GATE = GEO_206.GATE
/** Calçada da galeria (área externa dos clientes) — Loja 206. */
export const OUT = GEO_206.OUT

export function inShell(x: number, y: number): boolean {
  return GEO_206.inShell(x, y)
}

/** Cena padrão (fallback = mesma da planta da Loja 206). */
export const DEFAULT_SCENE: SceneItem[] = [
  { t: 'caixa', n: 'Caixa · PDV', x: 0.0, y: 4.6, w: 0.77, h: 0.55 },
  { t: 'vitrine', n: 'Vitrine refrigerada', x: 0.8, y: 4.4, w: 1.7, h: 0.72 },
  { t: 'montagem', n: 'Bancada de montagem', x: 2.0, y: 3.0, w: 0.6, h: 1.25 },
  { t: 'estoque', n: 'Estoque', x: 0.08, y: 0.1, w: 1.0, h: 0.4 },
  { t: 'forno', n: 'Forno focaccia', x: 1.05, y: 0.1, w: 0.88, h: 0.7 },
  { t: 'batedeira', n: 'Batedeira de massa', x: 1.4, y: 1.05, w: 0.55, h: 0.55 },
  { t: 'estufa', n: 'Estufa de fermentação', x: 1.35, y: 1.75, w: 0.62, h: 0.75 },
  { t: 'prep', n: 'Bancada de prep', x: 0.08, y: 0.7, w: 0.58, h: 1.35 },
  { t: 'pia', n: 'Pia / lavagem', x: 0.08, y: 2.15, w: 0.58, h: 0.55 },
  { t: 'bibite', n: 'Geladeira bibite', x: 0.0, y: 3.35, w: 0.48, h: 0.7 },
  { t: 'painel', n: 'Painel de fundo (FOH/BOH)', x: 0.0, y: 2.95, w: 2.0, h: 0.1 },
]

export interface SceneDerived {
  stations: Station[]
  stById: Record<string, Station>
  blockers: SceneItem[]
  typesInScene: Array<{ type: string; label: string }>
}

/** Deriva estações, bloqueadores e tipos presentes a partir dos itens da cena. */
export function deriveScene(items: SceneItem[], capacity: Record<string, number>): SceneDerived {
  const stations: Station[] = []
  const stById: Record<string, Station> = {}
  const blockers: SceneItem[] = []
  const typesInScene: Array<{ type: string; label: string }> = []
  const seen: Record<string, boolean> = {}

  items.forEach((it, i) => {
    if (it.t === 'wall' || it.t === 'painel') {
      blockers.push(it)
      return
    }
    if (it.t === 'porta' || it.t === 'extintor') return
    const st: Station = {
      id: it.id || 'st' + i,
      type: it.t,
      name: it.n || it.t,
      x: it.x,
      y: it.y,
      w: it.w,
      h: it.h,
      cx: it.x + it.w / 2,
      cy: it.y + it.h / 2,
      color: it.color || '#9A9284',
      hz: it.hz,
      capacity: capacity[it.t] || 1,
      sp: null,
    }
    stations.push(st)
    stById[st.id] = st
    if (!seen[it.t]) {
      seen[it.t] = true
      typesInScene.push({ type: it.t, label: it.n || it.t })
    }
  })

  return { stations, stById, blockers, typesInScene }
}

/** Zona: BOH (fundo, fábrica) = cy<CUT_Y · FOH (frente, atendimento) = cy>=CUT_Y. */
export function zoneOf(st: Station): 'boh' | 'foh' {
  return st.cy < CUT_Y ? 'boh' : 'foh'
}
