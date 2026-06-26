import type { RestaurantScene, Room, TitleBlock } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Casca retangular W×D (m). FOH ~40% da profundidade (teto 2,5 m). Base para projetos
 * novos e para o painel "Sala" — a edição livre do polígono (vértices/parede) é o próximo passo.
 */
export function makeRectangularRoom(width: number, depth: number): Room {
  const w = Math.max(1, round2(width))
  const d = Math.max(1, round2(depth))
  return {
    polygon: [
      [0, 0],
      [w, 0],
      [w, d],
      [0, d],
    ],
    labeledAreaM2: round2(w * d),
    fohDepth: Math.min(round2(d * 0.4), 2.5),
  }
}

/** Cena nova em branco: sala retangular padrão (4×5 m), sem peças. */
export function blankScene(opts?: { width?: number; depth?: number; unit?: string }): RestaurantScene {
  const titleBlock: TitleBlock = {
    project: '',
    unit: opts?.unit ?? 'Novo restaurante',
    address: '',
    responsible: '',
    dateRev: '',
  }
  return {
    room: makeRectangularRoom(opts?.width ?? 4, opts?.depth ?? 5),
    items: [],
    finishes: { floor: 'porcelanato', wall: 'panna' },
    titleBlock,
    snap: 0.05,
  }
}
