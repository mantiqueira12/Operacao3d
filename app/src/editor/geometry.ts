import type { Item } from '../domain'

/** Tamanho mínimo de uma peça (m), portado de MIN do protótipo. */
export const MIN_SIZE = 0.2

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Encaixa um valor na grade (m). */
export function snap(value: number, grid: number): number {
  if (grid <= 0) return value
  return Math.round(value / grid) * grid
}

/** Caixa envolvente de um polígono. */
export function boundsOf(polygon: Array<[number, number]>): Bounds {
  const xs = polygon.map((p) => p[0])
  const ys = polygon.map((p) => p[1])
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

/**
 * Mantém a peça dentro da caixa envolvente da casca (v1: bbox, não o polígono em L).
 * Retorna apenas {x, y} ajustados.
 */
export function clampPosition(
  x: number,
  y: number,
  width: number,
  depth: number,
  b: Bounds,
): { x: number; y: number } {
  const maxX = Math.max(b.minX, b.maxX - width)
  const maxY = Math.max(b.minY, b.maxY - depth)
  return {
    x: Math.min(Math.max(x, b.minX), maxX),
    y: Math.min(Math.max(y, b.minY), maxY),
  }
}

/** Gira a peça 90° em torno do centro, trocando width↔depth (portado de rotate90). */
export function rotated(item: Item, grid: number): Pick<Item, 'x' | 'y' | 'width' | 'depth'> {
  const cx = item.x + item.width / 2
  const cy = item.y + item.depth / 2
  return {
    x: snap(cx - item.depth / 2, grid),
    y: snap(cy - item.width / 2, grid),
    width: item.depth,
    depth: item.width,
  }
}
