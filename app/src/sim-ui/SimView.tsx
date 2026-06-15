/* Vista 2D ao vivo da operação: cenário estático (casca em L com parede grossa, grade de
   0,5 m, zonas FOH/BOH, estações-cartão, slots de fila/retirada) + agentes animados
   (clientes coloridos por impaciência, operadores com anel busy/wait, status flutuante e
   trilhas). Port fiel de prototype/planner/sim/sim-2d.js POR CIMA da arquitetura React.

   Convenção de unidades: o mundo é desenhado em PIXELS (1 px = 0,01 m, SCALE=100), idêntico
   ao protótipo — assim as constantes de espessura/fonte/marcadores batem 1:1. O viewBox é
   calculado em px e um <g> raiz não escala; strokes usam non-scaling-stroke onde precisa. */

import { useMemo, useRef } from 'react'
import type { EnrichedFrame, EnrichedFrameOperator, EnrichedScene } from '../sim/worker-core'

const SCALE = 100
const px = (m: number) => m * SCALE

/** Tokens com fallback (o agente de tokens roda em paralelo). */
const C = {
  rosso: 'var(--rosso, #E2000F)',
  ink: 'var(--inch, #1A1A1A)',
  muted: 'var(--muted, #9A9284)',
  green: 'var(--green, #1F8A5B)',
  amber: 'var(--amber, #D29922)',
  blue: 'var(--blue, #2A6FDB)',
  line: 'var(--line, #EFE9DA)',
}

export interface LayerToggles {
  trails: boolean
  labels: boolean
}

/** Histórico de posições por operador, acumulado no cliente para as trilhas. */
export type OpTrails = Map<number, Array<{ x: number; y: number }>>

/** Cor do cliente por estado/impaciência (cálculo no view, dados do snapshot). */
function custColor(c: EnrichedFrame['customers'][number], simTime: number, tol: number, pickupTimeout: number): { fill: string; opacity: number } {
  if (c.state === 'waiting') {
    const ratio = (simTime - c.tArr) / Math.max(1, tol)
    const fill = ratio < 0.5 ? C.green : ratio < 0.8 ? C.amber : C.rosso
    return { fill, opacity: 0.9 }
  }
  if (c.state === 'at_pdv') return { fill: C.green, opacity: 0.9 }
  if (c.state === 'waiting_pickup') {
    const pw = (simTime - (c.tSS ?? simTime)) / Math.max(1, pickupTimeout)
    return { fill: pw > 0.66 ? '#D2691E' : C.blue, opacity: 0.9 }
  }
  if (c.state === 'leaving') return { fill: c.served ? C.green : '#C0392B', opacity: 0.45 }
  return { fill: '#9A9284', opacity: 0.9 }
}

/** Cor do anel externo do operador por estado (amarelo=busy, vermelho=wait). */
function opRing(o: EnrichedFrameOperator): string {
  if (o.busyState === 'busy') return C.amber
  if (o.busyState === 'wait') return C.rosso
  return o.color
}

/** Quebra de rótulo em até 2 linhas (~14 chars), espelhando wrapLabel do protótipo. */
function wrapLabel(str: string): string[] {
  const words = String(str).split(' ')
  let lines: string[] = []
  let cur = ''
  words.forEach((w) => {
    const test = cur ? cur + ' ' + w : w
    if (test.length > 14 && cur) {
      lines.push(cur)
      cur = w
    } else cur = test
  })
  if (cur) lines.push(cur)
  if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')]
  return lines
}

