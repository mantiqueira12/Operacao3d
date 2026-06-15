import { SCALE } from './SceneLayers'
import type { Item } from '../domain'
import { doorSwingGeometry } from './doorSwingGeometry'

/**
 * Sobreposição SVG do arco de abertura de uma porta.
 *
 * Coordenadas vêm em metros de `doorSwingGeometry` e são convertidas para px
 * pela escala `SCALE`. Sem cores/estado inline — a estilização (`.door-leaf`,
 * `.door-leaf.open`, `.door-arc`) é responsabilidade do integrador via CSS.
 */
export default function DoorSwing({ item, flip }: { item: Item; flip?: boolean }) {
  const g = doorSwingGeometry(item, flip)

  return (
    <g className="door-swing">
      <line
        className="door-leaf"
        x1={g.hinge.x * SCALE}
        y1={g.hinge.y * SCALE}
        x2={g.closedEnd.x * SCALE}
        y2={g.closedEnd.y * SCALE}
      />
      <line
        className="door-leaf open"
        x1={g.hinge.x * SCALE}
        y1={g.hinge.y * SCALE}
        x2={g.openEnd.x * SCALE}
        y2={g.openEnd.y * SCALE}
      />
      <path
        className="door-arc"
        d={`M ${g.closedEnd.x * SCALE} ${g.closedEnd.y * SCALE} A ${g.radius * SCALE} ${g.radius * SCALE} 0 0 ${g.sweepFlag} ${g.openEnd.x * SCALE} ${g.openEnd.y * SCALE}`}
        fill="none"
      />
    </g>
  )
}
