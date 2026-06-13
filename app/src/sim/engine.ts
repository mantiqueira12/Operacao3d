/* Motor de simulação (DES espacial) — port fiel de prototype/planner/sim/sim-core.js.
   Encapsula todo o estado mutável numa classe `SimEngine` (testável e pronta p/ Web Worker).

   Diferenças DELIBERADAS sobre o original (documentadas):
   - RNG semeável (Rng) no lugar de Math.random() → runs reprodutíveis.
   - `stepAlong` consome o orçamento de velocidade inteiro atravessando vários waypoints,
     tornando o movimento dt-independente e fisicamente correto (o original avançava só
     um waypoint de 0,05 m por chamada, acoplando a velocidade à taxa de ticks).
   - Sem heatmap nem trilhas (`trail`): são artefatos puramente visuais que não alimentam
     nenhum KPI; voltam na camada de visualização 2D/3D.

   Unidades: metros · minutos simulados. Dia operacional: 10:00 → 22:00. */

import { baseConfig } from './defaults'
import { CUT_Y, DEFAULT_SCENE, deriveScene, GATE, OUT, W, zoneOf } from './geometry'
import { computeSlots, NavGrid } from './nav'
import { Rng } from './rng'
import type { MenuItem, SceneItem, SimConfig, Station, Vec2 } from './types'

export const DAY_START = 10 * 60 // 10:00 em minutos
export const DAY_END = 22 * 60 // 22:00
const OP_COLORS = ['#2A6FDB', '#1F8A5B', '#8E44AD', '#0E8A8A']
const ALERT_TTL = 8 * 60

/* ---------------------------------------------------------------- tipos internos */
type CustomerState = 'entering' | 'waiting' | 'at_pdv' | 'waiting_pickup' | 'leaving'

interface OrderStep {
  type: string
  time: number
  done: boolean
  busy?: number
  elapsed?: number
}

interface OrderLine {
  id: string
  name: string
  price: number
  pao: number
  steps: OrderStep[]
}

interface Customer {
  id: number
  x: number
  y: number
  state: CustomerState
  tArr: number
  tSS: number | null
  order: OrderLine[] | null
  orderTotal: number
  itemName: string
  orderNum: number | null
  queuePos: number
  pdvTimer: number
  pickupSlot: number
  served?: boolean
}

interface PrepOrder {
  customer: Customer
  items: OrderLine[]
  orderNum: number
  startTime: number
  steps: OrderStep[]
  custArrTime: number
}

interface OpTask {
  customer: Customer | null
  items: OrderLine[]
  steps: OrderStep[]
  si: number
  atEq: boolean
  tAtEq: number
  orderNum: number
  startTime: number
  pickedAt: number
  deliverTimer: number
  custArrTime: number
  stId: string | null
}

type BatchPhase = 'proof' | 'ready_oven' | 'carried' | 'bake' | 'ready_out'
interface Batch {
  id: number
  phase: BatchPhase
  t: number
  size: number
}

interface Operator {
  idx: number
  role: 'atendente' | 'padeiro'
  zone: 'foh' | 'boh'
  x: number
  y: number
  idleX: number
  idleY: number
  state: string
  task: OpTask | null
  statusText: string
  path: Vec2[]
  pathIdx: number
  tX: number
  tY: number
  color: string
  fixedEq: string
  fixoStep: OrderStep | null
  placed: boolean
  stuck: number
  carrying: string | null
  waitT: number
  tag?: string
  bstate?: string
  bt?: number
  batch?: Batch | null
  batchSize?: number
  busyState?: string
  slow?: number
  idleStall?: number
}

interface ActiveOrder {
  num: number
  items: string[]
  opIdx: number
  status: string
  startTime: number
  custId: number
  totalSteps: number
  currentStep: number
  phase: string
}

interface Alert {
  id: number
  t: number
  sev: 'info' | 'warn' | 'crit'
  msg: string
  key: string
}

interface BreadState {
  stock: number
  flour: number
  consumed: number
  baked: number
  mixes: number
  flourUsed: number
  stockoutMin: number
  waitingBread: number
  peakStock: number
  tercUsed: number
  hist: Array<{ t: number; stock: number; flour: number }>
  lastHist: number
  batches: Batch[]
  bid: number
}

interface Metrics {
  nextId: number
  nextArr: number
  orderNum: number
  served: number
  balked: number
  balkedPickup: number
  totalWait: number
  totalPrepTime: number
  totalQueueWait: number
  totalActualPrep: number
  revenue: number
  revenueBruto: number
  reembolsos: number
  servedRevenue: number
  itemsSold: Record<string, number>
  eqBusy: Record<string, number>
  eqTotal: Record<string, number>
  eqCount: Record<string, number>
  opBusy: number[]
  opOrders: number[]
  opDist: number[]
  congestMin: number
  simStartTime: number
  maxQueue: number
  slaOk: number
  servedHist: number[]
  balkedHist: number[]
  queueHist: number[]
  lastHistMin: number
  alerts: Alert[]
  alertKeys: Record<string, number>
  alertSeq: number
  bibite: number
  bibiteSold: number
  bibiteEmptyMin: number
  vitrineSold: number
  breadProducedShift: number
}

/* ---------------------------------------------------------------- tipos públicos (KPIs) */
export interface BreadKPIs {
  mode: string
  stock: number
  flourKg: number
  consumed: number
  baked: number
  mixes: number
  producedShift: number
  peakStock: number
  storageCap: number
  flourUsedKg: number
  stockoutMin: number
  waitingBread: number
  projDemandDay: number
  capacityDay: number
  capPerShift: number
  capPerDay: number
  shiftHours: number
  shifts: number
  shiftsNeeded: number | null
  hoursNeeded: number | null
  areaM2: number
  varPerBread: number
  ownCostDay: number
  ownPerBread: number
  laborDay: number
  deprecDay: number
  spaceDay: number
  investTotal: number
  tercAtQ: number
  tercPerBread: number
  hybridOwnPct: number
  hybridPerBread: number
  savingDay: number
  breakevenDay: number | null
  paybackMonths: number | null
  leftover: number
  leftoverCost: number
  sens: Array<{ q: number; own: number; terc: number }>
}

export interface SimKPIs {
  timestamp: string
  config: {
    operators: number
    fixedAssignments: string[]
    rate: number
    maxItems: number
    groupBias: number
    tolerance: number
    slaTarget: number
    pickupTimeout: number
    opCostHour: number
    fixedCostDay: number
    demandCurve: string
    walkSpeed: number
  }
  elapsedHours: number
  arrived: number
  served: number
  balked: number
  balkedPickup: number
  balkPct: number
  serviceRate: number
  throughputPerHour: number
  avgWaitMin: number
  avgPrepTimeMin: number
  avgActualPrepMin: number
  avgQueueWaitMin: number
  maxQueue: number
  slaOk: number
  slaPct: number
  revenueGross: number
  refunds: number
  revenueNet: number
  operationalCost: number
  breadCost: number
  margin: number
  avgTicket: number
  walkMetersTotal: number
  walkMetersPerOrder: number
  congestionMin: number
  itemsSold: Record<string, number>
  eqUtilizationPct: Record<string, number>
  opUtilizationPct: number[]
  bread: BreadKPIs
}

/* ============================================================================ */
export class SimEngine {
  cfg: SimConfig
  sceneItems: SceneItem[]
  simTime = DAY_START
  customers: Customer[] = []
  operators: Operator[] = []
  waitQueue: Customer[] = []
  prepQueue: PrepOrder[] = []
  activeOrders: ActiveOrder[] = []
  pdvBusy = false
  stations: Station[] = []
  stById: Record<string, Station> = {}
  blockers: SceneItem[] = []
  typesInScene: Array<{ type: string; label: string }> = []
  nav = new NavGrid()
  queueSlots: Vec2[] = []
  pickupSlots: Vec2[] = []
  eqLock: Record<string, Set<number>> = {}
  rng = new Rng()
  S!: Metrics
  BR!: BreadState

  constructor(config?: SimConfig, scene?: SceneItem[]) {
    this.cfg = config || baseConfig()
    this.sceneItems = scene && scene.length ? scene : DEFAULT_SCENE.map((o) => ({ ...o }))
    this.reset()
  }

