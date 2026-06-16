import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { UTILITY_META, clearances, isSolid, levelOf, utilsFor, type Item, type RestaurantScene } from '../domain'
import { TURN_CIRCLE, corridorAnalysis, dimsToNeighbors, workZones } from '../domain/spatial'
import DoorSwing from './DoorSwing'

/**
 * Linha-guia de alinhamento (em METROS) emitida pela INTERAÇÃO durante o arraste.
 * Contrato compartilhado: RENDER define+exporta; Planner importa daqui.
 */
export interface AlignGuide {
  orient: 'v' | 'h'
  /** posição da linha no eixo perpendicular (x para 'v', y para 'h'), em metros */
  pos: number
  /** extensão da linha no eixo paralelo, em metros */
  from: number
  to: number
}

export const SCALE = 100 // px por metro
/** Espessura da parede em planta (m). Desenhada como POCHÉ por fora do polígono
    (face interna = limite da sala), paridade com o 3D (WALL_T 0.12). */
const ROOM_WALL_T = 0.12
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLES: Array<[Handle, number, number, string]> = [
  ['nw', 0, 0, 'nwse-resize'],
  ['n', 0.5, 0, 'ns-resize'],
  ['ne', 1, 0, 'nesw-resize'],
  ['e', 1, 0.5, 'ew-resize'],
  ['se', 1, 1, 'nwse-resize'],
  ['s', 0.5, 1, 'ns-resize'],
  ['sw', 0, 1, 'nesw-resize'],
  ['w', 0, 0.5, 'ew-resize'],
]

const fmt = (n: number) => n.toFixed(2).replace('.', ',')

