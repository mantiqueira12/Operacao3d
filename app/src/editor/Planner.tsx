import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { CATALOG, UTILITY_META, isSolid, levelOf, loja206Scene, makeRectangularRoom, polygonArea, stackTopBelow, type CatalogEntry, type Item, type ItemCategory, type RestaurantScene, type UtilityTag } from '../domain'
import { registerCustomEntry, unregisterCustomEntry } from '../domain/catalog'
import { complianceChecks, type ComplianceIssue, type ComplianceSeverity } from '../domain/spatial'
import { MIN_SIZE, clampPosition } from './geometry'
import { findNearestVertex, snapVertex } from './roomEdit'
import { SCALE, SceneLayers, type AlignGuide, type Handle } from './SceneLayers'
import { CatalogGlyph, Icon } from './icons'
import { useScene } from './useScene'
import ScheduleModal from './Schedule'
import PrintExtras from './PrintExtras'
import PrintPlan from './PrintPlan'
import ProjectManager from '../ProjectManager'
import EquipmentModal from './EquipmentModal'
import { colorToCategory, loadCustomModels, saveCustomModels } from './customModels'
import './planner.css'
import './conformidade.css'

const CAT_ORDER: ItemCategory[] = ['atendimento', 'cozinha', 'gerais', 'estrutura']
const CAT_LABEL: Record<ItemCategory, string> = {
  atendimento: 'Atendimento', cozinha: 'Cozinha', gerais: 'Gerais', estrutura: 'Estrutura',
}
const SWATCHES = ['#E2000F', '#1A1A1A', '#2B2B2B', '#9A9284', '#2A6FDB', '#1F8A5B']
const LEVEL_PRESETS: Array<{ label: string; z: number }> = [
  { label: 'Piso', z: 0 },
  { label: 'Bancada', z: 0.9 },
  { label: 'Prateleira', z: 1.5 },
  { label: 'Alto', z: 1.8 },
]
const UTIL_ORDER: UtilityTag[] = ['eletrica', 'hidraulica', 'esgoto', 'gas', 'exaustao']
const fmt = (n: number) => n.toFixed(2).replace('.', ',')
const round2 = (n: number) => Math.round(n * 100) / 100
const WALL_TH = 0.12 // espessura da parede desenhada (m)

type View = { zoom: number; panX: number; panY: number }
type Tool = 'select' | 'measure' | 'wall' | 'divisor' | 'room'
type Pt = { x: number; y: number }
type Drag =
  | { kind: 'move'; id: string; off: { x: number; y: number } }
  | { kind: 'resize'; id: string; handle: Handle; item: Item }
  | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
  | { kind: 'draft'; tool: 'wall' | 'divisor'; a: Pt; b: Pt }
  | { kind: 'vertex'; idx: number }
  | null

/** Retângulo ortogonal da parede/divisor desenhado de A→B (wallRect do protótipo). */
function draftRect(a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: Math.min(a.x, b.x), y: a.y - WALL_TH / 2, width: Math.abs(dx), depth: WALL_TH }
  }
  return { x: a.x - WALL_TH / 2, y: Math.min(a.y, b.y), width: WALL_TH, depth: Math.abs(dy) }
}

/** Linha-candidata de snap: posição (m) + segmento de extensão (m) p/ desenhar a guia. */
type SnapLine = { pos: number; from: number; to: number }

/** Encaixe 1D: valor → candidata mais próxima dentro da tolerância (m), ou null. */
function bestEdgeSnap(v: number, cands: number[], tol: number): number | null {
  let pick: number | null = null
  let bestD = tol
  for (const c of cands) {
    const dd = Math.abs(c - v)
    if (dd <= bestD) { bestD = dd; pick = c }
  }
  return pick
}

/**
 * Encaixe inteligente: dado o footprint proposto da peça (x,y,w,d), busca alinhamento
 * com bordas/centros das OUTRAS peças e com as paredes (arestas da casca). Em cada eixo
 * testa as 3 âncoras da peça (início, centro, fim) contra as candidatas; pega o menor
 * desvio dentro da tolerância (m). Devolve x/y ajustados e as guias (AlignGuide) a desenhar.
 */
