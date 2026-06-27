/* Adapter: cena do editor (domínio `RestaurantScene`) → entrada do motor.

   O domínio usa nomes desambiguados (width/depth/height); o motor herda o formato cru do
   protótipo (t/n/x/y/w/h/hz). Esta é uma tradução pura de campos.

   A casca (`scene.room.polygon`) também é repassada ao motor: `sceneToSim` devolve itens
   E polígono, para o motor derivar a geometria por-projeto (`makeGeometry`). `sceneToSimItems`
   permanece para chamadores que só precisam dos itens. */

import type { Item, RestaurantScene } from '../domain/types'
import type { SceneItem } from './types'

/** Entrada do motor derivada da cena: itens (mobiliário) + polígono da casca. */
export interface SimInput {
  items: SceneItem[]
  polygon: Array<[number, number]>
}

/** Converte uma peça do domínio em item do motor (renomeio de campos). */
export function itemToSimItem(it: Item): SceneItem {
  return { id: it.id, t: it.type, n: it.name, x: it.x, y: it.y, w: it.width, h: it.depth, color: it.color, hz: it.height }
}

/** Converte a cena do editor na lista de itens consumida pelo motor (`deriveScene`). */
export function sceneToSimItems(scene: RestaurantScene): SceneItem[] {
  return scene.items.map(itemToSimItem)
}

/** Converte a cena do editor na entrada completa do motor: itens + polígono da casca. */
export function sceneToSim(scene: RestaurantScene): SimInput {
  return { items: sceneToSimItems(scene), polygon: scene.room.polygon }
}