export default function SimView({
  scene,
  frame,
  layers = { trails: true, labels: true },
  trails,
}: {
  scene: EnrichedScene | null
  frame: EnrichedFrame | null
  layers?: LayerToggles
  trails?: OpTrails
}) {
  const vb = useMemo(() => {
    if (!scene) return `${px(-1.1)} ${px(-0.3)} ${px(4.8)} ${px(7.4)}`
    const o = scene.room.out
    const minX = px(o.x0 - 0.2)
    const minY = px(-0.3)
    const w = px(o.x1 + 0.2 - (o.x0 - 0.2))
    const h = px(o.y1 + 0.2 - -0.3)
    return `${minX} ${minY} ${w} ${h}`
  }, [scene])

  // memo do cenário estático (recalcula só quando a cena muda)
  const staticLayer = useMemo(() => (scene ? buildStatic(scene, layers.labels) : null), [scene, layers.labels])

  // contador de chaves estáveis para slots de fila (rótulos)
  const idRef = useRef(0)
  idRef.current = 0

  if (!scene) return <div className="sim-view-empty">Inicializando cenário…</div>

  const simTime = frame?.simTime ?? scene.room.gate * 0 + 600
  const { tol, pickupTimeout } = frame?.meta ?? { tol: 30, pickupTimeout: 12 }
  const q = frame?.waitQueue ?? 0
  const { gate: GATE } = scene.room
  const OUT = scene.room.out
  const qSlots = scene.queueSlots
  const lastQ = qSlots[Math.min(q - 1, qSlots.length - 1)]

  return (
    <svg className="sim-svg" viewBox={vb} preserveAspectRatio="xMidYMid meet">
      {staticLayer}

      {/* zona da fila destacada quando longa (verde/amarelo/vermelho) */}
      {q > 0 && lastQ && (
        <rect
          x={px(OUT.x0 + 0.1)}
          y={px(GATE + 0.18)}
          width={px(OUT.x1 - OUT.x0 - 0.2)}
          height={px(Math.max(0.55, lastQ.y - GATE + 0.3))}
          rx={6}
          fill={q > 10 ? 'rgba(226,0,15,0.10)' : q > 5 ? 'rgba(210,153,34,0.10)' : 'rgba(31,138,91,0.07)'}
        />
      )}

      {/* trilhas dos operadores (overlay derivado no cliente) */}
      {layers.trails &&
        trails &&
        frame?.operators.map((o) => {
          const t = trails.get(o.idx)
          if (!t || t.length < 2) return null
          const d = 'M' + t.map((p) => `${px(p.x)},${px(p.y)}`).join(' L')
          return (
            <path
              key={`tr${o.idx}`}
              d={d}
              fill="none"
              stroke={o.color}
              strokeWidth={1.6}
              opacity={0.4}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}

      {/* clientes */}
      {frame?.customers.map((c) => {
        const { fill, opacity } = custColor(c, simTime, tol, pickupTimeout)
        return (
          <g key={`c${c.id}`} transform={`translate(${px(c.x)},${px(c.y)})`}>
            <circle r={12} fill={fill} opacity={opacity} stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            {c.orderNum != null && c.state === 'waiting_pickup' && (
              <text y={3.4} className="s2-agent" fontSize={9}>
                #{c.orderNum}
              </text>
            )}
          </g>
        )
      })}

      {/* operadores */}
      {frame?.operators.map((o, i) => {
        const ring = opRing(o)
        const tag = o.tag || 'O' + (i + 1)
        return (
          <g key={`o${o.idx}`} transform={`translate(${px(o.x)},${px(o.y)})`}>
            <circle r={15} fill={o.color} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <circle r={19} fill="none" stroke={ring} strokeWidth={2} opacity={0.85} vectorEffect="non-scaling-stroke" />
            <text y={4} className="s2-agent" fontSize={11} fill="#fff">
              {tag}
            </text>
            {/* balão de carga (carrying) */}
            {o.carrying && (
              <rect x={10} y={-22} width={13} height={9} rx={2} fill="#C0763A" stroke="#7c4a1d" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            )}
            {/* tag FIXO quando preso a uma estação */}
            {o.fixedEq && (
              <g>
                <rect x={-24} y={-30} width={18} height={11} rx={2} fill="#D2691E" />
                <text x={-15} y={-21.5} className="s2-agent" fontSize={7.5} fill="#fff">
                  FIXO
                </text>
              </g>
            )}
            {/* status flutuante (texto acima do disco, com halo branco) */}
            <text y={-22} className="s2-status" fontSize={9.5}>
              {'O' + (i + 1) + ' · ' + o.statusText}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ============================================================== cenário estático */
function buildStatic(scene: EnrichedScene, showLabels: boolean) {
  const { W, D, cutX, cutY, gate: GATE, out: OUT } = scene.room
  const grid: number[] = []
  for (let x = 0.5; x < W; x += 0.5) grid.push(x)
  const gridY: number[] = []
  for (let y = 0.5; y < GATE; y += 0.5) gridY.push(y)

  // casca em L (path de piso para clip e fundo)
  const room: Array<[number, number]> = [
    [0, 0],
    [W, 0].map((v) => v) as [number, number], // placeholder substituído abaixo
  ]
  // path real da sala em L
  const roomPts: Array<[number, number]> = [
    [0, 0],
    [cutX, 0],
    [cutX, cutY],
    [W, cutY],
    [W, D],
    [0, D],
  ]
  void room
  const roomD = 'M' + roomPts.map(([x, y]) => `${px(x)},${px(y)}`).join(' L') + ' Z'

  // contorno aberto (paredes com frente aberta) — casca-parede-grossa-l
  const openD =
    `M${px(0)},${px(GATE)} L0,0 L${px(cutX)},0 L${px(cutX)},${px(cutY)} ` +
    `L${px(W)},${px(cutY)} L${px(W)},${px(GATE)}`

  return (
    <g>
      {/* calçada da galeria (clientes) */}
      <rect x={px(OUT.x0)} y={px(GATE)} width={px(OUT.x1 - OUT.x0)} height={px(OUT.y1 - GATE)} fill="#E9E3D3" />
      <line x1={px(OUT.x0)} y1={px(OUT.y1)} x2={px(OUT.x1)} y2={px(OUT.y1)} stroke="#D9D3C4" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={px((OUT.x0 + OUT.x1) / 2)} y={px(OUT.y1 - 0.12)} className="s2-zone" fontSize={12} textAnchor="middle">
        GALERIA · CLIENTES
      </text>

      {/* piso */}
      <path d={roomD} fill="#FDFBF4" />

      {/* grade de 0,5 m (planta-grade-05m) */}
      <clipPath id="s2clip">
        <path d={roomD} />
      </clipPath>
      <g clipPath="url(#s2clip)">
        {grid.map((x) => (
          <line key={`gx${x}`} x1={px(x)} y1={0} x2={px(x)} y2={px(GATE)} stroke={C.line} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {gridY.map((y) => (
          <line key={`gy${y}`} x1={0} y1={px(y)} x2={px(W)} y2={px(y)} stroke={C.line} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {/* zonas FOH/BOH sombreadas e rotuladas (zonas-foh-boh-rotuladas) */}
      <path d={`M0,0 L${px(cutX)},0 L${px(cutX)},${px(cutY)} L0,${px(cutY)} Z`} fill="rgba(154,146,132,0.06)" />
      <text x={px(0.18)} y={px(0.28)} className="s2-zone" fontSize={10}>
        BOH · PRODUÇÃO
      </text>
      <text x={px(0.18)} y={px(3.24)} className="s2-zone" fontSize={10}>
        FOH · ATENDIMENTO
      </text>

      {/* casca: parede grossa preta com frente aberta + divisa tracejada + rótulo do portão */}
      <path d={openD} fill="none" stroke={C.ink} strokeWidth={10} strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      <line x1={0} y1={px(GATE)} x2={px(W)} y2={px(GATE)} stroke={C.ink} strokeWidth={1.4} strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />
      <text x={px(1.3)} y={px(GATE) + 14} className="s2-dim" fontSize={9} textAnchor="middle">
        portão de enrolar · 2,60 m
      </text>

      {/* estações como cartão branco com faixa colorida no topo + rótulo com nome */}
      {scene.stations.map((st) => {
        const w = px(st.w)
        const h = px(st.h)
        const cx = w / 2
        const fs = Math.min(11, Math.max(8, w / 10))
        const lines = wrapLabel(st.name || st.type)
        const labelY = h < 26 ? h - 5 : h / 2 + 3
        const y0 = lines.length > 1 ? -5 : 0
        return (
          <g key={st.id} transform={`translate(${px(st.x)},${px(st.y)})`}>
            <rect x={0} y={0} width={w} height={h} rx={3} fill="#fff" stroke={C.ink} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            <rect x={0} y={0} width={w} height={4} fill={st.color} />
            {showLabels && (
              <text x={cx} y={labelY} className="s2-lab" fontSize={fs}>
                {lines.map((ln, i) => (
                  <tspan key={i} x={cx} dy={i === 0 ? y0 : 11}>
                    {ln}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        )
      })}

      {/* pontos de serviço das estações (estacao-ponto-servico) — vermelho = sem acesso */}
      {scene.stations.map((st) => {
        if (st.unreachable) {
          return (
            <g key={`sp${st.id}`}>
              <circle cx={px(st.cx)} cy={px(st.cy)} r={13} fill="none" stroke={C.rosso} strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              <text x={px(st.cx)} y={px(st.cy) - 16} className="s2-dim" fontSize={8.5} textAnchor="middle" fill={C.rosso}>
                sem acesso
              </text>
            </g>
          )
        }
        if (!st.sp) return null
        return (
          <circle
            key={`sp${st.id}`}
            cx={px(st.sp.x)}
            cy={px(st.sp.y)}
            r={3.2}
            fill="none"
            stroke={st.color || '#9A9284'}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
            opacity={0.65}
          />
        )
      })}

      {/* fila + retirada (slots-fila-pickup-marcadores) */}
      {scene.queueSlots.slice(0, 14).map((s, i) => (
        <rect
          key={`q${i}`}
          x={px(s.x) - 9}
          y={px(s.y) - 9}
          width={18}
          height={18}
          rx={3}
          fill="rgba(226,0,15,0.05)"
          stroke="rgba(226,0,15,0.25)"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {scene.pickupSlots.map((s, i) => (
        <rect
          key={`p${i}`}
          x={px(s.x) - 8}
          y={px(s.y) - 8}
          width={16}
          height={16}
          rx={8}
          fill="rgba(42,111,219,0.06)"
          stroke="rgba(42,111,219,0.3)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <text x={px(scene.queueSlots[0]?.x ?? 0.5)} y={px(GATE + 0.45) - 14} className="s2-dim" fontSize={8.5}>
        fila / PDV
      </text>
      <text x={px(scene.pickupSlots[0]?.x ?? 1.2)} y={px(GATE + 0.4) + 22} className="s2-dim" fontSize={8.5}>
        retirada
      </text>
    </g>
  )
}