  /* ---------------------------------------------------------------- controle */
  reset() {
    this.simTime = DAY_START
    this.customers = []
    this.waitQueue = []
    this.prepQueue = []
    this.activeOrders = []
    this.pdvBusy = false
    this.eqLock = {}
    this.rng = new Rng(this.cfg.seed)
    this.resetStats()
    this.resetBread()
    this.S.bibite = Math.round(this.cfg.inv.bibiteStart)
    this.rebuild()
    this.buildOperators()
  }

  private rebuild() {
    const d = deriveScene(this.sceneItems, this.cfg.capacity)
    this.stations = d.stations
    this.stById = d.stById
    this.blockers = d.blockers
    this.typesInScene = d.typesInScene
    this.nav = new NavGrid()
    this.nav.build(this.blockers, this.stations)
    const slots = computeSlots(this.stations)
    this.queueSlots = slots.queueSlots
    this.pickupSlots = slots.pickupSlots
  }

  private resetStats() {
    this.S = {
      nextId: 0,
      nextArr: DAY_START + 0.3,
      orderNum: 0,
      served: 0,
      balked: 0,
      balkedPickup: 0,
      totalWait: 0,
      totalPrepTime: 0,
      totalQueueWait: 0,
      totalActualPrep: 0,
      revenue: 0,
      revenueBruto: 0,
      reembolsos: 0,
      servedRevenue: 0,
      itemsSold: {},
      eqBusy: {},
      eqTotal: {},
      eqCount: {},
      opBusy: [],
      opOrders: [],
      opDist: [],
      congestMin: 0,
      simStartTime: DAY_START,
      maxQueue: 0,
      slaOk: 0,
      servedHist: [],
      balkedHist: [],
      queueHist: [],
      lastHistMin: DAY_START,
      alerts: [],
      alertKeys: {},
      alertSeq: 0,
      bibite: 0,
      bibiteSold: 0,
      bibiteEmptyMin: 0,
      vitrineSold: 0,
      breadProducedShift: 0,
    }
  }

  /* ---------------------------------------------------------------- alertas */
  private logEvent(sev: Alert['sev'], msg: string, key?: string) {
    if (!this.S.alerts) return
    key = key || msg
    const prev = this.S.alertKeys[key]
    if (prev != null && this.simTime - prev < 2.5) return
    this.S.alertKeys[key] = this.simTime
    this.S.alerts.push({ id: ++this.S.alertSeq, t: this.simTime, sev, msg, key })
    if (this.S.alerts.length > 60) this.S.alerts.shift()
  }
  private clearOldAlerts() {
    if (this.S.alerts) this.S.alerts = this.S.alerts.filter((a) => this.simTime - a.t < ALERT_TTL)
  }
  alerts(): Alert[] {
    return this.S.alerts || []
  }

  /* ---------------------------------------------------------------- estações / zonas */
  private stationsOfType(t: string): Station[] {
    return this.stations.filter((s) => s.type === t)
  }
  private stationsZone(t: string, zone?: 'foh' | 'boh'): Station[] {
    return this.stations.filter((s) => s.type === t && (!zone || zoneOf(s) === zone))
  }
  private lancheCat(m: MenuItem): 'lanche' | 'bebida' {
    return m.cat || (m.steps.some((s) => s.type === 'montagem' || s.type === 'forno' || s.type === 'prep') ? 'lanche' : 'bebida')
  }

  /* ---------------------------------------------------------------- operadores */
  private buildOperators() {
    this.operators = []
    const n = Math.max(1, Math.min(4, this.cfg.ops | 0))
    for (let i = 0; i < n; i++) {
      const spot =
        this.nav.findNearFree(this.nav.w2gx(0.45 + i * 0.55), this.nav.w2gy(3.65 + (i % 2) * 0.35), 30) ||
        { gx: this.nav.w2gx(0.6), gz: this.nav.w2gy(3.8) }
      this.operators.push({
        idx: i,
        role: 'atendente',
        zone: 'foh',
        x: this.nav.g2w(spot.gx),
        y: this.nav.g2w(spot.gz),
        idleX: this.nav.g2w(spot.gx),
        idleY: this.nav.g2w(spot.gz),
        state: 'idle',
        task: null,
        statusText: 'Livre',
        path: [],
        pathIdx: 0,
        tX: 0,
        tY: 0,
        color: OP_COLORS[i % 4],
        fixedEq: this.cfg.fixedEq[i] || '',
        fixoStep: null,
        placed: false,
        stuck: 0,
        carrying: null,
        waitT: 0,
      })
      this.S.opBusy[i] = this.S.opBusy[i] || 0
      this.S.opOrders[i] = this.S.opOrders[i] || 0
      this.S.opDist[i] = this.S.opDist[i] || 0
    }
    if (this.cfg.bread.mode !== 'terc') {
      const bi = this.operators.length
      const bspot = this.nav.findNearFree(this.nav.w2gx(0.9), this.nav.w2gy(1.1), 30) || { gx: this.nav.w2gx(0.9), gz: this.nav.w2gy(1.1) }
      this.operators.push({
        idx: bi,
        role: 'padeiro',
        tag: 'P',
        zone: 'boh',
        x: this.nav.g2w(bspot.gx),
        y: this.nav.g2w(bspot.gz),
        idleX: this.nav.g2w(bspot.gx),
        idleY: this.nav.g2w(bspot.gz),
        state: 'idle',
        bstate: 'idle',
        bt: 0,
        task: null,
        statusText: 'Padeiro · livre',
        path: [],
        pathIdx: 0,
        tX: 0,
        tY: 0,
        color: '#8A5A2B',
        fixedEq: '',
        fixoStep: null,
        placed: false,
        stuck: 0,
        carrying: null,
        waitT: 0,
      })
      this.S.opBusy[bi] = this.S.opBusy[bi] || 0
      this.S.opOrders[bi] = this.S.opOrders[bi] || 0
      this.S.opDist[bi] = this.S.opDist[bi] || 0
    }
  }

  private setOpTarget(op: Operator, tx: number, ty: number) {
    ty = Math.min(ty, GATE - 0.12)
    if (op.path && op.path.length && Math.abs(op.tX - tx) < 0.08 && Math.abs(op.tY - ty) < 0.08) return
    op.tX = tx
    op.tY = ty
    op.path = this.nav.findPath(op.x, op.y, tx, ty)
    op.pathIdx = 0
  }
  /* consome o orçamento de velocidade inteiro (movimento dt-independente). */
  private stepAlong(op: Operator, spd: number): boolean {
    if (!op.path || op.path.length === 0) return false
    let budget = spd
    while (budget > 1e-9) {
      if (op.pathIdx >= op.path.length) return true
      const wp = op.path[op.pathIdx]
      const dx = wp.x - op.x
      const dy = wp.y - op.y
      const d = Math.hypot(dx, dy)
      const mv = Math.min(d, budget)
      if (d > 1e-4) {
        op.x += (dx / d) * mv
        op.y += (dy / d) * mv
        this.S.opDist[op.idx] += mv
      }
      if (d <= budget) {
        op.pathIdx++
        budget -= d
        if (op.pathIdx >= op.path.length) return true
      } else {
        budget = 0
      }
    }
    return false
  }
  private stepTo(a: { x: number; y: number }, tx: number, ty: number, spd: number): boolean {
    const dx = tx - a.x
    const dy = ty - a.y
    const d = Math.hypot(dx, dy)
    if (d < 0.001) return true
    const mv = Math.min(d, spd)
    a.x += (dx / d) * mv
    a.y += (dy / d) * mv
    return d <= spd
  }

  /* locks por estação (instância) */
  private eqCap(id: string) {
    const st = this.stById[id]
    return st ? st.capacity || 1 : 1
  }
  private lockHas(id: string, oi: number) {
    return !!(this.eqLock[id] && this.eqLock[id].has(oi))
  }
  private lockFull(id: string, oi: number) {
    return !!(this.eqLock[id] && this.eqLock[id].size >= this.eqCap(id) && !this.lockHas(id, oi))
  }
  private lockAdd(id: string, oi: number) {
    if (!this.eqLock[id]) this.eqLock[id] = new Set()
    this.eqLock[id].add(oi)
  }
  private lockDel(id: string, oi: number) {
    if (!this.eqLock[id]) return
    this.eqLock[id].delete(oi)
    if (this.eqLock[id].size === 0) delete this.eqLock[id]
  }
  private lockClear(oi: number) {
    Object.keys(this.eqLock).forEach((k) => this.lockDel(k, oi))
  }

