/** Área de um polígono simples (fórmula do cadarço), em unidades² da entrada. */
export function polygonArea(polygon: Array<[number, number]>): number {
  const n = polygon.length
  if (n < 3) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = polygon[i]
    const [x2, y2] = polygon[(i + 1) % n]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}
