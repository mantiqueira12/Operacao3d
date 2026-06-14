/* Vista 2D ao vivo da operação: cenário estático (casca em L, estações, slots) + agentes
   animados (clientes e operadores) a partir dos frames do motor. Coordenadas em metros
   (viewBox), y para baixo — loja no topo, calçada embaixo. */

import { useMemo } from 'react'
import type { Frame, SceneSnapshot } from '../sim/engine'

/** Cor do cliente por estado. */
const CUST_COLOR: Record<string, string> = {
  entering: '#b8b0a0',
  waiting: '#2A6FDB',
  at_pdv: '#E2000F',
  waiting_pickup: '#1F8A5B',
  leaving: '#d8d2c4',
}

export default function SimView({ scene, frame }: { scene: SceneSnapshot | null; frame: Frame | null }) {
  const vb = useMemo(() => {
    if (!scene) return { minX: -1.1, minY: -0.3, w: 4.8, h: 7.4 }
    const o = scene.room.out
    const minX = o.x0 - 0.2
    const minY = -0.3
    const maxX = o.x1 + 0.2
    const maxY = o.y1 + 0.2
    return { minX, minY, w: maxX - minX, h: maxY - minY }
  }, [scene])

  if (!scene) return <div className="sim-view-empty">Inicializando cenário…</div>

  const { W, D, cutX, cutY, out } = scene.room
  // casca em L
  const shell = `${0},${0} ${cutX},${0} ${cutX},${cutY} ${W},${cutY} ${W},${D} ${0},${D}`

  return (
    <svg className="sim-svg" viewBox={`${vb.minX} ${vb.minY} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet">
      {/* calçada (área externa dos clientes) */}
      <rect x={out.x0} y={D} width={out.x1 - out.x0} height={out.y1 - D} className="sim-sidewalk" />
      {/* divisa / vão da entrada */}
      <line x1={0} y1={D} x2={W} y2={D} className="sim-gate" />
      {/* casca da loja */}
      <polygon points={shell} className="sim-shell" />

      {/* slots de fila e retirada */}
      {scene.queueSlots.map((s, i) => (
        <circle key={`q${i}`} cx={s.x} cy={s.y} r={0.05} className="sim-slot-queue" />
      ))}
      {scene.pickupSlots.map((s, i) => (
        <circle key={`p${i}`} cx={s.x} cy={s.y} r={0.05} className="sim-slot-pickup" />
      ))}

      {/* estações */}
      {scene.stations.map((st) => (
        <g key={st.id}>
          <rect x={st.x} y={st.y} width={st.w} height={st.h} rx={0.03} className="sim-station" style={{ fill: st.color }} />
          <text x={st.cx} y={st.cy} className="sim-station-lbl" fontSize={0.16}>
            {st.type}
          </text>
        </g>
      ))}

      {/* clientes */}
      {frame?.customers.map((c) => (
        <circle key={`c${c.id}`} cx={c.x} cy={c.y} r={0.12} className="sim-cust" style={{ fill: CUST_COLOR[c.state] ?? '#999' }} />
      ))}

      {/* operadores */}
      {frame?.operators.map((o) => (
        <g key={`o${o.idx}`}>
          <circle cx={o.x} cy={o.y} r={0.17} className="sim-op" style={{ fill: o.color }} />
          <text x={o.x} y={o.y} className="sim-op-lbl" fontSize={0.18}>
            {o.role === 'padeiro' ? 'P' : o.idx + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}
