/* Planta para impressão — cópia estática que cabe na página. Usa um viewBox igual
   à casca (com folga para cotas), sem o pan/zoom da tela, então a planta impressa
   sempre enquadra o espaço inteiro independente do estado de navegação do editor.
   Reaproveita as mesmas camadas do editor (SceneLayers), sem interação. */

import { SCALE, SceneLayers } from './SceneLayers'
import type { RestaurantScene } from '../domain'

const EMPTY: Set<string> = new Set()
const noop = () => {}

export default function PrintPlan({ scene }: { scene: RestaurantScene }) {
  const xs = scene.room.polygon.map((p) => p[0] * SCALE)
  const ys = scene.room.polygon.map((p) => p[1] * SCALE)
  const pad = 72 // folga p/ cotas e rótulos que ficam fora da casca
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2
  return (
    <svg
      className="print-plan"
      viewBox={`${minX} ${minY} ${w} ${h}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <SceneLayers
        scene={scene}
        selectedId={null}
        zoom={1}
        collisions={EMPTY}
        outOfBounds={EMPTY}
        onItemPointerDown={noop}
        onHandleDown={noop}
        onRotate={noop}
      />
    </svg>
  )
}
