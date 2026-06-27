/* Hook React que gerencia o Web Worker da simulação: cria/encerra o worker, (re)inicializa
   quando cena/config mudam, e expõe o último frame + KPIs + status, com comandos
   start/pause/reset/runFull. O worker roda fora da thread da UI. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { DAY_END, type SimKPIs } from '../sim/engine'
import type { EnrichedFrame, EnrichedScene, WorkerRequest, WorkerResponse } from '../sim/worker-core'
import type { SceneItem, SimConfig } from '../sim/types'

export type SimStatus = 'idle' | 'playing' | 'done'

type Command = WorkerRequest | { type: 'play'; speed?: number; fps?: number; dt?: number } | { type: 'pause' }

export interface SimWorkerApi {
  scene: EnrichedScene | null
  frame: EnrichedFrame | null
  kpis: SimKPIs | null
  status: SimStatus
  start: (speed?: number) => void
  pause: () => void
  reset: () => void
  runFull: () => void
}

export function useSimWorker(
  simItems: SceneItem[] | null,
  config: SimConfig,
  polygon?: Array<[number, number]>,
): SimWorkerApi {
  const workerRef = useRef<Worker | null>(null)
  const [scene, setScene] = useState<EnrichedScene | null>(null)
  const [frame, setFrame] = useState<EnrichedFrame | null>(null)
  const [kpis, setKpis] = useState<SimKPIs | null>(null)
  const [status, setStatus] = useState<SimStatus>('idle')
  const statusRef = useRef<SimStatus>('idle')
  statusRef.current = status

  // cria o worker uma única vez
  useEffect(() => {
    const w = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data
      switch (m.type) {
        case 'ready':
          setScene(m.scene)
          setFrame(null)
          break
        case 'frame':
          setFrame(m.frame)
          if (m.frame.simTime >= DAY_END) {
            setStatus('done')
            w.postMessage({ type: 'pause' } satisfies Command)
          }
          break
        case 'kpis':
          setKpis(m.kpis)
          break
        case 'done':
          setKpis(m.kpis)
          setStatus('done')
          break
        case 'error':
          console.error('[sim worker]', m.message)
          break
      }
    }
    workerRef.current = w
    return () => {
      w.terminate()
      workerRef.current = null
    }
  }, [])

  const post = useCallback((msg: Command) => workerRef.current?.postMessage(msg), [])

  // (re)inicializa quando cena, casca ou config mudam
  useEffect(() => {
    if (!workerRef.current || !simItems) return
    post({ type: 'pause' })
    post({ type: 'init', config, scene: simItems, polygon })
    setStatus('idle')
    setKpis(null)
  }, [simItems, polygon, config, post])

  const start = useCallback(
    (speed = 120) => {
      if (statusRef.current === 'done') post({ type: 'reset' }) // dia terminou → recomeça
      post({ type: 'play', speed, fps: 20 })
      setStatus('playing')
    },
    [post],
  )
  const pause = useCallback(() => {
    post({ type: 'pause' })
    setStatus('idle')
  }, [post])
  const reset = useCallback(() => {
    post({ type: 'pause' })
    post({ type: 'reset' })
    setFrame(null)
    setKpis(null)
    setStatus('idle')
  }, [post])
  const runFull = useCallback(() => {
    post({ type: 'pause' })
    post({ type: 'reset' })
    post({ type: 'run', kpiEvery: 30 })
    setStatus('done')
  }, [post])

  return { scene, frame, kpis, status, start, pause, reset, runFull }
}