function computeSnap(
  x: number,
  y: number,
  w: number,
  d: number,
  others: Item[],
  poly: Array<[number, number]>,
  tol: number,
): { x: number; y: number; guides: AlignGuide[] } {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  // candidatas verticais (x) e horizontais (y): cada uma carrega a faixa perpendicular
  // (from/to) usada para limitar o traço da guia ao trecho relevante.
  const vCand: SnapLine[] = [
    { pos: minX, from: minY, to: maxY },
    { pos: maxX, from: minY, to: maxY },
  ]
  const hCand: SnapLine[] = [
    { pos: minY, from: minX, to: maxX },
    { pos: maxY, from: minX, to: maxX },
  ]
  for (const o of others) {
    const ox0 = o.x, ox1 = o.x + o.width, ocx = o.x + o.width / 2
    const oy0 = o.y, oy1 = o.y + o.depth, ocy = o.y + o.depth / 2
    for (const px of [ox0, ocx, ox1]) vCand.push({ pos: px, from: oy0, to: oy1 })
    for (const py of [oy0, ocy, oy1]) hCand.push({ pos: py, from: ox0, to: ox1 })
  }

  const guides: AlignGuide[] = []
  // melhor encaixe por eixo (menor desvio); âncora = offset da peça (0 início, w/2 centro, w fim)
  function best(anchors: number[], cands: SnapLine[], base: number) {
    let pick: { delta: number; line: SnapLine } | null = null
    for (const a of anchors) {
      for (const c of cands) {
        const delta = c.pos - (base + a)
        if (Math.abs(delta) <= tol && (pick === null || Math.abs(delta) < Math.abs(pick.delta))) {
          pick = { delta, line: c }
        }
      }
    }
    return pick
  }

  let nx = x, ny = y
  const vx = best([0, w / 2, w], vCand, x)
  if (vx) {
    nx = x + vx.delta
    // faixa da guia: cobre a peça (já reposicionada) e a candidata
    const a = Math.min(ny, vx.line.from), b = Math.max(ny + d, vx.line.to)
    guides.push({ orient: 'v', pos: vx.line.pos, from: a, to: b })
  }
  const hy = best([0, d / 2, d], hCand, y)
  if (hy) {
    ny = y + hy.delta
    const a = Math.min(nx, hy.line.from), b = Math.max(nx + w, hy.line.to)
    guides.push({ orient: 'h', pos: hy.line.pos, from: a, to: b })
  }
  return { x: nx, y: ny, guides }
}

