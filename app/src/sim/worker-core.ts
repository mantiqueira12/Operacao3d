/* Núcleo do Web Worker da simulação — puro e testável (sem dependência de `self`).
   O shell `worker.ts` apenas conecta self.onmessage/postMessage a este controller. */

import {
  DAY_END,
  type Frame,
  type FrameCustomer,
  type FrameOperator,
  type SceneSnapshot,
  SimEngine,
  type SimKPIs,
  type StationSnapshot,
} from './engine'
import type {
  FrameCustomerExtra,
  FrameMeta,
  FrameOperatorExtra,
  SceneItem,
  SimConfig,
} from './types'

/* ----------------------------------------------------------- snapshot enriquecido
   Tipos ADITIVOS: o frame/cena ganham campos JÁ calculados pelo motor (lidos das
   propriedades públicas do engine), sem mexer na lógica do DES. O cálculo de cor
   por agente fica na vista. */
export type EnrichedFrameCustomer = FrameCustomer & FrameCustomerExtra
export type EnrichedFrameOperator = FrameOperator & FrameOperatorExtra
export interface EnrichedFrame extends Frame {
  customers: EnrichedFrameCustomer[]
  operators: EnrichedFrameOperator[]
  meta: FrameMeta
}
export type EnrichedStation = StationSnapshot & { unreachable?: boolean }
export interface EnrichedScene extends SceneSnapshot {
  stations: EnrichedStation[]
}

/* ----------------------------------------------------------- protocolo */
export type WorkerRequest =
  | { type: 'init'; config?: SimConfig; scene?: SceneItem[] }
  | { type: 'run'; dt?: number; until?: number; kpiEvery?: number }
  | { type: 'step'; simMin?: number; dt?: number; withKpis?: boolean }
  | { type: 'reset' }
  | { type: 'snapshot' }

export type WorkerResponse =
  | { type: 'ready'; scene: EnrichedScene; simTime: number }
  | { type: 'kpis'; kpis: SimKPIs; simTime: number }
  | { type: 'frame'; frame: EnrichedFrame }
  | { type: 'done'; kpis: SimKPIs }
  | { type: 'error'; message: string }

export type PostFn = (msg: WorkerResponse) => void

/* Enriquece o frame do motor com campos por-agente já calculados (impaciência,
   estado do operador). Lê `eng.customers`/`eng.operators` (públicos) por id/idx. */
function enrichFrame(eng: SimEngine): EnrichedFrame {
  const base = eng.snapshot()
  const cById = new Map(eng.customers.map((c) => [c.id, c]))
  const oByIdx = new Map(eng.operators.map((o) => [o.idx, o]))
  return {
    ...base,
    customers: base.customers.map((fc) => {
      const c = cById.get(fc.id)
      return {
        ...fc,
        tArr: c ? c.tArr : 0,
        tSS: c ? c.tSS : null,
        orderNum: c ? c.orderNum : null,
        served: !!(c && c.served),
      }
    }),
    operators: base.operators.map((fo) => {
      const o = oByIdx.get(fo.idx)
      return {
        ...fo,
        busyState: o ? o.busyState : undefined,
        tag: o ? o.tag : undefined,
        fixedEq: o ? o.fixedEq : '',
      }
    }),
    meta: { tol: eng.cfg.tol, pickupTimeout: eng.cfg.pickupTimeout },
  }
}

/* Enriquece a cena estática com `unreachable` por estação (já presente no engine). */
function enrichScene(eng: SimEngine): EnrichedScene {
  const base = eng.sceneSnapshot()
  const stByIdScene = new Map(eng.stations.map((s) => [s.id, s]))
  return {
    ...base,
    stations: base.stations.map((s) => ({
      ...s,
      unreachable: stByIdScene.get(s.id)?.unreachable,
    })),
  }
}

/* ----------------------------------------------------------- controller */
export class SimController {
  private eng: SimEngine | null = null

  constructor(private post: PostFn) {}

  handle(msg: WorkerRequest) {
    try {
      switch (msg.type) {
        case 'init':
          this.init(msg.config, msg.scene)
          break
        case 'run':
          this.run(msg.dt, msg.until, msg.kpiEvery)
          break
        case 'step':
          this.step(msg.simMin, msg.dt, msg.withKpis)
          break
        case 'reset':
          this.reset()
          break
        case 'snapshot':
          this.snapshot()
          break
      }
    } catch (e) {
      this.post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  private ensure(): SimEngine {
    if (!this.eng) this.eng = new SimEngine()
    return this.eng
  }

  private init(config?: SimConfig, scene?: SceneItem[]) {
    this.eng = new SimEngine(config, scene)
    this.post({ type: 'ready', scene: enrichScene(this.eng), simTime: this.eng.simTime })
  }

  /** Roda headless até `until`, emitindo KPIs a cada `kpiEvery` min simulados + `done` no fim. */
  private run(dt = 0.1, until = DAY_END, kpiEvery = 30) {
    const eng = this.ensure()
    let nextKpi = eng.simTime + kpiEvery
    while (eng.simTime < until) {
      eng.simTime += dt
      eng.tick(dt)
      if (eng.simTime >= nextKpi) {
        this.post({ type: 'kpis', kpis: eng.computeKPIs(), simTime: eng.simTime })
        nextKpi += kpiEvery
      }
    }
    this.post({ type: 'done', kpis: eng.computeKPIs() })
  }

  /** Avança `simMin` minutos simulados (em passos de `dt`) e emite um frame. */
  private step(simMin?: number, dt = 0.1, withKpis = false) {
    const eng = this.ensure()
    const target = Math.min(DAY_END, eng.simTime + (simMin ?? dt))
    while (eng.simTime < target) {
      eng.simTime += dt
      eng.tick(dt)
    }
    this.post({ type: 'frame', frame: enrichFrame(eng) })
    if (withKpis) this.post({ type: 'kpis', kpis: eng.computeKPIs(), simTime: eng.simTime })
  }

  private reset() {
    const eng = this.ensure()
    eng.reset()
    this.post({ type: 'ready', scene: enrichScene(eng), simTime: eng.simTime })
  }

  private snapshot() {
    const eng = this.ensure()
    this.post({ type: 'frame', frame: enrichFrame(eng) })
    this.post({ type: 'kpis', kpis: eng.computeKPIs(), simTime: eng.simTime })
  }
}
