import type { AlignGuide } from './SceneLayers'

/** Polígono da casca: lista de vértices [x, y] em metros. */
export type Poly = Array<[number, number]>

/**
 * Índice do vértice do polígono mais próximo de (x, y) dentro da tolerância (m),
 * ou null se nenhum estiver perto. Empate fica com o primeiro encontrado.
 */
export function findNearestVertex(poly: Poly, x: number, y: number, tol: number): number | null {
  let pick: number | null = null
  let bestD = tol
  for (let i = 0; i < poly.length; i++) {
    const d = Math.hypot(poly[i][0] - x, poly[i][1] - y)
    if (d <= bestD) {
      bestD = d
      pick = i
    }
  }
  return pick
}

/**
 * Encaixe do vértice arrastado: além da grade (aplicada antes pelo chamador), tenta
 * alinhar x/y aos OUTROS vértices da casca e às bordas das peças, dentro da tolerância.
 * Devolve o ponto ajustado e as guias (AlignGuide) a desenhar (uma por eixo encaixado).
 */
export function snapVertex(
  poly: Poly,
  idx: number,
  x: number,
  y: number,
  itemEdgesX: number[],
  itemEdgesY: number[],
  tol: number,
): { x: number; y: number; guides: AlignGuide[] } {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const otherXs = poly.flatMap((p, i) => (i === idx ? [] : [p[0]])).concat(itemEdgesX)
  const otherYs = poly.flatMap((p, i) => (i === idx ? [] : [p[1]])).concat(itemEdgesY)

  const nx = bestSnap(x, otherXs, tol)
  const ny = bestSnap(y, otherYs, tol)
  const rx = nx ?? x
  const ry = ny ?? y

  const guides: AlignGuide[] = []
  if (nx != null) guides.push({ orient: 'v', pos: nx, from: Math.min(...ys, ry), to: Math.max(...ys, ry) })
  if (ny != null) guides.push({ orient: 'h', pos: ny, from: Math.min(...xs, rx), to: Math.max(...xs, rx) })
  return { x: rx, y: ry, guides }
}

/** Candidata mais próxima dentro da tolerância (m), ou null. */
function bestSnap(v: number, cands: number[], tol: number): number | null {
  let pick: number | null = null
  let bestD = tol
  for (const c of cands) {
    const d = Math.abs(c - v)
    if (d <= bestD) {
      bestD = d
      pick = c
    }
  }
  return pick
}