function bbox(poly: Array<[number, number]>) {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

function wrapLabel(name: string): string[] {
  if (name.length <= 15) return [name]
  const words = name.split(' ')
  const lines: string[] = ['']
  for (const w of words) {
    if ((lines[lines.length - 1] + ' ' + w).trim().length > 15) lines.push(w)
    else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim()
  }
  return lines.slice(0, 2)
}

/* ---------- camadas individuais ---------- */

function Floor({ poly }: { poly: Array<[number, number]> }) {
  const b = bbox(poly)
  const n = poly.length
  const frontW = Math.max(...poly.filter((p) => p[1] === b.maxY).map((p) => p[0])) * SCALE
  const points = poly.map((p) => `${p[0] * SCALE},${p[1] * SCALE}`).join(' ')

  // Caminho da parede = perímetro EXCETO a aresta da frente (ambos vértices em y=maxY).
  let frontEdge = 0
  for (let i = 0; i < n; i++) {
    const a = poly[i], c = poly[(i + 1) % n]
    if (Math.abs(a[1] - b.maxY) < 1e-6 && Math.abs(c[1] - b.maxY) < 1e-6) frontEdge = i
  }
  const wallVerts: Array<[number, number]> = []
  for (let k = 1; k <= n; k++) wallVerts.push(poly[(frontEdge + k) % n])
  // Parede como POCHÉ por FORA do polígono: deslocamos o contorno (sem a frente) para
  // fora em t/2 e traçamos com espessura t (métrica — escala com o zoom). Assim a face
  // INTERNA da parede coincide com o limite da sala e as peças encostadas nas paredes
  // não ficam "por baixo" do traço grosso (corrige a parede grossa sobrepondo itens).
  const ref = { x: poly.reduce((s, p) => s + p[0], 0) / n, y: poly.reduce((s, p) => s + p[1], 0) / n }
  const d = ROOM_WALL_T / 2
  const edgeN = (a: [number, number], c: [number, number]): [number, number] => {
    let nx = c[1] - a[1], ny = -(c[0] - a[0])
    const l = Math.hypot(nx, ny) || 1
    nx /= l; ny /= l
    const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2
    if (nx * (mx - ref.x) + ny * (my - ref.y) < 0) { nx = -nx; ny = -ny } // aponta p/ fora
    return [nx, ny]
  }
  const m = wallVerts.length
  const off = wallVerts.map((p, i): [number, number] => {
    if (i === 0) { const nr = edgeN(wallVerts[0], wallVerts[1]); return [p[0] + nr[0] * d, p[1] + nr[1] * d] }
    if (i === m - 1) { const nr = edgeN(wallVerts[m - 2], wallVerts[m - 1]); return [p[0] + nr[0] * d, p[1] + nr[1] * d] }
    const n1 = edgeN(wallVerts[i - 1], wallVerts[i]), n2 = edgeN(wallVerts[i], wallVerts[i + 1])
    let mx = n1[0] + n2[0], my = n1[1] + n2[1]
    const ml = Math.hypot(mx, my) || 1
    mx /= ml; my /= ml
    const cos = Math.max(0.35, mx * n1[0] + my * n1[1]) // miter clampado p/ não disparar
    const dist = d / cos
    return [p[0] + mx * dist, p[1] + my * dist]
  })
  const wallD = 'M' + off.map((p) => `${p[0] * SCALE},${p[1] * SCALE}`).join(' L')

  return (
    <g className="floor-layer">
      <polygon className="floor" points={points} />
      {/* parede em poché: espessura real (0,12 m), POR FORA do polígono */}
      <path
        className="wall-poche"
        d={wallD}
        fill="none"
        stroke="#2b2b2b"
        strokeWidth={ROOM_WALL_T * SCALE}
        strokeLinejoin="miter"
        strokeLinecap="butt"
        strokeMiterlimit={6}
      />
      {/* portão de enrolar (frente) */}
      <line className="gate-line" x1={0} y1={b.maxY * SCALE} x2={frontW} y2={b.maxY * SCALE} />
      <rect className="gate-post" x={-4} y={b.maxY * SCALE - 4} width={8} height={8} />
      <rect className="gate-post" x={frontW - 4} y={b.maxY * SCALE - 4} width={8} height={8} />
      <text className="gate-t" x={frontW / 2} y={b.maxY * SCALE - 8} fontSize={9.5}>
        portão de enrolar · {fmt(frontW / SCALE)} m
      </text>
    </g>
  )
}

function Grid({ poly, clipId }: { poly: Array<[number, number]>; clipId: string }) {
  const b = bbox(poly)
  const lines: ReactNode[] = []
  for (let x = b.minX; x <= b.maxX + 1e-6; x += 0.1) {
    const major = Math.abs(x / 0.5 - Math.round(x / 0.5)) < 1e-6
    lines.push(
      <line key={`vx${x.toFixed(2)}`} className={major ? 'grid-major' : 'grid-minor'} x1={x * SCALE} y1={b.minY * SCALE} x2={x * SCALE} y2={b.maxY * SCALE} />,
    )
  }
  for (let y = b.minY; y <= b.maxY + 1e-6; y += 0.1) {
    const major = Math.abs(y / 0.5 - Math.round(y / 0.5)) < 1e-6
    lines.push(
      <line key={`hy${y.toFixed(2)}`} className={major ? 'grid-major' : 'grid-minor'} x1={b.minX * SCALE} y1={y * SCALE} x2={b.maxX * SCALE} y2={y * SCALE} />,
    )
  }
  return (
    <g className="grid-layer" clipPath={`url(#${clipId})`}>
      {lines}
    </g>
  )
}

function FohBoh({ scene }: { scene: RestaurantScene }) {
  const b = bbox(scene.room.polygon)
  const fohDepth = scene.room.fohDepth ?? 2.15
  const divY = b.maxY - fohDepth
  return (
    <g className="fohboh-layer">
      <rect className="boh-fill" x={b.minX * SCALE} y={b.minY * SCALE} width={(b.maxX - b.minX) * SCALE} height={(divY - b.minY) * SCALE} clipPath="url(#rclip)" />
      <rect className="foh-fill" x={b.minX * SCALE} y={divY * SCALE} width={(b.maxX - b.minX) * SCALE} height={(b.maxY - divY) * SCALE} clipPath="url(#rclip)" />
      <line className="fohboh-div" x1={b.minX * SCALE} y1={divY * SCALE} x2={b.maxX * SCALE} y2={divY * SCALE} />
      <text className="fohboh-t" x={b.minX * SCALE + 30} y={b.minY * SCALE + 26} fontSize={11} textAnchor="start">BOH · PRODUÇÃO</text>
      <text className="fohboh-t" x={b.minX * SCALE + 30} y={divY * SCALE + 22} fontSize={11} textAnchor="start">FOH · ATENDIMENTO</text>
      <text className="fohboh-d" x={b.maxX * SCALE - 6} y={divY * SCALE - 7} fontSize={10} textAnchor="end">divisa · {fmt(fohDepth)} m da frente</text>
    </g>
  )
}

function Zones({ scene }: { scene: RestaurantScene }) {
  const b = bbox(scene.room.polygon)
  const fohDepth = scene.room.fohDepth ?? 2.15
  const divY = b.maxY - fohDepth
  const frontCx = (b.minX + b.maxX) / 2 * SCALE
  // chevrons de entrada: ancorados logo abaixo da frente (protótipo ey=px(5.35) ≈ maxY+0,20 m)
  const ey = (b.maxY + 0.2) * SCALE
  // glyph do protótipo (planner.js:231): 3 chevrons preenchidos com dx em metros
  const arrow = (dxM: number) =>
    `M${frontCx + dxM * SCALE},${ey - 2} l-6,7 l3.5,0 l0,8 l5,0 l0,-8 l3.5,0 Z`
  return (
    <g className="zone-layer">
      <text className="zone-t" x={(b.minX + 2 / 2) * SCALE} y={(divY / 2) * SCALE} fontSize={15} transform={`rotate(-90 ${(b.minX + 1) * SCALE} ${(divY / 2) * SCALE})`}>01 · COZINHA</text>
      <text className="zone-t" x={(b.minX + b.maxX) / 2 * SCALE} y={(divY + fohDepth / 2) * SCALE} fontSize={14}>02 · PREPARO</text>
      {[-0.45, 0, 0.45].map((dx) => (
        <path key={dx} className="ent-arr" d={arrow(dx)} />
      ))}
      <text className="ent-t" x={frontCx} y={ey + 34} fontSize={13}>CLIENTE · ATENDIMENTO EXTERNO</text>
      <text className="ent-sub" x={frontCx} y={ey + 50} fontSize={10}>portão de enrolar · vão livre {fmt(b.maxX - b.minX)} m</text>
    </g>
  )
}

function Cotas({ scene }: { scene: RestaurantScene }) {
  const b = bbox(scene.room.polygon)
  // ponto do entalhe (L): maior x entre vértices com y == minY
  const topX = Math.max(...scene.room.polygon.filter((p) => p[1] === b.minY).map((p) => p[0]))
  const stepY = Math.min(...scene.room.polygon.filter((p) => p[0] === b.maxX).map((p) => p[1]))
  const S = SCALE
  const HC = (x1: number, x2: number, y: number, label: string) => (
    <>
      <line className="cota-w" x1={x1} y1={y < 0 ? 0 : y} x2={x1} y2={y} />
      <line className="cota-w" x1={x2} y1={y < 0 ? 0 : y} x2={x2} y2={y} />
      <line className="cota-l" x1={x1} y1={y} x2={x2} y2={y} markerStart="url(#ah)" markerEnd="url(#ah)" />
      <text className="cota-t" x={(x1 + x2) / 2} y={y - 6} fontSize={13} dominantBaseline="auto">{label}</text>
    </>
  )
  const VC = (y1: number, y2: number, x: number, label: string) => (
    <>
      <line className="cota-l" x1={x} y1={y1} x2={x} y2={y2} markerStart="url(#ah)" markerEnd="url(#ah)" />
      <text className="cota-t" x={x} y={(y1 + y2) / 2} fontSize={13} transform={`rotate(-90 ${x} ${(y1 + y2) / 2})`} dominantBaseline="auto">{label}</text>
    </>
  )
  return (
    <g className="cota-layer">
      {HC(b.minX * S, topX * S, -34, fmt(topX - b.minX))}
      {VC(b.minY * S, b.maxY * S, -54, fmt(b.maxY - b.minY))}
      {VC(b.minY * S, stepY * S, b.maxX * S + 96, fmt(stepY - b.minY))}
      {HC(topX * S, b.maxX * S, stepY * S + 30, fmt(b.maxX - topX))}
      {VC(stepY * S, b.maxY * S, b.maxX * S + 60, fmt(b.maxY - stepY))}
      {HC(b.minX * S, b.maxX * S, b.maxY * S + 20, fmt(b.maxX - b.minX))}
    </g>
  )
}

/**
 * Painel divisor (porta type==='painel'): retângulo bege + hachura diagonal
 * a cada 7 px e, quando o comprimento >= 1,10 m, a simbologia de porta de correr
 * (vão + folha aberta + seta de deslizamento + rótulo). Espelha drawPanel do
 * protótipo (planner.js:307-335). Coordenadas locais em px (origem no canto da peça).
 */
function PanelShape({ x, y, w, h, name }: { x: number; y: number; w: number; h: number; name: string }) {
  const horiz = w >= h
  const len = (horiz ? w : h) / SCALE // comprimento em metros
  const hasDoor = len >= 1.1
  const d0 = 0.1 * SCALE
  const d1 = Math.min(0.9, len - 0.2) * SCALE
  const dw = d1 - d0

  // hachura diagonal: mesmo laço do protótipo (o de 7 em 7 px, em coords locais)
  const hatch: ReactNode[] = []
  const step = 7
  const lim = w + h
  let key = 0
  for (let o = step; o < lim; o += step) {
    const x1 = Math.max(0, o - h), y1 = Math.min(o, h)
    const x2 = Math.min(o, w), y2 = Math.max(0, o - w)
    hatch.push(<line key={key++} className="panel-hatch" x1={x + x1} y1={y + y1} x2={x + x2} y2={y + y2} />)
  }

  return (
    <>
      <rect className="panel-rect" x={x} y={y} width={w} height={h} />
      {hatch}
      {hasDoor && (horiz ? (
        <>
          <rect className="panel-gap" x={x + d0} y={y - 1} width={dw} height={h + 2} />
          <rect className="panel-leaf" x={x + d1} y={y - h * 0.65 - 3} width={dw} height={h * 0.65} />
          <line className="panel-arr" x1={x + d1 + dw - 4} y1={y - h * 0.33 - 3} x2={x + d0 + dw * 0.55} y2={y - h * 0.33 - 3} markerEnd="url(#ah)" />
          <text className="item-dim" x={x + d0 + dw / 2} y={y + h + 11} fontSize={8}>porta de correr {fmt(dw / SCALE)}</text>
        </>
      ) : (
        <>
          <rect className="panel-gap" x={x - 1} y={y + d0} width={w + 2} height={dw} />
          <rect className="panel-leaf" x={x - w * 0.65 - 3} y={y + d1} width={w * 0.65} height={dw} />
          <line className="panel-arr" x1={x - w * 0.33 - 3} y1={y + d1 + dw - 4} x2={x - w * 0.33 - 3} y2={y + d0 + dw * 0.55} markerEnd="url(#ah)" />
        </>
      ))}
      {horiz && (
        <text className="item-dim" x={x + w / 2} y={y + h / 2} fontSize={8.5} dominantBaseline="middle">{name}</text>
      )}
    </>
  )
}

function ItemShape({
  item,
  selected,
  conflict,
  oob,
  onPointerDown,
}: {
  item: Item
  selected: boolean
  conflict: boolean
  oob: boolean
  onPointerDown: (e: ReactPointerEvent, it: Item) => void
}) {
  const x = item.x * SCALE
  const y = item.y * SCALE
  const w = item.width * SCALE
  const h = item.depth * SCALE
  const cx = x + w / 2
  const isPanel = item.type === 'painel'
  const isWall = item.type === 'wall'
  const isBlock = isPanel || isWall
  const lvl = levelOf(item)
  const raised = lvl > 0.001
  const lines = wrapLabel(item.name)
  const small = h < 34
  const labelY = small ? y + 13 : y + h / 2 - 3 - (lines.length - 1) * 6
  const cls = `item${selected ? ' sel' : ''}${conflict ? ' conflict' : ''}${oob ? ' oob' : ''}${raised ? ' raised' : ''}`
  return (
    <g className={cls} onPointerDown={(e) => onPointerDown(e, item)}>
      {isPanel ? (
        <PanelShape x={x} y={y} w={w} h={h} name={item.name} />
      ) : isWall ? (
        <rect className="wall-rect" x={x} y={y} width={w} height={h} />
      ) : (
        <>
          <rect className="item-rect" x={x} y={y} width={w} height={h} rx={3} />
          <rect className="item-accent" x={x} y={y} width={w} height={5} fill={item.color} />
        </>
      )}
      {conflict && <rect className="conflict-fill" x={x} y={y} width={w} height={h} rx={3} />}
      {!isBlock &&
        lines.map((ln, i) => (
          <text key={i} className="item-label" x={cx} y={labelY + i * 12} fontSize={Math.min(12, Math.max(9, w / 9))}>
            {ln}
          </text>
        ))}
      {!isBlock && !small && (
        <text className="item-dim" x={cx} y={y + h - 6} fontSize={8.5}>
          {fmt(item.width)} × {fmt(item.depth)}
          {raised ? ` · ▲${fmt(lvl)}` : ''}
        </text>
      )}
      {raised && (
        <g className="lvl-badge">
          <rect x={x + 3} y={y + 3} width={36} height={13} rx={3} />
          <text className="lvl-badge-t" x={x + 21} y={y + 12.5} fontSize={9}>▲ {fmt(lvl)}</text>
        </g>
      )}
      {conflict && (
        <g className="conflict-badge">
          <circle cx={x + w - 8} cy={y + 8} r={7} />
          <text className="conflict-badge-t" x={x + w - 8} y={y + 11.5} fontSize={10}>!</text>
        </g>
      )}
      {oob && (
        <g className="oob-badge">
          <circle cx={x + w - 8} cy={y + h - 8} r={7} />
          <text className="oob-badge-t" x={x + w - 8} y={y + h - 4.5} fontSize={10}>!</text>
        </g>
      )}
    </g>
  )
}

function Overlay({
  item,
  zoom,
  onHandleDown,
  onRotate,
}: {
  item: Item
  zoom: number
  onHandleDown: (e: ReactPointerEvent, it: Item, h: Handle) => void
  onRotate: (e: ReactPointerEvent, it: Item) => void
}) {
  const x = item.x * SCALE
  const y = item.y * SCALE
  const w = item.width * SCALE
  const h = item.depth * SCALE
  const hs = 10 / zoom
  const cx = x + w / 2
  const rotY = y - 22 / zoom
  return (
    <g className="overlay-sel">
      <rect className="selbox" x={x} y={y} width={w} height={h} />
      <line className="selbox" x1={cx} y1={y} x2={cx} y2={rotY} />
      <circle className="handle rot" cx={cx} cy={rotY} r={hs / 1.6} style={{ cursor: 'grab' }} onPointerDown={(e) => onRotate(e, item)} />
      {HANDLES.map(([name, fx, fy, cursor]) => (
        <rect
          key={name}
          className="handle"
          x={x + fx * w - hs / 2}
          y={y + fy * h - hs / 2}
          width={hs}
          height={hs}
          rx={2 / zoom}
          style={{ cursor }}
          onPointerDown={(e) => onHandleDown(e, item, name)}
        />
      ))}
    </g>
  )
}

/** Cotas de folga (vãos/corredores) da peça selecionada para vizinhos e paredes. */
function Clearances({ item, items, poly }: { item: Item; items: Item[]; poly: Array<[number, number]> }) {
  const cls = clearances(item, items, poly)
  return (
    <g className="clr-layer">
      {cls.map((c, i) => {
        const x1 = c.from.x * SCALE
        const y1 = c.from.y * SCALE
        const x2 = c.to.x * SCALE
        const y2 = c.to.y * SCALE
        const vert = c.dir === 'top' || c.dir === 'bottom'
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        return (
          <g key={i} className={`clr ${c.level}`}>
            <line className="clr-l" x1={x1} y1={y1} x2={x2} y2={y2} />
            <line className="clr-l" x1={x1 - (vert ? 4 : 0)} y1={y1 - (vert ? 0 : 4)} x2={x1 + (vert ? 4 : 0)} y2={y1 + (vert ? 0 : 4)} />
            <line className="clr-l" x1={x2 - (vert ? 4 : 0)} y1={y2 - (vert ? 0 : 4)} x2={x2 + (vert ? 4 : 0)} y2={y2 + (vert ? 0 : 4)} />
            <text className="clr-t" x={mx + (vert ? 9 : 0)} y={my - (vert ? 0 : 5)} fontSize={9.5} textAnchor={vert ? 'start' : 'middle'}>
              {fmt(c.gap)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/* ---------- camadas de análise (contrato DOMÍNIO) ---------- */

/**
 * (#1) Circulação na planta inteira: segmentos de corridorAnalysis(scene),
 * cor por nível (ok verde / warn laranja / bad vermelho) + rótulo da largura.
 * Camada ATRÁS das peças. Segmentos vêm em metros.
 */
function Circulation({ scene }: { scene: RestaurantScene }) {
  const segs = corridorAnalysis(scene)
  return (
    <g className="circ-layer">
      {segs.map((s, i) => {
        const x1 = s.x1 * SCALE
        const y1 = s.y1 * SCALE
        const x2 = s.x2 * SCALE
        const y2 = s.y2 * SCALE
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const vert = Math.abs(x2 - x1) < Math.abs(y2 - y1)
        return (
          <g key={i} className={`circ ${s.level}`}>
            <line className="circ-l" x1={x1} y1={y1} x2={x2} y2={y2} />
            <text
              className="circ-t"
              x={mx + (vert ? 8 : 0)}
              y={my - (vert ? 0 : 4)}
              fontSize={9}
              textAnchor={vert ? 'start' : 'middle'}
            >
              {fmt(s.gap)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/**
 * (#2) Zonas de trabalho/segurança por peça: retângulos translúcidos de
 * workZones(item) — work (azul-esverdeado), hot (vermelho), door (azul).
 * Clipadas ao polígono da sala (rclip).
 */
function WorkZones({ items }: { items: Item[] }) {
  return (
    <g className="wz-layer" clipPath="url(#rclip)">
      {items.flatMap((it) =>
        workZones(it).map((z, i) => (
          <rect
            key={`${it.id}-${i}`}
            className={`wz wz-${z.kind}`}
            x={z.x * SCALE}
            y={z.y * SCALE}
            width={z.w * SCALE}
            height={z.h * SCALE}
          />
        )),
      )}
    </g>
  )
}

/**
 * (#4) Cotas peça↔vizinho (dimsToNeighbors) com seleção: linha + setas (marker ah)
 * + valor; e o giro NBR 9050: círculo Ø TURN_CIRCLE tracejado se couber à frente
 * da peça (lado +y). `front` = +y. Severidade dá a cor da cota.
 */
function NeighborDims({
  item,
  items,
  poly,
}: {
  item: Item
  items: Item[]
  poly: Array<[number, number]>
}) {
  const dims = dimsToNeighbors(item, items, poly)
  const b = bbox(poly)
  // Giro NBR 9050: tenta à frente da peça (+y); se não couber, recua para o FOH.
  const r = TURN_CIRCLE / 2
  const cxTurn = item.x + item.width / 2
  const frontY = item.y + item.depth
  const fitsFront = frontY + TURN_CIRCLE <= b.maxY + 1e-6
  const cyTurn = fitsFront ? frontY + r : b.maxY - r
  const turnFits = cyTurn - r >= b.minY - 1e-6 && cyTurn + r <= b.maxY + 1e-6
  return (
    <g className="ndim-layer">
      {dims.map((d, i) => {
        const x1 = d.x1 * SCALE
        const y1 = d.y1 * SCALE
        const x2 = d.x2 * SCALE
        const y2 = d.y2 * SCALE
        const vert = Math.abs(x2 - x1) < Math.abs(y2 - y1)
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        return (
          <g key={i} className={`ndim ${d.level}`}>
            <line className="ndim-l" x1={x1} y1={y1} x2={x2} y2={y2} markerStart="url(#ah)" markerEnd="url(#ah)" />
            <text
              className="ndim-t"
              x={mx + (vert ? 8 : 0)}
              y={my - (vert ? 0 : 5)}
              fontSize={9.5}
              textAnchor={vert ? 'start' : 'middle'}
            >
              {fmt(d.value)}
            </text>
          </g>
        )
      })}
      {turnFits && (
        <g className="turn-circle">
          <circle cx={cxTurn * SCALE} cy={cyTurn * SCALE} r={r * SCALE} />
          <text className="turn-t" x={cxTurn * SCALE} y={cyTurn * SCALE + 3} fontSize={9} textAnchor="middle">
            giro Ø {fmt(TURN_CIRCLE)}
          </text>
        </g>
      )}
    </g>
  )
}

/**
 * (#3) Guias de alinhamento durante o arraste: linhas tracejadas rosso
 * (non-scaling-stroke). Posições/extensões em metros.
 */
function Guides({ guides }: { guides: AlignGuide[] }) {
  return (
    <g className="guide-layer">
      {guides.map((gd, i) => {
        const p = gd.pos * SCALE
        const a = gd.from * SCALE
        const z = gd.to * SCALE
        return gd.orient === 'v' ? (
          <line key={i} className="align-guide" x1={p} y1={a} x2={p} y2={z} />
        ) : (
          <line key={i} className="align-guide" x1={a} y1={p} x2={z} y2={p} />
        )
      })}
    </g>
  )
}

/** Marcadores de instalação (elétrica/hidráulica/esgoto/gás/exaustão) por peça. */
function UtilMarks({ item }: { item: Item }) {
  const u = utilsFor(item.type)
  if (!u.length) return null
  const x = item.x * SCALE + 7
  const cyc = (item.y + item.depth / 2) * SCALE
  const start = cyc - (u.length - 1) * 6
  return (
    <g className="util-marks">
      {u.map((tag, i) => {
        const m = UTILITY_META[tag]
        const yy = start + i * 12
        return (
          <g key={tag}>
            <circle cx={x} cy={yy} r={5.5} fill={m.color} stroke="#fff" strokeWidth={0.8} />
            <text className="util-mark-t" x={x} y={yy + 2.6} fontSize={7}>{m.short}</text>
          </g>
        )
      })}
    </g>
  )
}

/* ---------- composição ---------- */

export function SceneLayers({
  scene,
  selectedId,
  zoom,
  collisions,
  outOfBounds,
  onItemPointerDown,
  onHandleDown,
  onRotate,
  showCirculation = false,
  showWorkZones = false,
  guides,
}: {
  scene: RestaurantScene
  selectedId: string | null
  zoom: number
  collisions: Set<string>
  outOfBounds: Set<string>
  onItemPointerDown: (e: ReactPointerEvent, it: Item) => void
  onHandleDown: (e: ReactPointerEvent, it: Item, h: Handle) => void
  onRotate: (e: ReactPointerEvent, it: Item) => void
  /** desenha corridorAnalysis(scene) atrás das peças (padrão: desligado) */
  showCirculation?: boolean
  /** desenha workZones de cada peça (faixas translúcidas) (padrão: desligado) */
  showWorkZones?: boolean
  /** linhas-guia de alinhamento durante o arraste */
  guides?: AlignGuide[]
}) {
  const poly = scene.room.polygon
  const points = poly.map((p) => `${p[0] * SCALE},${p[1] * SCALE}`).join(' ')
  const sel = scene.items.find((i) => i.id === selectedId) ?? null
  // desenha do nível mais baixo para o mais alto (peças elevadas por cima)
  const ordered = [...scene.items].sort((a, b) => levelOf(a) - levelOf(b))
  return (
    <>
      <defs>
        <clipPath id="rclip">
          <polygon points={points} />
        </clipPath>
        <marker id="ah" viewBox="0 0 8 9" refX="6" refY="4.5" markerWidth="7" markerHeight="8" orient="auto">
          <path d="M7,1 L1,4.5 L7,8 Z" fill="#3a3a3a" />
        </marker>
        <pattern id="conflictHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="rgba(226,0,15,0.10)" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(226,0,15,0.5)" strokeWidth="1.4" />
        </pattern>
      </defs>
      <Floor poly={poly} />
      <Grid poly={poly} clipId="rclip" />
      <FohBoh scene={scene} />
      <Zones scene={scene} />
      {showCirculation && <Circulation scene={scene} />}
      {showWorkZones && <WorkZones items={scene.items} />}
      <g className="door-layer">
        {ordered
          .filter((it) => it.type === 'porta')
          .map((it) => (
            <DoorSwing key={it.id} item={it} flip={it.doorFlip} />
          ))}
      </g>
      <g className="item-layer">
        {ordered.map((it) => (
          <ItemShape
            key={it.id}
            item={it}
            selected={it.id === selectedId}
            conflict={collisions.has(it.id)}
            oob={outOfBounds.has(it.id)}
            onPointerDown={onItemPointerDown}
          />
        ))}
      </g>
      <g className="util-layer">
        {ordered.map((it) => (
          <UtilMarks key={it.id} item={it} />
        ))}
      </g>
      <Cotas scene={scene} />
      {sel && isSolid(sel) && <Clearances item={sel} items={scene.items} poly={poly} />}
      {sel && isSolid(sel) && <NeighborDims item={sel} items={scene.items} poly={poly} />}
      {sel && <Overlay item={sel} zoom={zoom} onHandleDown={onHandleDown} onRotate={onRotate} />}
      {guides && guides.length > 0 && <Guides guides={guides} />}
    </>
  )
}