  private pickStation(type: string, fromX: number, fromY: number, oi: number, zone?: 'foh' | 'boh'): Station | null {
    let list = zone ? this.stationsZone(type, zone) : this.stationsOfType(type)
    if (!list.length) {
      list = this.stationsOfType(type)
      if (zone && list.length) this.logEvent('warn', 'Etapa "' + type + '" não tem estação na frente (FOH) — atendente usando o fundo', 'zone-' + type)
    }
    if (!list.length) return null
    let best: Station | null = null
    let bd = 1e9
    let bestAny: Station | null = null
    let bdAny = 1e9
    list.forEach((st) => {
      if (!st.sp) return
      const d = Math.hypot(st.sp.x - fromX, st.sp.y - fromY)
      if (d < bdAny) {
        bdAny = d
        bestAny = st
      }
      if (!this.lockFull(st.id, oi) && d < bd) {
        bd = d
        best = st
      }
    })
    return best || bestAny
  }

  /* ---------------------------------------------------------------- padaria */
  private resetBread() {
    const b = this.cfg.bread
    const ownPct = b.mode === 'hibrido' ? Math.max(0, Math.min(100, b.hybridOwnPct)) / 100 : b.mode === 'terc' ? 0 : 1
    const startStock =
      b.mode === 'terc'
        ? Math.round(b.tercQty)
        : b.mode === 'hibrido'
          ? Math.round(b.breadStart + b.tercQty * (1 - ownPct))
          : Math.round(b.breadStart)
    this.BR = {
      stock: startStock,
      flour: b.mode === 'terc' ? 0 : b.flourStart,
      consumed: 0,
      baked: 0,
      mixes: 0,
      flourUsed: 0,
      stockoutMin: 0,
      waitingBread: 0,
      peakStock: startStock,
      tercUsed: 0,
      hist: [],
      lastHist: DAY_START,
      batches: [],
      bid: 0,
    }
  }
  private stOf(t: string): Station | null {
    return this.stationsOfType(t)[0] || null
  }
  private bSpot(t: string, fbx: number, fby: number): { x: number; y: number; st: Station | null } {
    const st = this.stOf(t)
    return st && st.sp ? { x: st.sp.x, y: st.sp.y, st } : { x: fbx, y: fby, st: null }
  }
  private typeCap(t: string): number {
    const st = this.stOf(t)
    return st ? Math.max(1, (this.cfg.capacity[t] || 1) * this.stationsOfType(t).length) : this.cfg.capacity[t] || 1
  }
  private pipelineBreads(baker: Operator | null): number {
    let n = this.BR.batches.length * this.cfg.bread.batchSize
    if (baker && baker.bstate && baker.bstate !== 'idle') n += this.cfg.bread.batchSize
    return n
  }
  private breadPassive(dt: number) {
    const b = this.cfg.bread
    const stE = this.stOf('estufa')
    const stF = this.stOf('forno')
    const capE = Math.max(1, this.typeCap('estufa'))
    const capF = Math.max(1, this.typeCap('forno'))
    this.BR.batches.forEach((bt) => {
      if (bt.phase === 'proof') {
        bt.t += dt
        if (stE) this.S.eqBusy[stE.id] = (this.S.eqBusy[stE.id] || 0) + dt / capE
        if (bt.t >= b.proofTime) bt.phase = 'ready_oven'
      } else if (bt.phase === 'bake') {
        bt.t += dt
        if (stF) this.S.eqBusy[stF.id] = (this.S.eqBusy[stF.id] || 0) + dt / capF
        if (bt.t >= b.bakeTime) bt.phase = 'ready_out'
      }
    })
    if (this.simTime - this.BR.lastHist >= 5) {
      this.BR.hist.push({ t: this.simTime, stock: this.BR.stock, flour: +this.BR.flour.toFixed(2) })
      this.BR.lastHist = this.simTime
      if (this.BR.hist.length > 200) this.BR.hist.shift()
    }
  }
  private bakerTick(op: Operator, dt: number, spd: number) {
    const b = this.cfg.bread
    if (op.bstate !== 'idle') this.S.opBusy[op.idx] = (this.S.opBusy[op.idx] || 0) + dt

    const go = (spot: { x: number; y: number }) => {
      this.setOpTarget(op, spot.x, spot.y)
      return this.stepAlong(op, spd)
    }
    const mixer = this.bSpot('batedeira', 1.0, 1.3)
    const estufa = this.bSpot('estufa', 1.0, 2.0)
    const forno = this.bSpot('forno', 1.4, 0.6)
    const farinha = this.bSpot('estoque', 0.5, 0.35)
    const estoqueSt = this.stationsZone('estoque', 'boh')[0] || this.stOf('estoque')
    const deliver = estoqueSt && estoqueSt.sp ? { x: estoqueSt.sp.x, y: estoqueSt.sp.y } : { x: 0.9, y: CUT_Y - 0.35 }

    const readyOut = this.BR.batches.find((x) => x.phase === 'ready_out')
    const readyOven = this.BR.batches.find((x) => x.phase === 'ready_oven')
    const bakingN = this.BR.batches.filter((x) => x.phase === 'bake').length
    const proofN = this.BR.batches.filter((x) => x.phase === 'proof' || x.phase === 'ready_oven').length

    switch (op.bstate) {
      case 'idle': {
        const shiftEnd = (b.shiftStart || 600) + (b.shiftHours || 8) * 60 * Math.max(1, b.shifts || 1)
        const working = this.simTime < shiftEnd
        op.busyState = 'idle'
        op.statusText = working ? 'Padeiro · livre' : 'Padeiro · turno encerrado'
        if (readyOut) {
          op.bstate = 'to_oven_out'
          break
        }
        if (readyOven && bakingN < this.typeCap('forno')) {
          op.bstate = 'to_estufa_out'
          break
        }
        const kgNeed = b.batchSize * b.flourPerBread
        const inPipe = this.BR.stock + this.pipelineBreads(null)
        if (working && inPipe + b.batchSize <= (b.storageCap || 999) && this.BR.flour >= kgNeed && proofN < this.typeCap('estufa')) {
          op.bstate = 'to_flour'
          break
        }
        if (working) {
          if (this.BR.flour < kgNeed) this.logEvent('warn', 'Padeiro sem farinha — produção parada (reabastecer farinha)', 'flour-out')
          else if (inPipe + b.batchSize > (b.storageCap || 999)) {
            op.statusText = 'Estoque cheio (' + Math.round(inPipe) + '/' + b.storageCap + ') — aguardando venda'
            this.logEvent('info', 'Estoque de pães no limite (' + b.storageCap + ') — o espaço de estoque é o gargalo, não o padeiro', 'bread-full')
          } else if (proofN >= this.typeCap('estufa')) op.statusText = 'Estufa cheia — aguardando fermentação'
        }
        go({ x: op.idleX, y: op.idleY })
        break
      }
      case 'to_flour':
        op.busyState = 'busy'
        op.statusText = 'Buscando farinha'
        if (go(farinha)) {
          op.bstate = 'get_flour'
          op.bt = 0
        }
        break
      case 'get_flour':
        op.busyState = 'busy'
        op.statusText = 'Pesando farinha'
        op.bt = (op.bt || 0) + dt
        if (op.bt >= 0.6) {
          op.bstate = 'to_mixer'
          op.carrying = 'farinha'
        }
        break
      case 'to_mixer':
        op.busyState = 'busy'
        op.statusText = 'Indo à batedeira'
        if (go(mixer)) {
          op.bstate = 'mixing'
          op.bt = 0
        }
        break
      case 'mixing':
        op.busyState = 'busy'
        op.bt = (op.bt || 0) + dt
        op.statusText = 'Batedeira ' + Math.min(100, Math.round((op.bt / b.mixTime) * 100)) + '%'
        if (mixer.st) this.S.eqBusy[mixer.st.id] = (this.S.eqBusy[mixer.st.id] || 0) + dt
        if (op.bt >= b.mixTime) {
          const kg = b.batchSize * b.flourPerBread
          this.BR.flour = Math.max(0, this.BR.flour - kg)
          this.BR.flourUsed += kg
          this.BR.mixes++
          if (mixer.st) this.S.eqCount[mixer.st.id] = (this.S.eqCount[mixer.st.id] || 0) + 1
          op.carrying = 'massa'
          op.bstate = 'to_estufa'
        }
        break
      case 'to_estufa':
        op.busyState = 'busy'
        op.statusText = 'Levando massa à estufa'
        if (go(estufa)) {
          op.bt = 0
          op.bstate = 'load_estufa'
        }
        break
      case 'load_estufa':
        op.busyState = 'busy'
        op.statusText = 'Carregando estufa'
        op.bt = (op.bt || 0) + dt
        if (op.bt >= 0.4) {
          this.BR.batches.push({ id: ++this.BR.bid, phase: 'proof', t: 0, size: b.batchSize })
          if (estufa.st) this.S.eqCount[estufa.st.id] = (this.S.eqCount[estufa.st.id] || 0) + 1
          op.carrying = null
          op.bstate = 'idle'
        }
        break
      case 'to_estufa_out':
        op.busyState = 'busy'
        op.statusText = 'Retirando da estufa'
        if (go(estufa)) {
          const bt1 = this.BR.batches.find((x) => x.phase === 'ready_oven')
          if (!bt1) {
            op.bstate = 'idle'
            break
          }
          bt1.phase = 'carried'
          op.batch = bt1
          op.carrying = 'massa'
          op.bstate = 'to_oven_in'
        }
        break
      case 'to_oven_in':
        op.busyState = 'busy'
        op.statusText = 'Levando ao forno'
        if (go(forno)) {
          if (op.batch) {
            op.batch.phase = 'bake'
            op.batch.t = 0
          }
          if (forno.st) this.S.eqCount[forno.st.id] = (this.S.eqCount[forno.st.id] || 0) + 1
          op.batch = null
          op.carrying = null
          op.bstate = 'idle'
        }
        break
      case 'to_oven_out':
        op.busyState = 'busy'
        op.statusText = 'Retirando pães do forno'
        if (go(forno)) {
          const bt2 = this.BR.batches.find((x) => x.phase === 'ready_out')
          if (!bt2) {
            op.bstate = 'idle'
            break
          }
          this.BR.batches.splice(this.BR.batches.indexOf(bt2), 1)
          op.batchSize = bt2.size
          op.carrying = 'pao'
          op.bstate = 'deliver'
        }
        break
      case 'deliver':
        op.busyState = 'busy'
        op.statusText = 'Estocando ' + (op.batchSize || 0) + ' pães (fundo)'
        if (go(deliver)) {
          this.BR.stock += op.batchSize || 0
          this.BR.baked += op.batchSize || 0
          this.S.breadProducedShift += op.batchSize || 0
          this.BR.peakStock = Math.max(this.BR.peakStock || 0, this.BR.stock)
          op.batchSize = 0
          op.carrying = null
          op.bstate = 'idle'
        }
        break
      default:
        op.bstate = 'idle'
    }
  }
  private orderBreadNeed(order: { items?: OrderLine[] }): number {
    return (order.items || []).reduce((s, it) => s + (it.pao || 0), 0)
  }

