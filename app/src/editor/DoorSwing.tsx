import { SCALE } from './SceneLayers'
import type { Item } from '../domain'
import { doorSwingGeometry } from './doorSwingGeometry'

const fmt = (n: number) => n.toFixed(2).replace('.', ',')

/**
 * Sobreposição SVG de uma porta de planta: batente branco preenchido (cor da
 * zona no contorno) + arco de abertura paramétrico + rótulo "porta {w}m".
 *
 * Coordenadas vêm em metros de `doorSwingGeometry` e são convertidas para px
 * pela escala `SCALE`. O swing (`.door-leaf`, `.door-leaf.open`, `.door-arc`)
 * permanece paramétrico; aqui ADICIONAMOS o retângulo do batente e o rótulo,
 * como drawDoor do protótipo (planner.js:336-348).
 */
export default function DoorSwing({ item, flip }: { item: Item; flip?: boolean }) {
  const g = doorSwingGeometry(item, flip)
  const x = item.x * SCALE
  const y = item.y * SCALE
  const w = item.width * SCALE
  const h = item.depth * SCALE

  return (
    <g className="door-swing">
      {/* batente: retângulo branco com contorno na cor da zona */}
      <rect
        className="door-jamb"
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#fff"
        stroke={item.color}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
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
      <text className="item-dim" x={x + w / 2} y={y + h + 11} fontSize={8.5}>
        porta {fmt(item.width)}m
      </text>
    </g>
  )
}
