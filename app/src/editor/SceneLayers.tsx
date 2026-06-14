import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { UTILITY_META, clearances, isSolid, levelOf, utilsFor, type Item, type RestaurantScene } from '../domain'

export const SCALE = 100 // px por metro
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
  const wallD =
    'M' + wallVerts.map((p) => `${p[0] * SCALE},${p[1] * SCALE}`).join(' L')

  return (
    <g className="floor-layer">
      <polygon className="floor" points={points} />
      {/* paredes grossas (aberto na frente) */}
      <path
        d={wallD}
        fill="none"
        stroke="#1A1A1A"
        strokeWidth={11}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* portão de enrolar (frente) */}
      <line className="gate-line" x1={0} y1={b.maxY * SCALE} x2={frontW} y2={b.maxY * SCALE} />
      <rect className="gate-post" x={-4} y={b.maxY * SCALE - 4} width={8} height={8} />
      <rect className="gate-post" x={frontW - 4} y={b.maxY * SCALE - 4} width={8} height={8} />
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
  const frontY = b.maxY * SCALE
  const arrow = (dx: number) =>
    `M${frontCx + dx},${frontY + 36} l-6,7 l3.5,0 l0,8 l5,0 l0,-8 l3.5,0 Z`
  return (
    <g className="zone-layer">
      <text className="zone-t" x={(b.minX + 2 / 2) * SCALE} y={(divY / 2) * SCALE} fontSize={15} transform={`rotate(-90 ${(b.minX + 1) * SCALE} ${(divY / 2) * SCALE})`}>COZINHA</text>
      <text className="zone-t" x={(b.minX + b.maxX) / 2 * SCALE} y={(divY + fohDepth / 2) * SCALE} fontSize={14}>02 · PREPARO</text>
      {[-45, 0, 45].map((dx) => (
        <path key={dx} className="ent-arr" d={arrow(dx)} />
      ))}
      <text className="ent-t" x={frontCx} y={frontY + 64} fontSize={13}>CLIENTE · ATENDIMENTO EXTERNO</text>
      <text className="ent-sub" x={frontCx} y={frontY + 80} fontSize={10}>portão de enrolar · vão livre {fmt(b.maxX - b.minX)} m</text>
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
  const isPanel = item.type === 'painel' || item.type === 'wall'
  const lvl = levelOf(item)
  const raised = lvl > 0.001
  const lines = wrapLabel(item.name)
  const small = h < 34
  const labelY = small ? y + 13 : y + h / 2 - 3 - (lines.length - 1) * 6
  const cls = `item${selected ? ' sel' : ''}${conflict ? ' conflict' : ''}${oob ? ' oob' : ''}${raised ? ' raised' : ''}`
  return (
    <g className={cls} onPointerDown={(e) => onPointerDown(e, item)}>
      {isPanel ? (
        <rect className="panel-rect" x={x} y={y} width={w} height={h} />
      ) : (
        <>
          <rect className="item-rect" x={x} y={y} width={w} height={h} rx={3} />
          <rect className="item-accent" x={x} y={y} width={w} height={5} fill={item.color} />
        </>
      )}
      {conflict && <rect className="conflict-fill" x={x} y={y} width={w} height={h} rx={3} />}
      {!isPanel &&
        lines.map((ln, i) => (
          <text key={i} className="item-label" x={cx} y={labelY + i * 12} fontSize={Math.min(12, Math.max(9, w / 9))}>
            {ln}
          </text>
        ))}
      {!isPanel && !small && (
        <text className="item-dim" x={cx} y={y + h - 6} fontSize={8.5}>
          {fmt(item.width)} × {fmt(item.depth)}
          {raised ? ` · ▲${fmt(lvl)}` : ''}
        </text>
      )}
      {isPanel && (
        <text className="item-dim" x={cx} y={y + h / 2 + 3} fontSize={8.5}>
          {item.name}
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
}: {
  scene: RestaurantScene
  selectedId: string | null
  zoom: number
  collisions: Set<string>
  outOfBounds: Set<string>
  onItemPointerDown: (e: ReactPointerEvent, it: Item) => void
  onHandleDown: (e: ReactPointerEvent, it: Item, h: Handle) => void
  onRotate: (e: ReactPointerEvent, it: Item) => void
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
      {sel && <Overlay item={sel} zoom={zoom} onHandleDown={onHandleDown} onRotate={onRotate} />}
    </>
  )
}
