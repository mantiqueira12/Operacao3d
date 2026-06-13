import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { CATALOG, polygonArea, type Item, type ItemCategory } from '../domain'
import { MIN_SIZE, clampPosition, snap } from './geometry'
import { useScene } from './useScene'
import './Planner.css'

type Corner = 'nw' | 'ne' | 'sw' | 'se'
type Drag =
  | { mode: 'move'; id: string; start: { x: number; y: number }; item: Item }
  | { mode: 'resize'; id: string; corner: Corner; item: Item }
  | null

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  atendimento: 'Atendimento',
  cozinha: 'Cozinha',
  gerais: 'Gerais',
  estrutura: 'Estrutura',
}

function clientToWorld(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

export default function Planner() {
  const ed = useScene()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drag = useRef<Drag>(null)

  if (!ed.scene || !ed.bounds) {
    return <div className="planner-loading">Carregando projeto…</div>
  }

  const { scene, bounds, grid } = ed
  const pad = 0.6
  const viewBox = `${bounds.minX - pad} ${bounds.minY - pad} ${
    bounds.maxX - bounds.minX + pad * 2
  } ${bounds.maxY - bounds.minY + pad * 2}`

  const occupied = scene.items
    .filter((i) => i.type !== 'porta' && i.type !== 'wall' && i.type !== 'painel')
    .reduce((sum, i) => sum + i.width * i.depth, 0)
  const area = scene.room.labeledAreaM2 ?? polygonArea(scene.room.polygon)

  function onItemPointerDown(e: ReactPointerEvent, item: Item) {
    e.stopPropagation()
    ed.select(item.id)
    const svg = svgRef.current
    if (!svg) return
    const w = clientToWorld(svg, e.clientX, e.clientY)
    drag.current = { mode: 'move', id: item.id, start: { x: w.x - item.x, y: w.y - item.y }, item }
    svg.setPointerCapture(e.pointerId)
  }

  function onHandlePointerDown(e: ReactPointerEvent, item: Item, corner: Corner) {
    e.stopPropagation()
    const svg = svgRef.current
    if (!svg) return
    drag.current = { mode: 'resize', id: item.id, corner, item }
    svg.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current
    const svg = svgRef.current
    if (!d || !svg) return
    const w = clientToWorld(svg, e.clientX, e.clientY)

    if (d.mode === 'move') {
      ed.moveItem(d.id, w.x - d.start.x, w.y - d.start.y)
      return
    }

    // resize
    const it = d.item
    const right = it.x + it.width
    const bottom = it.y + it.depth
    let x = it.x
    let y = it.y
    let width = it.width
    let depth = it.depth
    const wx = snap(w.x, grid)
    const wy = snap(w.y, grid)
    if (d.corner === 'se') {
      width = wx - it.x
      depth = wy - it.y
    } else if (d.corner === 'nw') {
      x = wx
      y = wy
      width = right - wx
      depth = bottom - wy
    } else if (d.corner === 'ne') {
      y = wy
      width = wx - it.x
      depth = bottom - wy
    } else {
      x = wx
      width = right - wx
      depth = wy - it.y
    }
    width = Math.max(MIN_SIZE, width)
    depth = Math.max(MIN_SIZE, depth)
    const c = clampPosition(x, y, width, depth, bounds)
    ed.patchItem(d.id, { x: c.x, y: c.y, width, depth })
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (drag.current && svgRef.current) {
      svgRef.current.releasePointerCapture(e.pointerId)
    }
    drag.current = null
  }

  const sel = ed.selected
  const fmt = (n: number) => n.toFixed(2).replace('.', ',')

  return (
    <div className="planner">
      {/* CATÁLOGO */}
      <aside className="rail catalog">
        <h3>Catálogo</h3>
        {(Object.keys(CATALOG) as ItemCategory[]).map((cat) => (
          <div key={cat} className="cat-group">
            <h4>{CATEGORY_LABEL[cat]}</h4>
            {CATALOG[cat].map((entry) => (
              <button key={entry.type} className="cat-item" onClick={() => ed.addItem(entry.type)}>
                <span className="dot" style={{ background: entry.color }} />
                {entry.name}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* CANVAS */}
      <main className="canvas">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={() => ed.select(null)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* casca */}
          <polygon
            className="shell"
            points={scene.room.polygon.map((p) => p.join(',')).join(' ')}
          />
          {/* itens */}
          {scene.items.map((it) => (
            <g key={it.id}>
              <rect
                className={`item${it.id === ed.selectedId ? ' selected' : ''}`}
                x={it.x}
                y={it.y}
                width={it.width}
                height={it.depth}
                fill={it.color}
                onPointerDown={(e) => onItemPointerDown(e, it)}
              />
              <text className="item-label" x={it.x + it.width / 2} y={it.y + it.depth / 2}>
                {it.name}
              </text>
            </g>
          ))}
          {/* alças de redimensionamento da peça selecionada */}
          {sel &&
            (
              [
                ['nw', sel.x, sel.y],
                ['ne', sel.x + sel.width, sel.y],
                ['sw', sel.x, sel.y + sel.depth],
                ['se', sel.x + sel.width, sel.y + sel.depth],
              ] as Array<[Corner, number, number]>
            ).map(([corner, hx, hy]) => (
              <circle
                key={corner}
                className="handle"
                cx={hx}
                cy={hy}
                r={0.09}
                onPointerDown={(e) => onHandlePointerDown(e, sel, corner)}
              />
            ))}
        </svg>
        <div className="readout">
          <span>Área da casca: <b>{fmt(area)} m²</b></span>
          <span>Peças: <b>{scene.items.length}</b></span>
          <span>Ocupado: <b>{fmt(occupied)} m²</b></span>
        </div>
      </main>

      {/* PROPRIEDADES */}
      <aside className="rail props">
        <h3>Propriedades</h3>
        {!sel && <p className="empty">Selecione uma peça para editar — ou insira do catálogo.</p>}
        {sel && (
          <div className="props-form">
            <label className="field">
              <span>Nome</span>
              <input value={sel.name} onChange={(e) => ed.patchItem(sel.id, { name: e.target.value })} />
            </label>
            <div className="grid2">
              <NumField label="Largura" value={sel.width} onCommit={(v) => ed.patchItem(sel.id, { width: Math.max(MIN_SIZE, v) })} />
              <NumField label="Profund." value={sel.depth} onCommit={(v) => ed.patchItem(sel.id, { depth: Math.max(MIN_SIZE, v) })} />
            </div>
            <div className="grid2">
              <NumField label="Posição X" value={sel.x} onCommit={(v) => ed.moveItem(sel.id, v, sel.y)} />
              <NumField label="Posição Y" value={sel.y} onCommit={(v) => ed.moveItem(sel.id, sel.x, v)} />
            </div>
            <NumField label="Altura (3D)" value={sel.height} onCommit={(v) => ed.patchItem(sel.id, { height: Math.max(MIN_SIZE, v) })} />
            <div className="btn-row">
              <button onClick={() => ed.rotateItem(sel.id)}>Girar 90°</button>
              <button onClick={() => ed.duplicateItem(sel.id)}>Duplicar</button>
            </div>
            <button className="danger" onClick={() => ed.removeItem(sel.id)}>Excluir peça</button>
          </div>
        )}
      </aside>
    </div>
  )
}

function NumField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (v: number) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        defaultValue={value.toFixed(2)}
        key={value} // ressincroniza quando o valor muda externamente
        onBlur={(e) => {
          const v = parseFloat(e.target.value.replace(',', '.'))
          if (!Number.isNaN(v)) onCommit(v)
        }}
      />
    </label>
  )
}