export default function Planner({ onOpenSim, onOpen3D }: { onOpenSim?: () => void; onOpen3D?: () => void }) {
  const ed = useScene()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const worldRef = useRef<SVGGElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const drag = useRef<Drag>(null)

  const [view, setView] = useState<View>({ zoom: 1, panX: 0, panY: 0 })
  const [tool, setTool] = useState<Tool>('select')
  const [snapOn, setSnapOn] = useState(true)
  const [layers, setLayers] = useState({ cotas: true, items: true, zones: true, fohboh: true, grid: true, utils: true })
  // Camadas analíticas (sobrepostas) — desligadas por padrão; passadas direto ao SceneLayers.
  const [showCirculation, setShowCirculation] = useState(false)
  const [showWorkZones, setShowWorkZones] = useState(false)
  // Guias de alinhamento (snap inteligente) durante arraste/resize — limpas ao soltar.
  const [guides, setGuides] = useState<AlignGuide[]>([])
  const [measure, setMeasure] = useState<{ a: Pt | null; b: Pt | null }>({ a: null, b: null })
  const [draft, setDraft] = useState<{ tool: 'wall' | 'divisor'; a: Pt; b: Pt } | null>(null)
  // Preview ao vivo do polígono da sala durante o arraste de um vértice (ferramenta Editar sala).
  const [roomDraft, setRoomDraft] = useState<Array<[number, number]> | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [models, setModels] = useState<CatalogEntry[]>([])
  // Readout vivo: x/y do cursor em metros (sem drag) e info da peça em arraste
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [dragInfo, setDragInfo] = useState<{ name: string; w: number; h: number } | null>(null)

  // Geometria pendente a aplicar na próxima peça criada por arraste (wall/divisor).
  const pendingGeom = useRef<{ x: number; y: number; width: number; depth: number } | null>(null)

  const scene = ed.scene

  /* ---------- histórico (undo/redo) — sobre o replaceScene do store ---------- */
  // Implementado na camada de UI: snapshots de RestaurantScene (cap 80), restaurados
  // via ed.replaceScene. Espelha hist/hi/HMAX do protótipo (planner.js:112-130).
  const history = useRef<string[]>([])
  const hIndex = useRef(-1)
  const histLock = useRef(false)
  const [, setHistVer] = useState(0) // força re-render p/ habilitar/desabilitar botões

  useEffect(() => {
    if (!scene) return
    if (histLock.current) { histLock.current = false; return }
    const snap = JSON.stringify(scene)
    if (history.current[hIndex.current] === snap) return
    history.current = history.current.slice(0, hIndex.current + 1)
    history.current.push(snap)
    if (history.current.length > 80) history.current.shift()
    hIndex.current = history.current.length - 1
    setHistVer((v) => v + 1)
  }, [scene])

  const restore = useCallback((snap: string) => {
    try {
      const s = JSON.parse(snap) as RestaurantScene
      histLock.current = true
      ed.replaceScene(s)
      setHistVer((v) => v + 1)
    } catch { /* snapshot inválido */ }
  }, [ed])

  const canUndo = hIndex.current > 0
  const canRedo = hIndex.current < history.current.length - 1
  const undo = useCallback(() => {
    if (hIndex.current > 0) { hIndex.current -= 1; restore(history.current[hIndex.current]) }
  }, [restore])
  const redo = useCallback(() => {
    if (hIndex.current < history.current.length - 1) { hIndex.current += 1; restore(history.current[hIndex.current]) }
  }, [restore])

  // Restaura a cena padrão (template Loja 206) pelo store, com confirmação (ação destrutiva).
  const restoreDefault = useCallback(() => {
    if (!window.confirm('Restaurar a cena padrão (Loja 206)? As alterações atuais serão substituídas.')) return
    ed.replaceScene(loja206Scene(() => crypto.randomUUID()))
  }, [ed])

  // Carrega "Meus modelos" e os registra no catálogo.
  useEffect(() => {
    let alive = true
    void loadCustomModels().then((list) => { if (alive) setModels(list) })
    return () => { alive = false }
  }, [])

  // Aplica a geometria pendente assim que a peça criada por arraste é selecionada.
  useEffect(() => {
    const g = pendingGeom.current
    if (!g || !ed.selectedId) return
    pendingGeom.current = null
    ed.patchItem(ed.selectedId, g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed.selectedId])

  const fit = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap || !scene) return
    const xs = scene.room.polygon.map((p) => p[0])
    const ys = scene.room.polygon.map((p) => p[1])
    const minX = Math.min(...xs) - 1.15, maxX = Math.max(...xs) + 0.95
    const minY = Math.min(...ys) - 0.7, maxY = Math.max(...ys) + 1.1
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

  // beforeprint: reenquadra a prancha para a folha (paridade com planner.js:961).
  useEffect(() => {
    const onBefore = () => fit()
    window.addEventListener('beforeprint', onBefore)
    return () => window.removeEventListener('beforeprint', onBefore)
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

  /* ---------- modelos custom ---------- */
  const persistModels = useCallback((next: CatalogEntry[]) => {
    setModels(next)
    void saveCustomModels(next)
  }, [])

  const createModel = useCallback((entry: CatalogEntry) => {
    registerCustomEntry(entry)
    persistModels([...models, entry])
    setShowCreate(false)
    ed.addItem(entry.type)
  }, [models, persistModels, ed])

  const deleteModel = useCallback((type: string) => {
    const m = models.find((x) => x.type === type)
    // confirmação em ação destrutiva (remoção de modelo não entra no histórico da cena)
    if (m && !window.confirm(`Remover o modelo "${m.name}" de Meus modelos?`)) return
    unregisterCustomEntry(type)
    persistModels(models.filter((x) => x.type !== type))
  }, [models, persistModels])

  const saveSelectedAsModel = useCallback(() => {
    const s = ed.selected
    if (!s) return
    const entry: CatalogEntry = {
      type: 'cst' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      name: (s.name || 'Modelo').trim(),
      category: colorToCategory(s.color),
      width: s.width,
      depth: s.depth,
      height: s.height,
      color: s.color,
      arch: s.arch ?? undefined,
    }
    registerCustomEntry(entry)
    persistModels([...models, entry])
  }, [ed.selected, models, persistModels])

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

  // Pega direta de um vértice da casca (alça circular) na ferramenta Editar sala.
  function onVertexDown(e: ReactPointerEvent, idx: number) {
    if (tool !== 'room') return
    e.stopPropagation()
    drag.current = { kind: 'vertex', idx }
    setRoomDraft(scene!.room.polygon.map((p) => [p[0], p[1]]))
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onBgDown(e: ReactPointerEvent) {
    if (tool === 'measure') {
      const m = toWorld(e.clientX, e.clientY)
      setMeasure((cur) => (!cur.a || cur.b ? { a: m, b: null } : { a: cur.a, b: m }))
      return
    }
    if (tool === 'wall' || tool === 'divisor') {
      const m = toWorld(e.clientX, e.clientY)
      const a = { x: snapV(m.x), y: snapV(m.y) }
      drag.current = { kind: 'draft', tool, a, b: a }
      setDraft({ tool, a, b: a })
      svgRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (tool === 'room') {
      const m = toWorld(e.clientX, e.clientY)
      // tolerância de pega ~12 px na tela, com piso de 6 cm (mais fácil em zoom alto)
      const tol = Math.max(0.06, 12 / (SCALE * view.zoom))
      const idx = findNearestVertex(scene!.room.polygon, m.x, m.y, tol)
      if (idx != null) {
        drag.current = { kind: 'vertex', idx }
        setRoomDraft(scene!.room.polygon.map((p) => [p[0], p[1]]))
        svgRef.current?.setPointerCapture(e.pointerId)
        return
      }
      // nenhum vértice perto: pan, como na seleção
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: view.panX, py: view.panY }
      svgRef.current?.setPointerCapture(e.pointerId)
      return
    }
    ed.select(null)
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: view.panX, py: view.panY }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onMove(e: ReactPointerEvent) {
    const d = drag.current
    if (!d) {
      // Sem drag: rastreia x/y do cursor em metros (faixa útil da casca)
      const m = toWorld(e.clientX, e.clientY)
      if (m.x >= -0.2 && m.x <= 2.8 && m.y >= -0.2 && m.y <= 5.35) {
        setCursor({ x: Math.max(0, m.x), y: Math.max(0, m.y) })
      }
      // preview ao vivo da régua (ferramenta Medir): A fixo, B segue o cursor
      if (tool === 'measure' && measure.a && !measure.b) {
        setMeasure((cur) => ({ a: cur.a, b: m }))
      }
      return
    }
    if (d.kind === 'pan') {
      setView((v) => ({ ...v, panX: d.px + (e.clientX - d.sx), panY: d.py + (e.clientY - d.sy) }))
      return
    }
    if (d.kind === 'draft') {
      const m = toWorld(e.clientX, e.clientY)
      const b = { x: snapV(m.x), y: snapV(m.y) }
      d.b = b
      setDraft({ tool: d.tool, a: d.a, b })
      return
    }
    if (d.kind === 'vertex') {
      const m = toWorld(e.clientX, e.clientY)
      const poly = scene!.room.polygon
      // tolerância de encaixe ~6 px na tela, presa entre 2 e 8 cm
      const snapTol = Math.min(0.08, Math.max(0.02, 6 / (SCALE * view.zoom)))
      // candidatas de encaixe: bordas (min/max) das peças sólidas
      const solids = scene!.items.filter(isSolid)
      const edgesX = solids.flatMap((o) => [o.x, o.x + o.width])
      const edgesY = solids.flatMap((o) => [o.y, o.y + o.depth])
      // grade primeiro, depois encaixe em vértices/peças (emite guia por eixo encaixado)
      const gx = snapV(m.x), gy = snapV(m.y)
      const s = snapOn
        ? snapVertex(poly, d.idx, gx, gy, edgesX, edgesY, snapTol)
        : { x: m.x, y: m.y, guides: [] as AlignGuide[] }
      const next = poly.map((p, i): [number, number] => (i === d.idx ? [s.x, s.y] : [p[0], p[1]]))
      setRoomDraft(next)
      setGuides(s.guides)
      return
    }
    const m = toWorld(e.clientX, e.clientY)
    // tolerância de encaixe: ~6 px na tela, presa entre 2 e 8 cm (mais frouxa só com zoom baixo)
    const snapTol = Math.min(0.08, Math.max(0.02, 6 / (SCALE * view.zoom)))
    // candidatas de encaixe: demais peças sólidas (marcadores porta/extintor não contam)
    const others = scene!.items.filter((i) => i.id !== d.id && isSolid(i))
    if (d.kind === 'move') {
      const it0 = scene!.items.find((i) => i.id === d.id)
      const px = snapV(m.x - d.off.x), py = snapV(m.y - d.off.y)
      if (snapOn && it0) {
        const s = computeSnap(px, py, it0.width, it0.depth, others, scene!.room.polygon, snapTol)
        setGuides(s.guides)
        ed.moveItem(d.id, s.x, s.y)
      } else {
        setGuides([])
        ed.moveItem(d.id, px, py)
      }
      if (it0) setDragInfo({ name: it0.name, w: it0.width, h: it0.depth })
      return
    }
    // resize
    const it = d.item
    const x0 = it.x, y0 = it.y, x1 = it.x + it.width, y1 = it.y + it.depth
    let x = x0, y = y0, width = it.width, depth = it.depth
    let wx = snapV(m.x), wy = snapV(m.y)
    // encaixe inteligente da borda arrastada nas bordas/centros vizinhos e nas paredes
    const g: AlignGuide[] = []
    if (snapOn) {
      const px = bestEdgeSnap(wx, others.flatMap((o) => [o.x, o.x + o.width / 2, o.x + o.width]).concat(scene!.room.polygon.map((p) => p[0])), snapTol)
      const py = bestEdgeSnap(wy, others.flatMap((o) => [o.y, o.y + o.depth / 2, o.y + o.depth]).concat(scene!.room.polygon.map((p) => p[1])), snapTol)
      if ((d.handle.includes('w') || d.handle.includes('e')) && px != null) {
        wx = px
        g.push({ orient: 'v', pos: px, from: Math.min(...scene!.room.polygon.map((p) => p[1])), to: Math.max(...scene!.room.polygon.map((p) => p[1])) })
      }
      if ((d.handle.includes('n') || d.handle.includes('s')) && py != null) {
        wy = py
        g.push({ orient: 'h', pos: py, from: Math.min(...scene!.room.polygon.map((p) => p[0])), to: Math.max(...scene!.room.polygon.map((p) => p[0])) })
      }
    }
    if (d.handle.includes('w')) { x = wx; width = x1 - wx }
    if (d.handle.includes('e')) { width = wx - x0 }
    if (d.handle.includes('n')) { y = wy; depth = y1 - wy }
    if (d.handle.includes('s')) { depth = wy - y0 }
    width = Math.max(MIN_SIZE, width)
    depth = Math.max(MIN_SIZE, depth)
    const b = { minX: Math.min(...scene!.room.polygon.map((p) => p[0])), minY: Math.min(...scene!.room.polygon.map((p) => p[1])), maxX: Math.max(...scene!.room.polygon.map((p) => p[0])), maxY: Math.max(...scene!.room.polygon.map((p) => p[1])) }
    const c = clampPosition(x, y, width, depth, b)
    setGuides(g)
    ed.patchItem(d.id, { x: c.x, y: c.y, width, depth })
    setDragInfo({ name: it.name, w: width, h: depth })
  }

  function onUp(e: ReactPointerEvent) {
    const d = drag.current
    // libera a captura com guarda: o estado do drag deve sempre zerar
    if (d) {
      try { svgRef.current?.releasePointerCapture(e.pointerId) } catch { /* sem captura ativa */ }
    }
    if (d && d.kind === 'draft') {
      const r = draftRect(d.a, d.b)
      const len = Math.max(r.width, r.depth)
      setDraft(null)
      if (len >= 0.2) {
        // cria a peça e aplica a geometria desenhada (via pendingGeom no efeito de seleção)
        pendingGeom.current = { x: r.x, y: r.y, width: r.width, depth: r.depth }
        ed.addItem(d.tool === 'wall' ? 'wall' : 'painel')
      }
    }
    if (d && d.kind === 'vertex' && roomDraft) {
      // grava a nova casca; recomputa a área rotulada pela fórmula do cadarço
      ed.patchRoom({ polygon: roomDraft, labeledAreaM2: round2(polygonArea(roomDraft)) })
    }
    setRoomDraft(null)
    drag.current = null
    setDragInfo(null)
    setGuides([])
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

  // Troca de ferramenta: limpa estados transitórios da ferramenta anterior.
  const switchTool = useCallback((t: Tool) => {
    setTool(t)
    setMeasure({ a: null, b: null })
    setDraft(null)
    setRoomDraft(null)
    setGuides([])
  }, [])

  // Atalhos: Ctrl+Z desfazer / Ctrl+Shift+Z ou Ctrl+Y refazer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Escape') {
        switchTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, switchTool])

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

  // Conformidade (sanitária SP + NBR 9050): error → warn → info; clicar seleciona a 1ª peça.
  const SEV_RANK: Record<ComplianceSeverity, number> = { error: 0, warn: 1, info: 2 }
  const compliance: ComplianceIssue[] = [...complianceChecks(scene)].sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity],
  )
  const compErrors = compliance.filter((c) => c.severity === 'error').length
  const compWarns = compliance.filter((c) => c.severity === 'warn').length

  const pxPerM = SCALE * view.zoom
  const niceSteps = [0.25, 0.5, 1, 2, 5, 10]
  const scaleStep = niceSteps.find((s) => s * pxPerM >= 42) ?? niceSteps[niceSteps.length - 1]
  const barPx = scaleStep * pxPerM
  const scaleLabel = `0 — ${fmt(scaleStep)} — ${fmt(scaleStep * 2)} m`

  const roX = cursor ? fmt(cursor.x) : sel ? fmt(sel.x) : '0,00'
  const roY = cursor ? fmt(cursor.y) : sel ? fmt(sel.y) : '0,00'

  const appCls = [
    !layers.cotas && 'hide-cotas',
    !layers.items && 'hide-items',
    !layers.zones && 'hide-zones',
    !layers.fohboh && 'hide-fohboh',
    !layers.grid && 'hide-grid',
    !layers.utils && 'hide-utils',
  ].filter(Boolean).join(' ')

  const toggleLayer = (k: keyof typeof layers) => setLayers((l) => ({ ...l, [k]: !l[k] }))

  // classe de cursor do canvas conforme ferramenta/estado
  const sceneCls =
    tool === 'measure' || tool === 'wall' || tool === 'divisor' ? 'tool-measure'
      : tool === 'room' ? 'tool-room'
        : drag.current?.kind === 'pan' ? 'panning' : ''

  // draft ao vivo da parede/divisor (rect-fantasma + cota viva)
  const draftR = draft ? draftRect(draft.a, draft.b) : null
  const draftLen = draftR ? Math.max(draftR.width, draftR.depth) : 0

  return (
    <div id="app" className={appCls}>
      {/* TOPBAR */}
      <header id="topbar">
        <div className="brand">All'<b>Antico</b> Panino</div>
        <div className="topdoc">{tb?.unit ?? 'Projeto'} · Estúdio de planta <span className="verbadge">v3</span></div>
        <div className="topspacer" />
        <div className="toolgroup">
          <button className="tbtn" onClick={() => setShowProjects(true)}>Projetos</button>
        </div>
        <div className="toolgroup">
          <button className={`tbtn${tool === 'select' ? ' active' : ''}`} onClick={() => switchTool('select')}><Icon name="select" />Selecionar</button>
          <button className={`tbtn${tool === 'measure' ? ' active' : ''}`} onClick={() => switchTool('measure')}><Icon name="measure" />Medir</button>
          <button className={`tbtn${tool === 'wall' ? ' active' : ''}`} onClick={() => switchTool('wall')}><Icon name="wall" />Parede</button>
          <button className={`tbtn${tool === 'divisor' ? ' active' : ''}`} onClick={() => switchTool('divisor')}><Icon name="divisor" />Divisor FOH/BOH</button>
          <button className={`tbtn${tool === 'room' ? ' active' : ''}`} onClick={() => switchTool('room')}><Icon name="room" />Editar sala</button>
        </div>
        <div className="toolgroup">
          <button className="tbtn" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)"><Icon name="undo" />Desfazer</button>
          <button className="tbtn" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)"><Icon name="redo" />Refazer</button>
        </div>
        {(onOpen3D || onOpenSim) && (
          <div className="toolgroup">
            {onOpen3D && <button className="tbtn" onClick={onOpen3D}>Ver 3D</button>}
            {onOpenSim && <button className="tbtn active" onClick={onOpenSim}><Icon name="play" />Operação ▸</button>}
          </div>
        )}
        <div className="toolgroup">
          <button className="tbtn" onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.15, v.zoom / 1.1) }))}>−</button>
          <span className="zoomlbl">{Math.round(view.zoom * 100)}%</span>
          <button className="tbtn" onClick={() => setView((v) => ({ ...v, zoom: Math.min(8, v.zoom * 1.1) }))}>+</button>
          <button className="tbtn" onClick={fit}>Ajustar</button>
        </div>
        <div className="toolgroup">
          <button className="tbtn" onClick={() => setShowSchedule(true)}><Icon name="export" />Lista</button>
          <button className="tbtn" onClick={exportJSON}><Icon name="export" />Exportar</button>
          <button className="tbtn" onClick={() => fileRef.current?.click()}><Icon name="import" />Importar</button>
          <button className="tbtn" onClick={() => window.print()}><Icon name="print" />Imprimir</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) importJSON(e.target.files[0]); e.target.value = '' }} />
        </div>
      </header>

      {/* CATÁLOGO */}
      <aside id="left" className="rail">
        <div className="sec">
          <h3>Catálogo <button className="mini-add" onClick={() => setShowCreate(true)} title="Criar equipamento sob medida">+ Criar</button></h3>
          {models.length > 0 && (
            <div>
              <div className="catcat">Meus modelos</div>
              <div className="cat-grid">
                {models.map((entry) => (
                  <button key={entry.type} className="catitem" onClick={() => ed.addItem(entry.type)}>
                    <span
                      className="del"
                      role="button"
                      tabIndex={0}
                      title="Remover modelo"
                      onClick={(e) => { e.stopPropagation(); deleteModel(entry.type) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); deleteModel(entry.type) } }}
                    >×</span>
                    <span className="gl"><CatalogGlyph entry={entry} /></span>
                    <span className="nm">{entry.name}</span>
                    <span className="dm">{fmt(entry.width)}×{fmt(entry.depth)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
          className={sceneCls}
          onPointerDown={onBgDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={() => { if (!drag.current) setCursor(null) }}
          onWheel={onWheel}
        >
          <g ref={worldRef} transform={`translate(${view.panX},${view.panY}) scale(${view.zoom})`}>
            <SceneLayers
              scene={scene}
              selectedId={ed.selectedId}
              zoom={view.zoom}
              collisions={ed.collisions}
              outOfBounds={ed.outOfBounds}
              showCirculation={showCirculation}
              showWorkZones={showWorkZones}
              guides={guides}
              onItemPointerDown={onItemDown}
              onHandleDown={onHandleDown}
              onRotate={onRotate}
              roomEdit={tool === 'room' ? { polygon: scene.room.polygon, preview: roomDraft, onVertexDown } : undefined}
            />
            {/* draft da parede / divisor por arraste (rect-fantasma + cota viva) */}
            {draftR && draftLen > 0 && (
              <g className="wall-draft">
                <rect
                  className="wall-draft-rect"
                  x={draftR.x * SCALE}
                  y={draftR.y * SCALE}
                  width={draftR.width * SCALE}
                  height={draftR.depth * SCALE}
                />
                <text
                  className="measure-t"
                  x={(draftR.x + draftR.width / 2) * SCALE}
                  y={(draftR.y + draftR.depth / 2) * SCALE - 6}
                  fontSize={12}
                >
                  {fmt(draftLen)} m
                </text>
              </g>
            )}
            {/* ferramenta Medir: pontos vermelhos + linha + etiqueta (preview ao vivo) */}
            {measure.a && (
              <g className="measure-layer">
                <circle className="measure-dot" cx={measure.a.x * SCALE} cy={measure.a.y * SCALE} r={3} />
                {measure.b && (
                  <>
                    <line className="measure-l" x1={measure.a.x * SCALE} y1={measure.a.y * SCALE} x2={measure.b.x * SCALE} y2={measure.b.y * SCALE} />
                    <circle className="measure-dot" cx={measure.b.x * SCALE} cy={measure.b.y * SCALE} r={3} />
                    <text className="measure-t" x={(measure.a.x + measure.b.x) / 2 * SCALE} y={(measure.a.y + measure.b.y) / 2 * SCALE - 6} fontSize={12}>
                      {fmt(Math.hypot(measure.b.x - measure.a.x, measure.b.y - measure.a.y))} m
                    </text>
                  </>
                )}
              </g>
            )}
          </g>
        </svg>
        <div className={`readout${dragInfo ? ' live' : ''}`}>
          {dragInfo ? (
            <span className="ro-info"><b>{dragInfo.name}</b> · {fmt(dragInfo.w)}×{fmt(dragInfo.h)} m</span>
          ) : (
            <>
              <span>x <b>{roX}</b></span>
              <span>y <b>{roY}</b></span>
              <span className="ro-area"><b>{fmt(area)} m²</b> · escala 1:50</span>
            </>
          )}
        </div>
        <div className="hintbar">
          {tool === 'measure' ? 'Clique dois pontos para medir a distância · Esc volta a selecionar'
            : tool === 'wall' ? 'Arraste para desenhar a parede · o comprimento aparece ao vivo'
              : tool === 'divisor' ? 'Arraste para desenhar o divisor FOH/BOH'
                : tool === 'room' ? 'Arraste os vértices da casca para remodelar a sala · Esc volta a selecionar'
                  : 'Arraste para mover · alças para redimensionar · roda do mouse: zoom · arraste o vazio: pan'}
        </div>
        <div className="miniscale">
          <div className="sb"><i className="f" style={{ width: barPx }} /><i style={{ width: barPx }} /></div>
          <div>{scaleLabel}</div>
        </div>
      </main>

      {/* PROPRIEDADES / CAMADAS / RESUMO / CARIMBO */}
      <aside id="right" className="rail">
        <div className="sec">
          <h3>Propriedades</h3>
          {!sel && <div className="empty">Selecione uma peça no desenho para editar dimensões e posição — ou insira uma do catálogo.</div>}
          {sel && (
            <div className="props">
              {ed.collisions.has(sel.id) && (
                <div className="conflict-banner">⚠ Sobrepõe outra peça neste nível — o layout não vai dar certo.</div>
              )}
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
                <label>Nível · elevação base (z)</label>
                <div className="unit">
                  <input
                    inputMode="decimal"
                    key={levelOf(sel)}
                    defaultValue={levelOf(sel).toFixed(2)}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value.replace(',', '.'))
                      if (!Number.isNaN(v)) ed.patchItem(sel.id, { level: Math.max(0, v) })
                    }}
                  />
                </div>
                <div className="lvl-presets">
                  {LEVEL_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      className={`lvl-preset${Math.abs(levelOf(sel) - p.z) < 1e-3 ? ' active' : ''}`}
                      onClick={() => ed.patchItem(sel.id, { level: p.z })}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  className="pbtn stack"
                  disabled={stackTopBelow(sel, scene.items) == null}
                  onClick={() => ed.stackOnBelow(sel.id)}
                >
                  Empilhar sobre o de baixo
                </button>
                <div className="lvl-info">base {fmt(levelOf(sel))} m · topo {fmt(levelOf(sel) + sel.height)} m</div>
              </div>
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
              <button className="pbtn save" onClick={saveSelectedAsModel}><Icon name="save" />Salvar como modelo</button>
              {sel.type === 'porta' && (
                <button className="pbtn" onClick={() => ed.patchItem(sel.id, { doorFlip: !sel.doorFlip })}><Icon name="rotate" />Inverter abertura</button>
              )}
              <button className="pbtn danger" onClick={() => ed.removeItem(sel.id)}><Icon name="trash" />Excluir peça</button>
            </div>
          )}
        </div>

        <div className="sec">
          <h3>Validação</h3>
          <div className="valid">
            {ed.conflicts.length === 0 ? (
              <div className="valid-ok">✓ Sem sobreposições de volume</div>
            ) : (
              <>
                <div className="valid-bad">
                  ⚠ {ed.conflicts.length} sobreposiç{ed.conflicts.length > 1 ? 'ões' : 'ão'} — revise o layout
                </div>
                <ul className="valid-list">
                  {ed.conflicts.map((c, i) => (
                    <li key={i}>
                      <button onClick={() => ed.select(c.a.id)}>{c.a.name}</button>
                      <span className="x">✕</span>
                      <button onClick={() => ed.select(c.b.id)}>{c.b.name}</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ed.outOfBounds.size > 0 && (
              <div className="valid-bad">⚠ {ed.outOfBounds.size} peça(s) fora da casca — reposicione dentro do espaço.</div>
            )}
            <div className="valid-legend">
              <span><i className="lg bad" />&lt; 0,60</span>
              <span><i className="lg warn" />0,60–0,90</span>
              <span><i className="lg ok" />≥ 0,90 m</span>
            </div>
            <div className="valid-hint">Selecione uma peça para ver as folgas (vãos, corredores e passagens) até vizinhos e paredes.</div>
            <div className="util-legend">
              {UTIL_ORDER.map((t) => (
                <span key={t}><i className="ud" style={{ background: UTILITY_META[t].color }} />{UTILITY_META[t].label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="sec">
          <h3>Conformidade <span className="hint">sanitária SP · NBR 9050</span></h3>
          <div className="conf">
            {compliance.length === 0 ? (
              <div className="valid-ok">✓ Sem apontamentos de conformidade</div>
            ) : (
              <>
                <div className="conf-summary">
                  {compErrors > 0 && <span className="conf-pill error">{compErrors} crítico{compErrors > 1 ? 's' : ''}</span>}
                  {compWarns > 0 && <span className="conf-pill warn">{compWarns} atenção</span>}
                </div>
                <ul className="conf-list">
                  {compliance.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`conf-item ${c.severity}`}
                        disabled={c.itemIds.length === 0}
                        onClick={() => { if (c.itemIds.length) ed.select(c.itemIds[0]) }}
                      >
                        <span className="conf-dot" />
                        <span className="conf-text">
                          <span className="conf-title">{c.title}</span>
                          <span className="conf-detail">{c.detail}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" className="pbtn conf-restore" onClick={restoreDefault}>
              <Icon name="undo" />Restaurar cena padrão
            </button>
          </div>
        </div>

        <div className="sec">
          <h3>Camadas</h3>
          <div className="toggles">
            <div className={`sw${layers.cotas ? ' on' : ''}`} onClick={() => toggleLayer('cotas')}><span>Cotas da casca</span><span className="toggle" /></div>
            <div className={`sw${layers.items ? ' on' : ''}`} onClick={() => toggleLayer('items')}><span>Mobiliário</span><span className="toggle" /></div>
            <div className={`sw${layers.zones ? ' on' : ''}`} onClick={() => toggleLayer('zones')}><span>Zonas e fluxo</span><span className="toggle" /></div>
            <div className={`sw${layers.fohboh ? ' on' : ''}`} onClick={() => toggleLayer('fohboh')}><span>Setor FOH / BOH</span><span className="toggle" /></div>
            <div className={`sw${layers.grid ? ' on' : ''}`} onClick={() => toggleLayer('grid')}><span>Grade</span><span className="toggle" /></div>
            <div className={`sw${layers.utils ? ' on' : ''}`} onClick={() => toggleLayer('utils')}><span>Instalações</span><span className="toggle" /></div>
            <div className={`sw${showCirculation ? ' on' : ''}`} onClick={() => setShowCirculation((s) => !s)}><span>Circulação (corredores)</span><span className="toggle" /></div>
            <div className={`sw${showWorkZones ? ' on' : ''}`} onClick={() => setShowWorkZones((s) => !s)}><span>Zonas de trabalho</span><span className="toggle" /></div>
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
          <h3>Sala</h3>
          {ed.bounds && (
            <>
              <div className="grid2">
                <NumField label="Largura (m)" value={ed.bounds.maxX - ed.bounds.minX}
                  onCommit={(w) => ed.bounds && ed.patchRoom(makeRectangularRoom(w, ed.bounds.maxY - ed.bounds.minY))} />
                <NumField label="Profund. (m)" value={ed.bounds.maxY - ed.bounds.minY}
                  onCommit={(d) => ed.bounds && ed.patchRoom(makeRectangularRoom(ed.bounds.maxX - ed.bounds.minX, d))} />
              </div>
              <div className="lvl-info">Editar L×P redefine a sala como retângulo.</div>
              <div className="lvl-info">Ferramenta <b>Editar sala</b>: arraste os vértices da casca.</div>
            </>
          )}
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
      {showSchedule && <ScheduleModal scene={scene} onClose={() => setShowSchedule(false)} />}
      {showProjects && (
        <ProjectManager
          projects={ed.projects}
          currentId={ed.projectId}
          onOpen={(id) => { void ed.openProject(id); setShowProjects(false) }}
          onCreate={(t, n) => { void ed.createProject(t, n); setShowProjects(false) }}
          onRename={(id, n) => void ed.renameProject(id, n)}
          onDelete={(id) => void ed.deleteProject(id)}
          onDuplicate={(id) => void ed.duplicateProject(id)}
          onClose={() => setShowProjects(false)}
        />
      )}
      {showCreate && <EquipmentModal onClose={() => setShowCreate(false)} onCreate={createModel} />}
      <PrintPlan scene={scene} />
      <PrintExtras scene={scene} />
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
