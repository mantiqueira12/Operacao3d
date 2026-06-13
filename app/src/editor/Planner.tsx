import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { CATALOG, type Item, type ItemCategory, type RestaurantScene } from '../domain'
import { MIN_SIZE, clampPosition } from './geometry'
import { SCALE, SceneLayers, type Handle } from './SceneLayers'
import { CatalogGlyph, Icon } from './icons'
import { useScene } from './useScene'
import './planner.css'

const CAT_ORDER: ItemCategory[] = ['atendimento', 'cozinha', 'gerais', 'estrutura']
const CAT_LABEL: Record<ItemCategory, string> = {
  atendimento: 'Atendimento', cozinha: 'Cozinha', gerais: 'Gerais', estrutura: 'Estrutura',
}
const SWATCHES = ['#E2000F', '#1A1A1A', '#2B2B2B', '#9A9284', '#2A6FDB', '#1F8A5B']
const fmt = (n: number) => n.toFixed(2).replace('.', ',')

type View = { zoom: number; panX: number; panY: number }
type Drag =
  | { kind: 'move'; id: string; off: { x: number; y: number } }
  | { kind: 'resize'; id: string; handle: Handle; item: Item }
  | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
  | null

export default function Planner() {
  const ed = useScene()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const worldRef = useRef<SVGGElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const drag = useRef<Drag>(null)

  const [view, setView] = useState<View>({ zoom: 1, panX: 0, panY: 0 })
  const [tool, setTool] = useState<'select' | 'measure'>('select')
  const [snapOn, setSnapOn] = useState(true)
  const [layers, setLayers] = useState({ cotas: true, items: true, zones: true, fohboh: true, grid: true })
  const [measure, setMeasure] = useState<{ a: { x: number; y: number } | null; b: { x: number; y: number } | null }>({ a: null, b: null })

  const scene = ed.scene

  const fit = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap || !scene) return
    const xs = scene.room.polygon.map((p) => p[0])
    const ys = scene.room.polygon.map((p) => p[1])
    const minX = Math.min(...xs) - 1.15, maxX = Math.max(...xs) + 0.95
    const minY = Math.min(...ys) - 0.7, maxY = Math.max(...ys) + 0.9
    const cw = (maxX - minX) * SCALE, ch = (maxY - minY) * SCALE
    const W = wrap.clientWidth, H = wrap.clientHeight
    const zoom = Math.min(W / cw, H / ch) * 0.94
    setView({
      zoom,
      panX: (W - cw * zoom) / 2 - minX * SCALE * zoom,
      panY: (H - ch * zoom) / 2 - minY * SCALE * zoom,
    })
  }, [scene])

  useLayoutEffect(() => {
    if (scene) fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!scene])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => fit())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [fit])

  function toWorld(clientX: number, clientY: number) {
    const g = worldRef.current
    if (!g) return { x: 0, y: 0 }
    const pt = (svgRef.current as SVGSVGElement).createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = g.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x / SCALE, y: p.y / SCALE }
  }

  const grid = scene?.snap ?? 0.05
  const snapV = useCallback((v: number) => (snapOn ? Math.round(v / grid) * grid : v), [snapOn, grid])

  /* ---------- interações ---------- */
  function onItemDown(e: ReactPointerEvent, item: Item) {
    if (tool !== 'select') return
    e.stopPropagation()
    ed.select(item.id)
    const m = toWorld(e.clientX, e.clientY)
    drag.current = { kind: 'move', id: item.id, off: { x: m.x - item.x, y: m.y - item.y } }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onHandleDown(e: ReactPointerEvent, item: Item, handle: Handle) {
    e.stopPropagation()
    drag.current = { kind: 'resize', id: item.id, handle, item }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onRotate(e: ReactPointerEvent, item: Item) {
    e.stopPropagation()
    ed.rotateItem(item.id)
  }

  function onBgDown(e: ReactPointerEvent) {
    if (tool === 'measure') {
      const m = toWorld(e.clientX, e.clientY)
      setMeasure((cur) => (!cur.a || cur.b ? { a: m, b: null } : { a: cur.a, b: m }))
      return
    }
    ed.select(null)
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: view.panX, py: view.panY }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onMove(e: ReactPointerEvent) {
    const d = drag.current
    if (!d) return
    if (d.kind === 'pan') {
      setView((v) => ({ ...v, panX: d.px + (e.clientX - d.sx), panY: d.py + (e.clientY - d.sy) }))
      return
    }
    const m = toWorld(e.clientX, e.clientY)
    if (d.kind === 'move') {
      ed.moveItem(d.id, snapV(m.x - d.off.x), snapV(m.y - d.off.y))
      return
    }
    // resize
    const it = d.item
    const x0 = it.x, y0 = it.y, x1 = it.x + it.width, y1 = it.y + it.depth
    let x = x0, y = y0, width = it.width, depth = it.depth
    const wx = snapV(m.x), wy = snapV(m.y)
    if (d.handle.includes('w')) { x = wx; width = x1 - wx }
    if (d.handle.includes('e')) { width = wx - x0 }
    if (d.handle.includes('n')) { y = wy; depth = y1 - wy }
    if (d.handle.includes('s')) { depth = wy - y0 }
    width = Math.max(MIN_SIZE, width)
    depth = Math.max(MIN_SIZE, depth)
    const b = { minX: Math.min(...scene!.room.polygon.map((p) => p[0])), minY: Math.min(...scene!.room.polygon.map((p) => p[1])), maxX: Math.max(...scene!.room.polygon.map((p) => p[0])), maxY: Math.max(...scene!.room.polygon.map((p) => p[1])) }
    const c = clampPosition(x, y, width, depth, b)
    ed.patchItem(d.id, { x: c.x, y: c.y, width, depth })
  }

  function onUp(e: ReactPointerEvent) {
    if (drag.current) svgRef.current?.releasePointerCapture(e.pointerId)
    drag.current = null
  }

  function onWheel(e: ReactWheelEvent) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const z = Math.max(0.15, Math.min(8, v.zoom * factor))
      const wx = (cx - v.panX) / v.zoom, wy = (cy - v.panY) / v.zoom
      return { zoom: z, panX: cx - wx * z, panY: cy - wy * z }
    })
  }

  function exportJSON() {
    if (!scene) return
    const data = { app: 'operacao3d', version: 1, exportedAt: new Date().toISOString(), scene }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${scene.titleBlock?.unit ?? 'projeto'}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function importJSON(file: File) {
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const d = JSON.parse(String(rd.result))
        const next: RestaurantScene = d.scene ?? d
        if (next?.room && Array.isArray(next.items)) ed.replaceScene(next)
      } catch {
        /* arquivo inválido */
      }
    }
    rd.readAsText(file)
  }

  if (!scene) return <div className="empty" style={{ padding: 40 }}>Carregando projeto…</div>

  const sel = ed.selected
  const movable = scene.items.filter((i) => i.type !== 'porta' && i.type !== 'wall' && i.type !== 'painel')
  const occupied = movable.reduce((s, i) => s + i.width * i.depth, 0)
  const area = scene.room.labeledAreaM2 ?? 0
  const free = Math.max(0, area - occupied)
  const pct = area > 0 ? Math.round((occupied / area) * 100) : 0
  const tb = scene.titleBlock

  const appCls = [
    !layers.cotas && 'hide-cotas',
    !layers.items && 'hide-items',
    !layers.zones && 'hide-zones',
    !layers.fohboh && 'hide-fohboh',
    !layers.grid && 'hide-grid',
  ].filter(Boolean).join(' ')

  const toggleLayer = (k: keyof typeof layers) => setLayers((l) => ({ ...l, [k]: !l[k] }))

  return (
    <div id="app" className={appCls}>
      {/* TOPBAR */}
      <header id="topbar">
        <div className="brand">All'<b>Antico</b> Panino</div>
        <div className="topdoc">{tb?.unit ?? 'Projeto'} · Estúdio de planta <span className="verbadge">v3</span></div>
        <div className="topspacer" />
        <div className="toolgroup">
          <button className={`tbtn${tool === 'select' ? ' active' : ''}`} onClick={() => setTool('select')}><Icon name="select" />Selecionar</button>
          <button className={`tbtn${tool === 'measure' ? ' active' : ''}`} onClick={() => setTool('measure')}><Icon name="measure" />Medir</button>
          <button className="tbtn" onClick={() => ed.addItem('wall')}><Icon name="wall" />Parede</button>
          <button className="tbtn" onClick={() => ed.addItem('painel')}><Icon name="divisor" />Divisor FOH/BOH</button>
        </div>
        <div className="toolgroup">
          <button className="tbtn" onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.15, v.zoom / 1.1) }))}>−</button>
          <span className="zoomlbl">{Math.round(view.zoom * 100)}%</span>
          <button className="tbtn" onClick={() => setView((v) => ({ ...v, zoom: Math.min(8, v.zoom * 1.1) }))}>+</button>
          <button className="tbtn" onClick={fit}>Ajustar</button>
        </div>
        <div className="toolgroup">
          <button className="tbtn" onClick={exportJSON}><Icon name="export" />Exportar</button>
          <button className="tbtn" onClick={() => fileRef.current?.click()}><Icon name="import" />Importar</button>
          <button className="tbtn" onClick={() => window.print()}><Icon name="print" />Imprimir</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) importJSON(e.target.files[0]); e.target.value = '' }} />
        </div>
      </header>

      {/* CATÁLOGO */}
      <aside id="left" className="rail">
        <div className="sec">
          <h3>Catálogo <button className="mini-add" title="Em breve">+ Criar</button></h3>
          {CAT_ORDER.map((cat) => (
            <div key={cat}>
              <div className="catcat">{CAT_LABEL[cat]}</div>
              <div className="cat-grid">
                {CATALOG[cat].map((entry) => (
                  <button key={entry.type} className="catitem" onClick={() => ed.addItem(entry.type)}>
                    <span className="gl"><CatalogGlyph entry={entry} /></span>
                    <span className="nm">{entry.name}</span>
                    <span className="dm">{fmt(entry.width)}×{fmt(entry.depth)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* CANVAS */}
      <main id="canvasWrap" ref={wrapRef}>
        <svg
          id="scene"
          ref={svgRef}
          className={tool === 'measure' ? 'tool-measure' : drag.current?.kind === 'pan' ? 'panning' : ''}
          onPointerDown={onBgDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onWheel={onWheel}
        >
          <g ref={worldRef} transform={`translate(${view.panX},${view.panY}) scale(${view.zoom})`}>
            <SceneLayers
              scene={scene}
              selectedId={ed.selectedId}
              zoom={view.zoom}
              onItemPointerDown={onItemDown}
              onHandleDown={onHandleDown}
              onRotate={onRotate}
            />
            {measure.a && measure.b && (
              <g className="measure-layer">
                <line className="measure-l" x1={measure.a.x * SCALE} y1={measure.a.y * SCALE} x2={measure.b.x * SCALE} y2={measure.b.y * SCALE} />
                <text className="measure-t" x={(measure.a.x + measure.b.x) / 2 * SCALE} y={(measure.a.y + measure.b.y) / 2 * SCALE - 6} fontSize={12}>
                  {fmt(Math.hypot(measure.b.x - measure.a.x, measure.b.y - measure.a.y))} m
                </text>
              </g>
            )}
          </g>
        </svg>
        <div className="readout">
          <span>x <b>{sel ? fmt(sel.x) : '0,00'}</b></span>
          <span>y <b>{sel ? fmt(sel.y) : '0,00'}</b></span>
          <span><b>{fmt(area)} m²</b> · escala 1:50</span>
        </div>
        <div className="hintbar">Arraste para mover · alças para redimensionar · roda do mouse: zoom · arraste o vazio: pan</div>
        <div className="miniscale">
          <div className="sb"><i className="f" style={{ width: SCALE * view.zoom }} /><i style={{ width: SCALE * view.zoom }} /></div>
          <div>0 — 1 — 2 m</div>
        </div>
      </main>

      {/* PROPRIEDADES / CAMADAS / RESUMO / CARIMBO */}
      <aside id="right" className="rail">
        <div className="sec">
          <h3>Propriedades</h3>
          {!sel && <div className="empty">Selecione uma peça no desenho para editar dimensões e posição — ou insira uma do catálogo.</div>}
          {sel && (
            <div className="props">
              <div className="field name">
                <label>Nome</label>
                <input value={sel.name} onChange={(e) => ed.patchItem(sel.id, { name: e.target.value })} />
              </div>
              <div className="grid2">
                <NumField label="Largura" value={sel.width} onCommit={(v) => ed.patchItem(sel.id, { width: Math.max(MIN_SIZE, v) })} />
                <NumField label="Profund." value={sel.depth} onCommit={(v) => ed.patchItem(sel.id, { depth: Math.max(MIN_SIZE, v) })} />
              </div>
              <div className="grid2">
                <NumField label="Posição X" value={sel.x} onCommit={(v) => ed.moveItem(sel.id, v, sel.y)} />
                <NumField label="Posição Y" value={sel.y} onCommit={(v) => ed.moveItem(sel.id, sel.x, v)} />
              </div>
              <NumField label="Altura (3D)" value={sel.height} onCommit={(v) => ed.patchItem(sel.id, { height: Math.max(MIN_SIZE, v) })} />
              <div className="field">
                <label>Zona / cor</label>
                <div className="swatches">
                  {SWATCHES.map((c) => (
                    <button key={c} className={`swatch${sel.color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => ed.patchItem(sel.id, { color: c })} />
                  ))}
                </div>
              </div>
              <div className="pbtns">
                <button className="pbtn" onClick={() => ed.rotateItem(sel.id)}><Icon name="rotate" />Girar 90°</button>
                <button className="pbtn" onClick={() => ed.duplicateItem(sel.id)}><Icon name="dup" />Duplicar</button>
              </div>
              <button className="pbtn danger" onClick={() => ed.removeItem(sel.id)}><Icon name="trash" />Excluir peça</button>
            </div>
          )}
        </div>

        <div className="sec">
          <h3>Camadas</h3>
          <div className="toggles">
            <div className={`sw${layers.cotas ? ' on' : ''}`} onClick={() => toggleLayer('cotas')}><span>Cotas da casca</span><span className="toggle" /></div>
            <div className={`sw${layers.items ? ' on' : ''}`} onClick={() => toggleLayer('items')}><span>Mobiliário</span><span className="toggle" /></div>
            <div className={`sw${layers.zones ? ' on' : ''}`} onClick={() => toggleLayer('zones')}><span>Zonas e fluxo</span><span className="toggle" /></div>
            <div className={`sw${layers.fohboh ? ' on' : ''}`} onClick={() => toggleLayer('fohboh')}><span>Setor FOH / BOH</span><span className="toggle" /></div>
            <div className={`sw${layers.grid ? ' on' : ''}`} onClick={() => toggleLayer('grid')}><span>Grade</span><span className="toggle" /></div>
            <div className={`sw${snapOn ? ' on' : ''}`} onClick={() => setSnapOn((s) => !s)}><span>Encaixe na grade (5 cm)</span><span className="toggle" /></div>
          </div>
        </div>

        <div className="sec">
          <h3>Resumo</h3>
          <div className="stats">
            <div className="stat"><span className="k">Área da loja (cota)</span><span className="v red">{fmt(area)} m²</span></div>
            <div className="stat"><span className="k">Mobiliário (peças)</span><span className="v">{movable.length}</span></div>
            <div className="stat"><span className="k">Área ocupada</span><span className="v">{fmt(occupied)} m²</span></div>
            <div className="stat"><span className="k">Piso livre</span><span className="v">{fmt(free)} m²</span></div>
            <div style={{ padding: '8px 0 2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}><span>Ocupação</span><span style={{ fontFamily: 'var(--mono)' }}>{pct}%</span></div>
              <div className="bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
            </div>
          </div>
        </div>

        <div className="sec">
          <h3>Carimbo</h3>
          <div className="tb">
            <TBRow label="Projeto" value={tb?.project ?? ''} onCommit={(v) => ed.patchTitleBlock({ project: v })} />
            <TBRow label="Unidade" value={tb?.unit ?? ''} onCommit={(v) => ed.patchTitleBlock({ unit: v })} />
            <TBRow label="Endereço" value={tb?.address ?? ''} onCommit={(v) => ed.patchTitleBlock({ address: v })} />
            <TBRow label="Resp." value={tb?.responsible ?? ''} onCommit={(v) => ed.patchTitleBlock({ responsible: v })} />
            <TBRow label="Data/Rev" value={tb?.dateRev ?? ''} onCommit={(v) => ed.patchTitleBlock({ dateRev: v })} />
          </div>
        </div>
      </aside>
    </div>
  )
}

function NumField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="unit">
        <input
          inputMode="decimal"
          defaultValue={value.toFixed(2)}
          key={value}
          onBlur={(e) => {
            const v = parseFloat(e.target.value.replace(',', '.'))
            if (!Number.isNaN(v)) onCommit(v)
          }}
        />
      </div>
    </div>
  )
}

function TBRow({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  return (
    <div className="tbrow">
      <span className="k">{label}</span>
      <span
        className="v"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onCommit(e.currentTarget.textContent ?? '')}
      >
        {value}
      </span>
    </div>
  )
}