  /* ---------------------------------------------------------------- demanda / pedidos */
  demandMultiplier(timeMin: number): number {
    if (this.cfg.demandCurve === 'flat') return 1
    const h = timeMin / 60
    const peak = (c: number, s: number, a: number) => a * Math.exp(-Math.pow(h - c, 2) / (2 * s * s))
    let m = 0.35
    if (this.cfg.demandCurve === 'lunch' || this.cfg.demandCurve === 'both') m += peak(13, 1.0, 2.0)
    if (this.cfg.demandCurve === 'dinner' || this.cfg.demandCurve === 'both') m += peak(20, 1.0, 1.6)
    if (this.cfg.demandCurve === 'lunch' && h > 16) m = 0.3
    return Math.max(0.1, m)
  }
  private spawnCustomer() {
    const id = this.S.nextId++
    this.customers.push({
      id,
      x: this.rng.uniform(OUT.x0 + 0.3, OUT.x1 - 0.3),
      y: OUT.y1 - 0.15,
      state: 'entering',
      tArr: this.simTime,
      tSS: null,
      order: null,
      orderTotal: 0,
      itemName: '',
      orderNum: null,
      queuePos: -1,
      pdvTimer: 0,
      pickupSlot: 0,
    })
    const base = Math.max(1, this.cfg.rate) / 60
    const rate = Math.max(0.001, base * this.demandMultiplier(this.simTime))
    this.S.nextArr = this.simTime + this.rng.exp(rate)
  }
  private pickByCategory(cat: 'sandwich' | 'drink'): MenuItem | null {
    const sw = this.cfg.menu.filter((m) => this.lancheCat(m) === 'lanche')
    const dr = this.cfg.menu.filter((m) => this.lancheCat(m) !== 'lanche')
    const pool = cat === 'sandwich' ? sw : dr
    if (!pool.length) return null
    const tot = pool.reduce((a, m) => a + m.prob, 0)
    const r = this.rng.random() * tot
    let acc = 0
    for (let i = 0; i < pool.length; i++) {
      acc += pool[i].prob
      if (r <= acc) return pool[i]
    }
    return pool[0]
  }
  private generateOrder(): OrderLine[] {
    const maxI = Math.max(1, Math.min(6, this.cfg.maxItems | 0))
    const bias = Math.max(0, Math.min(100, this.cfg.groupBias | 0)) / 100
    const decay = Math.pow(0.05, bias)
    const weights: number[] = []
    for (let n = 1; n <= maxI; n++) weights.push(Math.pow(decay, n - 1))
    const tot = weights.reduce((a, b) => a + b, 0)
    const r = this.rng.random() * tot
    let acc = 0
    let nItems = 1
    for (let i = 0; i < maxI; i++) {
      acc += weights[i]
      if (r <= acc) {
        nItems = i + 1
        break
      }
    }
    const pattern: Array<'sandwich' | 'drink'> = []
    for (let i = 0; i < nItems; i++) pattern.push('sandwich')
    if (this.rng.random() < 0.6) pattern.push('drink')
    const orders: OrderLine[] = []
    pattern.forEach((cat) => {
      const it = this.pickByCategory(cat)
      if (!it) return
      orders.push({
        id: it.id,
        name: it.name,
        price: it.price,
        pao: it.pao || 0,
        steps: it.steps
          .filter((s) => this.stationsOfType(s.type).length > 0)
          .map((s) => ({ type: s.type, time: s.time, done: false })),
      })
    })
    if (!orders.length && this.cfg.menu.length) {
      const it0 = this.cfg.menu[0]
      orders.push({
        id: it0.id,
        name: it0.name,
        price: it0.price,
        pao: it0.pao || 0,
        steps: it0.steps.map((s) => ({ type: s.type, time: s.time, done: false })),
      })
    }
    return orders
  }

  /* ---------------------------------------------------------------- ordens (display) */
  private updateOrder(num: number, status: string | null, phase: string | null, step: number | null) {
    const o = this.activeOrders.find((x) => x.num === num)
    if (!o) return
    if (status != null) o.status = status
    if (phase != null) o.phase = phase
    if (step != null) o.currentStep = step
  }
  private removeOrder(num: number) {
    const idx = this.activeOrders.findIndex((x) => x.num === num)
    if (idx >= 0) this.activeOrders.splice(idx, 1)
  }

