/* Núcleo do Web Worker da simulação — puro e testável (sem dependência de `self`).
   O shell `worker.ts` apenas conecta self.onmessage/postMessage a este controller. */

import { DAY_END, type Frame, type SceneSnapshot, SimEngine, type SimKPIs } from './engine'
import type { SceneItem, SimConfig } from './types'

/* ----------------------------------------------------------- protocolo */
export type WorkerRequest =
  | { type: 'init'; config?: SimConfig; scene?: SceneItem[] }
  | { type: 'run'; dt?: number; until?: number; kpiEvery?: number }
  | { type: 'step'; simMin?: number; dt?: number; withKpis?: boolean }
  | { type: 'reset' }
  | { type: 'snapshot' }

export type WorkerResponse =
  | { type: 'ready'; scene: SceneSnapshot; simTime: number }
  | { type: 'kpis'; kpis: SimKPIs; simTime: number }
  | { type: 'frame'; frame: Frame }
  | { type: 'done'; kpis: SimKPIs }
  | { type: 'error'; message: string }

export type PostFn = (msg: WorkerResponse) => void

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
    this.post({ type: 'ready', scene: this.eng.sceneSnapshot(), simTime: this.eng.simTime })
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
    this.post({ type: 'frame', frame: eng.snapshot() })
    if (withKpis) this.post({ type: 'kpis', kpis: eng.computeKPIs(), simTime: eng.simTime })
  }

  private reset() {
    const eng = this.ensure()
    eng.reset()
    this.post({ type: 'ready', scene: eng.sceneSnapshot(), simTime: eng.simTime })
  }

  private snapshot() {
    const eng = this.ensure()
    this.post({ type: 'frame', frame: eng.snapshot() })
    this.post({ type: 'kpis', kpis: eng.computeKPIs(), simTime: eng.simTime })
  }
}
