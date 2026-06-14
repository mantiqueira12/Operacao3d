/* Geometria da casca da Loja 206 e derivação de estações a partir da cena.
   Port fiel de sim-core.js (linhas 11-37, 153-176). */

import type { SceneItem, Station } from './types'

export const ROOM: Array<[number, number]> = [
  [0, 0],
  [2.0, 0],
  [2.0, 3.0],
  [2.6, 3.0],
  [2.6, 5.15],
  [0, 5.15],
]
export const W = 2.6
export const D = 5.15
export const CUT_X = 2.0
export const CUT_Y = 3.0
export const GATE = 5.15
/** Calçada da galeria (área externa dos clientes). */
export const OUT = { x0: -0.9, x1: 3.5, y1: 6.9 }

export function inShell(x: number, y: number): boolean {
  if (x < 0 || y < 0 || y > GATE) return false
  if (y < CUT_Y) return x <= CUT_X
  return x <= W
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