  /* ============================================================== TICK */
  tick(dt: number) {
    if (this.simTime >= this.S.nextArr) this.spawnCustomer()
    const opSpd = this.cfg.walkSpeed * dt
    const cuSpd = this.cfg.custSpeed * dt
    const tol = this.cfg.tol

    if (this.simTime - this.S.lastHistMin >= 1.0) {
      this.S.servedHist.push(this.S.served)
      this.S.balkedHist.push(this.S.balked)
      this.S.queueHist.push(this.waitQueue.length)
      this.S.lastHistMin = this.simTime
      if (this.S.servedHist.length > 720) {
        this.S.servedHist.shift()
        this.S.balkedHist.shift()
        this.S.queueHist.shift()
      }
    }
    this.stations.forEach((st) => {
      this.S.eqTotal[st.id] = (this.S.eqTotal[st.id] || 0) + dt
      if (!this.S.eqBusy[st.id]) this.S.eqBusy[st.id] = 0
    })

    const caixa = this.stationsOfType('caixa')[0]
    const pdvX = caixa ? Math.max(0.25, Math.min(caixa.cx, W - 0.25)) : 0.4
    const pdvY = GATE + 0.35

    /* ---- clientes ---- */
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i]
      if (c.state === 'entering') {
        const slot = this.queueSlots[Math.min(this.waitQueue.length, this.queueSlots.length - 1)] || { x: pdvX, y: GATE + 0.5 }
        if (this.stepTo(c, slot.x, slot.y, cuSpd) || Math.hypot(c.x - slot.x, c.y - slot.y) < 0.15) {
          c.state = 'waiting'
          const order = this.generateOrder()
          c.order = order
          c.orderTotal = order.reduce((s, it) => s + it.price, 0)
          c.itemName = order.map((it) => it.name).join(' + ')
          this.waitQueue.push(c)
          c.queuePos = this.waitQueue.length - 1
          this.S.maxQueue = Math.max(this.S.maxQueue, this.waitQueue.length)
        }
      } else if (c.state === 'waiting') {
        const qs = this.queueSlots[Math.min(c.queuePos, this.queueSlots.length - 1)]
        if (qs) this.stepTo(c, qs.x, qs.y, cuSpd)
        const waited = this.simTime - c.tArr
        if (waited > tol) {
          c.state = 'leaving'
          this.S.balked++
          this.logEvent('warn', 'Cliente desistiu da fila (esperou ' + waited.toFixed(0) + ' min). Fila longa demais na frente.', 'balk')
          const qi = this.waitQueue.indexOf(c)
          if (qi >= 0) this.waitQueue.splice(qi, 1)
          this.waitQueue.forEach((cu, k) => (cu.queuePos = k))
          continue
        }
        if (c.queuePos === 0 && !this.pdvBusy) {
          this.pdvBusy = true
          this.waitQueue.shift()
          this.waitQueue.forEach((cu, k) => (cu.queuePos = k))
          c.state = 'at_pdv'
          c.pdvTimer = 0
        }
      } else if (c.state === 'at_pdv') {
        if (this.stepTo(c, pdvX, pdvY, cuSpd) || Math.hypot(c.x - pdvX, c.y - pdvY) < 0.12) {
          c.pdvTimer += dt
          if (caixa) this.S.eqBusy[caixa.id] = (this.S.eqBusy[caixa.id] || 0) + dt
          if (c.pdvTimer >= this.cfg.payTime) {
            this.S.revenue += c.orderTotal
            this.S.revenueBruto += c.orderTotal
            c.order!.forEach((it) => {
              this.S.itemsSold[it.id] = (this.S.itemsSold[it.id] || 0) + 1
              const mi = this.cfg.menu.find((m) => m.id === it.id)
              if (mi && this.lancheCat(mi) !== 'lanche') {
                if (this.S.bibite > 0) {
                  this.S.bibite--
                  this.S.bibiteSold++
                } else this.logEvent('warn', 'Geladeira de bebidas vazia — bebida vendida sem estoque (repor)', 'bibite-out')
              } else if (mi) this.S.vitrineSold++
            })
            this.pdvBusy = false
            const used = this.customers.filter((cu) => cu.state === 'waiting_pickup').map((cu) => cu.pickupSlot)
            let ps = -1
            for (let s2 = 0; s2 < this.pickupSlots.length; s2++) {
              if (used.indexOf(s2) < 0) {
                ps = s2
                break
              }
            }
            if (ps < 0) ps = 0
            c.pickupSlot = ps
            c.state = 'waiting_pickup'
            c.tSS = this.simTime
            const orderNum = ++this.S.orderNum
            c.orderNum = orderNum
            const typeOrder: string[] = []
            const byType: Record<string, number> = {}
            c.order!.forEach((it) => {
              it.steps.forEach((st) => {
                if (!byType[st.type]) {
                  typeOrder.push(st.type)
                  byType[st.type] = 0
                }
                byType[st.type] += byType[st.type] === 0 ? st.time : st.time * 0.5
              })
            })
            const allSteps: OrderStep[] = typeOrder.map((t) => ({ type: t, time: byType[t], done: false }))
            this.prepQueue.push({ customer: c, items: c.order!, orderNum, startTime: this.simTime, steps: allSteps, custArrTime: c.tArr })
            this.activeOrders.push({
              num: orderNum,
              items: c.order!.map((it) => it.name),
              opIdx: -1,
              status: 'Fila preparo',
              startTime: this.simTime,
              custId: c.id,
              totalSteps: allSteps.length + 1,
              currentStep: 0,
              phase: 'queued',
            })
          }
        }
      } else if (c.state === 'waiting_pickup') {
        const pk = this.pickupSlots[c.pickupSlot] || this.pickupSlots[0]
        if (pk) this.stepTo(c, pk.x, pk.y, cuSpd)
        const pw = this.simTime - (c.tSS || this.simTime)
        if (pw > this.cfg.pickupTimeout) {
          c.state = 'leaving'
          this.S.balkedPickup++
          this.logEvent('crit', 'Abandono na retirada (#' + (c.orderNum || '?') + ') — pedido pago e não entregue no prazo (reembolso).', 'balk-pickup')
          this.S.reembolsos += c.orderTotal || 0
          this.S.revenue = this.S.revenueBruto - this.S.reembolsos
          c.order!.forEach((it) => {
            if (this.S.itemsSold[it.id]) this.S.itemsSold[it.id]--
          })
          const pi = this.prepQueue.findIndex((p) => p.customer === c)
          if (pi >= 0) this.prepQueue.splice(pi, 1)
          if (c.orderNum) this.removeOrder(c.orderNum)
          this.operators.forEach((op) => {
            if (op.task && op.task.customer === c) op.task.customer = null
          })
        }
      } else if (c.state === 'leaving') {
        this.stepTo(c, c.x, OUT.y1 + 0.5, cuSpd * 1.8)
        if (c.y > OUT.y1 + 0.3) this.customers.splice(i, 1)
      }
    }

    /* repulsão entre clientes */
    const MIN_D = 0.34
    for (let i = 0; i < this.customers.length; i++) {
      const ci = this.customers[i]
      if (ci.state === 'leaving') continue
      for (let j = i + 1; j < this.customers.length; j++) {
        const cj = this.customers[j]
        if (cj.state === 'leaving') continue
        const dx = ci.x - cj.x
        const dy = ci.y - cj.y
        const d = Math.hypot(dx, dy)
        if (d < MIN_D && d > 0.001) {
          const ov = (MIN_D - d) * 0.4
          const nx = dx / d
          const ny = dy / d
          ci.x += nx * ov * 0.5
          ci.y += ny * ov * 0.5
          cj.x -= nx * ov * 0.5
          cj.y -= ny * ov * 0.5
        }
      }
      ci.x = Math.max(OUT.x0 + 0.15, Math.min(OUT.x1 - 0.15, ci.x))
      ci.y = Math.max(GATE + 0.2, Math.min(OUT.y1, ci.y))
    }

    /* ---- atribuição: volantes pegam pedidos (se há pão em estoque) ---- */
    this.operators.forEach((op) => {
      if (op.fixedEq || op.role === 'padeiro') return
      if (op.state !== 'idle' || this.prepQueue.length === 0) return
      let pick = -1
      for (let q = 0; q < this.prepQueue.length; q++) {
        if (this.orderBreadNeed(this.prepQueue[q]) <= this.BR.stock) {
          pick = q
          break
        }
      }
      if (pick < 0) return
      const order = this.prepQueue.splice(pick, 1)[0]
      const bn = this.orderBreadNeed(order)
      if (bn > 0) {
        this.BR.stock -= bn
        this.BR.consumed += bn
      }
      op.task = {
        customer: order.customer,
        items: order.items,
        steps: order.steps,
        si: 0,
        atEq: false,
        tAtEq: 0,
        orderNum: order.orderNum,
        startTime: order.startTime,
        pickedAt: this.simTime,
        deliverTimer: 0,
        custArrTime: order.custArrTime,
        stId: null,
      }
      op.state = 'working'
      op.statusText = 'Preparando #' + op.task.orderNum
      const ao = this.activeOrders.find((a) => a.num === op.task!.orderNum)
      if (ao) {
        ao.opIdx = op.idx
        ao.status = 'Preparando'
        ao.phase = 'preparing'
      }
    })

    /* ---- padaria: estágios passivos + falta de pão ---- */
    this.breadPassive(dt)
    this.clearOldAlerts()
    this.BR.waitingBread = this.prepQueue.filter((o) => this.orderBreadNeed(o) > this.BR.stock).length
    if (this.BR.waitingBread > 0) {
      this.BR.stockoutMin += dt
      this.logEvent('crit', 'Pão esgotado — ' + this.BR.waitingBread + ' pedido(s) parados na frente. A produção do fundo não acompanha a demanda.', 'bread-stockout')
      this.prepQueue.forEach((o) => {
        if (this.orderBreadNeed(o) > this.BR.stock) this.updateOrder(o.orderNum, 'Sem pão — aguardando', null, null)
      })
    }
    if (this.S.bibite <= 0 && this.simTime > this.S.simStartTime + 1) this.S.bibiteEmptyMin += dt

    /* pré-passo: proximidade entre operadores reduz velocidade (corredor estreito) */
    this.operators.forEach((op) => (op.slow = 1))
    for (let i = 0; i < this.operators.length; i++) {
      for (let j2 = i + 1; j2 < this.operators.length; j2++) {
        const d2 = Math.hypot(this.operators[i].x - this.operators[j2].x, this.operators[i].y - this.operators[j2].y)
        if (d2 < 0.42) {
          this.operators[i].slow = 0.5
          this.operators[j2].slow = 0.5
        }
      }
    }

    /* ---- operadores ---- */
    this.operators.forEach((op, oi) => {
      const opSpdEff = opSpd * (op.slow || 1)
      if (op.role === 'padeiro') {
        this.bakerTick(op, dt, opSpdEff)
        return
      }
      /* FIXO: parado na estação, faz marcha */
      if (op.fixedEq) {
        const stF = this.stById[op.fixedEq]
        if (!stF) {
          op.statusText = 'fixo inválido'
          return
        }
        if (!op.placed && stF.sp) {
          op.x = stF.sp.x
          op.y = stF.sp.y
          op.idleX = op.x
          op.idleY = op.y
          op.path = []
          op.placed = true
        }
        if (!op.fixoStep) {
          let cand: OrderStep | null = null
          for (let k = 0; k < this.operators.length && !cand; k++) {
            const op2 = this.operators[k]
            if (!op2.task || op2.fixedEq) continue
            for (let si = 0; si < op2.task.steps.length; si++) {
              const st2 = op2.task.steps[si]
              if (st2.type === stF.type && !st2.done && st2.busy === undefined) {
                cand = st2
                break
              }
            }
          }
          if (!cand) {
            for (let k = 0; k < this.prepQueue.length && !cand; k++) {
              for (let si = 0; si < this.prepQueue[k].steps.length; si++) {
                const st3 = this.prepQueue[k].steps[si]
                if (st3.type === stF.type && !st3.done && st3.busy === undefined) {
                  cand = st3
                  break
                }
              }
            }
          }
          if (cand) {
            cand.busy = op.idx
            cand.elapsed = 0
            op.fixoStep = cand
          }
        }
        if (op.fixoStep) {
          this.S.eqBusy[stF.id] = (this.S.eqBusy[stF.id] || 0) + dt
          this.S.opBusy[oi] = (this.S.opBusy[oi] || 0) + dt
          op.fixoStep.elapsed = (op.fixoStep.elapsed || 0) + dt
          const pctF = Math.min(100, Math.round((op.fixoStep.elapsed / op.fixoStep.time) * 100))
          op.statusText = stF.name + ' ' + pctF + '%'
          op.busyState = 'busy'
          if (op.fixoStep.elapsed >= op.fixoStep.time) {
            op.fixoStep.done = true
            delete op.fixoStep.busy
            delete op.fixoStep.elapsed
            this.S.eqCount[stF.id] = (this.S.eqCount[stF.id] || 0) + 1
            op.fixoStep = null
          }
        } else {
          op.statusText = 'aguardando em ' + stF.name
          op.busyState = 'idle'
        }
        return
      }

      if (op.state === 'idle') {
        this.setOpTarget(op, op.idleX, op.idleY)
        this.stepAlong(op, opSpdEff)
        op.statusText = 'Livre'
        op.busyState = 'idle'
        op.stuck = 0
        return
      }
      this.S.opBusy[oi] = (this.S.opBusy[oi] || 0) + dt

      if (op.state === 'working') {
        const t = op.task
        if (!t || t.si >= t.steps.length) {
          this.lockClear(oi)
          op.carrying = t && t.items && t.items[0] ? t.items[0].id : 'spaccata'
          op.state = 'to_balcao'
          const cx2 = t && t.customer ? Math.max(0.25, Math.min(t.customer.x, W - 0.25)) : W / 2
          this.setOpTarget(op, cx2, GATE - 0.3)
          op.statusText = 'Levando #' + (t ? t.orderNum : '')
          op.busyState = 'busy'
          if (t) this.updateOrder(t.orderNum, 'Entregando', 'delivering', t.steps.length)
          return
        }
        const step = t.steps[t.si]
        if (step.done) {
          t.si++
          t.atEq = false
          t.tAtEq = 0
          t.stId = null
          this.updateOrder(t.orderNum, null, 'preparing', t.si)
          return
        }
        const hasFixo = this.operators.some((o2) => {
          const sf = this.stById[o2.fixedEq]
          return sf && sf.type === step.type
        })
        if (hasFixo) {
          op.statusText = 'Aguardando fixo: ' + step.type
          op.busyState = 'wait'
          this.updateOrder(t.orderNum, 'Fixo: ' + step.type, null, null)
          return
        }
        if (!t.stId) {
          const stPick = this.pickStation(step.type, op.x, op.y, oi, 'foh')
          if (!stPick) {
            step.done = true
            return
          }
          t.stId = stPick.id
        }
        const stp = this.stById[t.stId]
        if (!stp || !stp.sp) {
          t.stId = null
          t.atEq = false
          t.tAtEq = 0
          return
        }
        if (!t.atEq) {
          if (this.lockFull(t.stId, oi)) {
            op.statusText = 'Aguardando ' + stp.name
            op.busyState = 'wait'
            this.updateOrder(t.orderNum, 'Aguardando ' + stp.name, null, null)
            return
          }
          op.busyState = 'busy'
          op.statusText = 'Indo p/ ' + stp.name
          this.setOpTarget(op, stp.sp.x, stp.sp.y)
          if (this.stepAlong(op, opSpdEff)) {
            t.atEq = true
            this.lockAdd(t.stId, oi)
            op.stuck = 0
          } else if (!op.path || op.path.length === 0) {
            op.stuck += dt
            if (op.stuck > 0.8) {
              this.nav.clearPathCache()
              this.setOpTarget(op, stp.sp.x, stp.sp.y)
            }
            if (op.stuck > 3.0 && Math.hypot(op.x - stp.sp.x, op.y - stp.sp.y) < 0.45) {
              t.atEq = true
              this.lockAdd(t.stId, oi)
              op.stuck = 0
            } else if (op.stuck > 6.0) {
              t.stId = null
              op.stuck = 0
            }
          }
        } else {
          op.busyState = 'busy'
          this.S.eqBusy[t.stId] = (this.S.eqBusy[t.stId] || 0) + dt
          t.tAtEq += dt
          const pct = Math.min(100, Math.round((t.tAtEq / step.time) * 100))
          op.statusText = stp.name + ' ' + pct + '%'
          this.updateOrder(t.orderNum, stp.name + ' ' + (t.si + 1) + '/' + t.steps.length + ' (' + pct + '%)', null, null)
          if (t.tAtEq >= step.time) {
            this.S.eqCount[t.stId] = (this.S.eqCount[t.stId] || 0) + 1
            this.lockDel(t.stId, oi)
            t.si++
            t.atEq = false
            t.tAtEq = 0
            t.stId = null
            this.updateOrder(t.orderNum, null, 'preparing', t.si)
          }
        }
      } else if (op.state === 'to_balcao') {
        op.busyState = 'busy'
        let arr = this.stepAlong(op, opSpdEff)
        if (!arr && (!op.path || op.path.length === 0)) {
          op.stuck += dt
          if (op.stuck > 0.8) {
            this.nav.clearPathCache()
            op.path = this.nav.findPath(op.x, op.y, op.tX, op.tY)
            op.pathIdx = 0
          }
          if (op.stuck > 3.0 && Math.hypot(op.x - op.tX, op.y - op.tY) < 0.6) arr = true
        }
        if (arr && op.task) {
          op.state = 'delivering'
          op.task.deliverTimer = 0
          op.statusText = 'Entregando #' + op.task.orderNum
          op.stuck = 0
        }
      } else if (op.state === 'delivering') {
        op.busyState = 'busy'
        const t = op.task!
        t.deliverTimer += dt
        if (t.deliverTimer >= 0.3) {
          const c2 = t.customer
          const prepDur = this.simTime - t.startTime
          const actualPrep = this.simTime - (t.pickedAt || t.startTime)
          const queueW = (t.pickedAt || t.startTime) - t.startTime
          if (prepDur <= this.cfg.sla) this.S.slaOk++
          this.S.served++
          this.S.totalPrepTime += prepDur
          this.S.totalActualPrep += actualPrep
          this.S.totalQueueWait += queueW
          this.S.opOrders[op.idx] = (this.S.opOrders[op.idx] || 0) + 1
          this.S.totalWait += this.simTime - (t.custArrTime || t.startTime)
          if (c2) {
            this.S.servedRevenue += c2.orderTotal || 0
            c2.state = 'leaving'
            c2.served = true
          } else {
            this.S.servedRevenue += t.items ? t.items.reduce((s, it) => s + it.price, 0) : 0
          }
          op.carrying = null
          this.removeOrder(t.orderNum)
          op.task = null
          op.state = 'idle'
        }
      }
    })

    /* ---- watchdog: diagnostica travas e ociosidade ---- */
    this.operators.forEach((op) => {
      if (op.role === 'padeiro') return
      if (op.busyState === 'wait') {
        op.waitT = (op.waitT || 0) + dt
        if (op.waitT > 4) this.logEvent('warn', 'Atendente ' + (op.idx + 1) + ': ' + (op.statusText || 'aguardando'), 'op-wait-' + op.idx)
      } else op.waitT = 0
      if (op.state === 'idle' && !op.fixedEq) {
        const feasible = this.prepQueue.some((o) => this.orderBreadNeed(o) <= this.BR.stock)
        if (feasible) {
          op.idleStall = (op.idleStall || 0) + dt
          if (op.idleStall > 3) {
            this.logEvent('crit', 'Atendente ' + (op.idx + 1) + ' parado com fila e pão disponível — travamento; reatribuindo', 'op-stall-' + op.idx)
            op.stuck = 0
            op.idleStall = 0
            this.nav.clearPathCache()
          }
        } else op.idleStall = 0
      } else op.idleStall = 0
    })

    /* congestionamento entre operadores + separação física */
    for (let i = 0; i < this.operators.length; i++) {
      for (let j = i + 1; j < this.operators.length; j++) {
        const oa = this.operators[i]
        const ob = this.operators[j]
        const ddx = oa.x - ob.x
        const ddy = oa.y - ob.y
        const dd = Math.hypot(ddx, ddy)
        if (dd < 0.36 && (oa.state !== 'idle' || ob.state !== 'idle')) this.S.congestMin += dt
        if (dd < 0.3 && dd > 0.001) {
          const ov2 = (0.3 - dd) * 0.5
          const nx2 = ddx / dd
          const ny2 = ddy / dd
          const ax = oa.x + nx2 * ov2
          const ay = oa.y + ny2 * ov2
          const bx = ob.x - nx2 * ov2
          const by = ob.y - ny2 * ov2
          if (this.nav.gFree(this.nav.w2gx(ax), this.nav.w2gy(ay))) {
            oa.x = ax
            oa.y = ay
          }
          if (this.nav.gFree(this.nav.w2gx(bx), this.nav.w2gy(by))) {
            ob.x = bx
            ob.y = by
          }
        }
      }
    }
  }

  /* ============================================================== KPIs */
  private attendantCount(): number {
    return this.operators.filter((o) => o.role !== 'padeiro').length
  }
  private breadInvest(): { total: number; deprecDay: number } {
    const b = this.cfg.bread
    const tot = (b.investBatedeira || 0) + (b.investEstufa || 0) + (b.investForno || 0)
    if (tot <= 0) return { total: b.invest || 0, deprecDay: (b.invest || 0) / Math.max(1, (b.deprecMonths || 36) * 30) }
    const dd =
      (b.investBatedeira || 0) / Math.max(1, (b.lifeBatedeira || 60) * 30) +
      (b.investEstufa || 0) / Math.max(1, (b.lifeEstufa || 48) * 30) +
      (b.investForno || 0) / Math.max(1, (b.lifeForno || 36) * 30)
    return { total: tot, deprecDay: dd }
  }
  private breadFootprintM2(): number {
    const FB: Record<string, number> = { batedeira: 0.3, estufa: 0.47, forno: 0.62 }
    let foot = 0
    ;['batedeira', 'estufa', 'forno'].forEach((t) => {
      const list = this.stationsOfType(t)
      if (list.length) list.forEach((st) => (foot += st.w * st.h))
      else foot += FB[t]
    })
    return +(foot * 1.8).toFixed(2)
  }
  private breadCostNow(elapsedH: number): number {
    const b = this.cfg.bread
    if (b.mode === 'terc') return this.BR.consumed * b.tercPrice + b.tercFrete * (elapsedH / 12)
    const inv = this.breadInvest()
    const fixedDay = b.bakerCost * b.shiftHours * Math.max(1, b.shifts || 1) + inv.deprecDay + this.breadFootprintM2() * b.rentM2 / 30
    return fixedDay * (elapsedH / 12) + this.BR.flourUsed * b.flourPrice + this.BR.mixes * b.energyPerBatch + this.BR.consumed * b.extraPerBread
  }
  private breadKPIs(): BreadKPIs {
    const b = this.cfg.bread
    const elapsedH = Math.max(0.001, (this.simTime - this.S.simStartTime) / 60)
    const consPerH = this.BR.consumed / elapsedH
    const projDay = Math.round(consPerH * 12)
    const areaM2 = this.breadFootprintM2()
    const capE = this.typeCap('estufa')
    const capF = this.typeCap('forno')
    const handling = 3
    const cyclePerBatch = Math.max(b.mixTime + handling, b.proofTime / Math.max(1, capE), b.bakeTime / Math.max(1, capF))
    const batchesPerHour = 60 / cyclePerBatch
    const capPerShift = Math.floor(batchesPerHour * b.shiftHours * b.batchSize)
    const capPerDay = capPerShift * Math.max(1, b.shifts || 1)
    const shiftsNeeded = projDay > 0 ? Math.max(1, Math.ceil(projDay / Math.max(1, capPerShift))) : null
    const hoursNeeded = projDay > 0 ? +(projDay / Math.max(1, batchesPerHour * b.batchSize)).toFixed(1) : null
    const varPerBread = b.flourPerBread * b.flourPrice + b.extraPerBread + b.energyPerBatch / b.batchSize
    const inv = this.breadInvest()
    const deprecDay = inv.deprecDay
    const spaceDay = (areaM2 * b.rentM2) / 30
    const laborDay = b.bakerCost * b.shiftHours * Math.max(1, b.shifts || 1)
    const fixedDay = laborDay + deprecDay + spaceDay
    const Q = Math.max(1, projDay || b.tercQty)
    const ownDay = fixedDay + Q * varPerBread
    const ownPerBread = +(ownDay / Q).toFixed(2)
    const tercAtQ = Q * b.tercPrice + b.tercFrete
    const savingDay = tercAtQ - ownDay
    const breakeven = b.tercPrice > varPerBread ? Math.ceil(fixedDay / (b.tercPrice - varPerBread)) : null
    const paybackM = savingDay > 0 ? +(inv.total / (savingDay * 30)).toFixed(1) : null
    const ownPct = b.mode === 'hibrido' ? Math.max(0, Math.min(100, b.hybridOwnPct)) / 100 : b.mode === 'terc' ? 0 : 1
    const hybridPerBread = +(ownPct * ownPerBread + (1 - ownPct) * b.tercPrice).toFixed(2)
    const sens: Array<{ q: number; own: number; terc: number }> = []
    ;[40, 80, 120, 160, 200, 260, 320].forEach((q) => {
      sens.push({ q, own: +((fixedDay + q * varPerBread) / q).toFixed(2), terc: b.tercPrice })
    })
    return {
      mode: b.mode,
      stock: this.BR.stock,
      flourKg: +this.BR.flour.toFixed(1),
      consumed: this.BR.consumed,
      baked: this.BR.baked,
      mixes: this.BR.mixes,
      producedShift: this.BR.baked,
      peakStock: this.BR.peakStock || this.BR.stock,
      storageCap: b.storageCap,
      flourUsedKg: +this.BR.flourUsed.toFixed(1),
      stockoutMin: +this.BR.stockoutMin.toFixed(1),
      waitingBread: this.BR.waitingBread,
      projDemandDay: projDay,
      capacityDay: capPerDay,
      capPerShift,
      capPerDay,
      shiftHours: b.shiftHours,
      shifts: Math.max(1, b.shifts || 1),
      shiftsNeeded,
      hoursNeeded,
      areaM2,
      varPerBread: +varPerBread.toFixed(2),
      ownCostDay: Math.round(ownDay),
      ownPerBread,
      laborDay: Math.round(laborDay),
      deprecDay: +deprecDay.toFixed(0),
      spaceDay: +spaceDay.toFixed(0),
      investTotal: Math.round(inv.total),
      tercAtQ: Math.round(tercAtQ),
      tercPerBread: b.tercPrice,
      hybridOwnPct: Math.round(ownPct * 100),
      hybridPerBread,
      savingDay: Math.round(savingDay),
      breakevenDay: breakeven,
      paybackMonths: paybackM,
      leftover: this.BR.stock,
      leftoverCost: Math.round(this.BR.stock * (b.mode === 'terc' ? b.tercPrice : varPerBread)),
      sens,
    }
  }

  computeKPIs(): SimKPIs {
    const totalArrived = this.S.nextId
    const elapsedH = Math.max(0.001, (this.simTime - this.S.simStartTime) / 60)
    const breadCost = this.breadCostNow(elapsedH)
    const totalCost = this.cfg.opCost * this.attendantCount() * elapsedH + this.cfg.fixedCost * (elapsedH / 12) + breadCost
    const margin = this.S.revenue - totalCost
    const slaPct = this.S.served > 0 ? (this.S.slaOk / this.S.served) * 100 : 0
    const balkPct = totalArrived > 0 ? (this.S.balked / totalArrived) * 100 : 0
    const eqUtils: Record<string, number> = {}
    this.stations.forEach((st) => {
      const tot = this.S.eqTotal[st.id] || 1
      const busy = this.S.eqBusy[st.id] || 0
      eqUtils[st.id] = Math.min(100, Math.round((busy / tot) * 100))
    })
    const opUtils = this.operators.map((_op, i) => Math.min(100, Math.round(((this.S.opBusy[i] || 0) / (elapsedH * 60)) * 100)))
    const totDist = this.S.opDist.reduce((a, b) => a + (b || 0), 0)
    return {
      timestamp: new Date().toISOString(),
      config: {
        operators: this.operators.length,
        fixedAssignments: this.operators.map((o) => {
          const st = this.stById[o.fixedEq]
          return st ? st.name : 'volante'
        }),
        rate: this.cfg.rate,
        maxItems: this.cfg.maxItems,
        groupBias: this.cfg.groupBias,
        tolerance: this.cfg.tol,
        slaTarget: this.cfg.sla,
        pickupTimeout: this.cfg.pickupTimeout,
        opCostHour: this.cfg.opCost,
        fixedCostDay: this.cfg.fixedCost,
        demandCurve: this.cfg.demandCurve,
        walkSpeed: this.cfg.walkSpeed,
      },
      elapsedHours: +elapsedH.toFixed(2),
      arrived: totalArrived,
      served: this.S.served,
      balked: this.S.balked,
      balkedPickup: this.S.balkedPickup,
      balkPct: +balkPct.toFixed(1),
      serviceRate: totalArrived > 0 ? +((this.S.served / totalArrived) * 100).toFixed(1) : 0,
      throughputPerHour: +(this.S.served / elapsedH).toFixed(1),
      avgWaitMin: this.S.served > 0 ? +(this.S.totalWait / this.S.served).toFixed(2) : 0,
      avgPrepTimeMin: this.S.served > 0 ? +(this.S.totalPrepTime / this.S.served).toFixed(2) : 0,
      avgActualPrepMin: this.S.served > 0 ? +(this.S.totalActualPrep / this.S.served).toFixed(2) : 0,
      avgQueueWaitMin: this.S.served > 0 ? +(this.S.totalQueueWait / this.S.served).toFixed(2) : 0,
      maxQueue: this.S.maxQueue,
      slaOk: this.S.slaOk,
      slaPct: +slaPct.toFixed(1),
      revenueGross: Math.round(this.S.revenueBruto),
      refunds: Math.round(this.S.reembolsos),
      revenueNet: Math.round(this.S.revenue),
      operationalCost: Math.round(totalCost),
      breadCost: Math.round(breadCost),
      margin: Math.round(margin),
      avgTicket: this.S.served > 0 ? +(this.S.servedRevenue / this.S.served).toFixed(2) : 0,
      walkMetersTotal: Math.round(totDist),
      walkMetersPerOrder: this.S.served > 0 ? +(totDist / this.S.served).toFixed(1) : 0,
      congestionMin: +this.S.congestMin.toFixed(1),
      itemsSold: { ...this.S.itemsSold },
      eqUtilizationPct: eqUtils,
      opUtilizationPct: opUtils,
      bread: this.breadKPIs(),
    }
  }

  /* distância de fluxo por item do cardápio (layout real) */
  flowDistances(): Array<{ id: string; name: string; dist: number | null; steps: number }> {
    return this.cfg.menu.map((mi) => {
      const pts: Vec2[] = []
      let ok = true
      mi.steps.forEach((s) => {
        const st = this.stationsOfType(s.type)[0]
        if (st && st.sp) pts.push(st.sp)
        else ok = false
      })
      let d = 0
      for (let i = 1; i < pts.length; i++) {
        const p = this.nav.findPath(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)
        d += this.nav.pathLen(p, pts[i - 1].x, pts[i - 1].y)
      }
      if (pts.length) {
        const lp = pts[pts.length - 1]
        const pd = this.nav.findPath(lp.x, lp.y, W / 2, GATE - 0.3)
        d += this.nav.pathLen(pd, lp.x, lp.y)
      }
      return { id: mi.id, name: mi.name, dist: ok ? +d.toFixed(1) : null, steps: mi.steps.length }
    })
  }
}

/* ---------------------------------------------------------------- run headless */
export interface RunOptions {
  dt?: number // passo em minutos simulados (default 0.1)
  until?: number // tempo de parada em minutos (default 22:00)
}

/** Roda a simulação até o fim do dia e devolve os KPIs finais. Determinístico se `seed` fixo. */
export function runSimulation(config?: SimConfig, scene?: SceneItem[], opts: RunOptions = {}): SimKPIs {
  const dt = opts.dt ?? 0.1
  const until = opts.until ?? DAY_END
  const eng = new SimEngine(config, scene)
  while (eng.simTime < until) {
    eng.simTime += dt
    eng.tick(dt)
  }
  return eng.computeKPIs()
}
