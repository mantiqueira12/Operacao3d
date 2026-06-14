/* Adapter: cena do editor (domínio `RestaurantScene`) → itens do motor (`SceneItem[]`).

   O domínio usa nomes desambiguados (width/depth/height); o motor herda o formato cru do
   protótipo (t/n/x/y/w/h/hz). Esta é uma tradução pura de campos.

   DÍVIDA conhecida: o motor ainda usa a casca em L da Loja 206 hardcoded (`sim/geometry.ts`),
   não o `scene.room.polygon`. Logo, por ora, só cenas com a geometria da Loja 206 navegam
   corretamente; trocar a casca por-projeto é trabalho futuro. */

import type { Item, RestaurantScene } from '../domain/types'
import type { SceneItem } from './types'

/** Converte uma peça do domínio em item do motor (renomeio de campos). */
export function itemToSimItem(it: Item): SceneItem {
  return { id: it.id, t: it.type, n: it.name, x: it.x, y: it.y, w: it.width, h: it.depth, color: it.color, hz: it.height }
}

/** Converte a cena do editor na lista de itens consumida pelo motor (`deriveScene`). */
export function sceneToSimItems(scene: RestaurantScene): SceneItem[] {
  return scene.items.map(itemToSimItem)
}
