/* Shell do Web Worker da simulação. Glue fino: liga self.onmessage/postMessage ao
   SimController (núcleo testável em worker-core.ts) e gerencia o laço ao vivo (play/pause).

   Uso no app (Vite):
     const w = new Worker(new URL('./sim/worker.ts', import.meta.url), { type: 'module' })
     w.postMessage({ type: 'init' })
     w.onmessage = (e) => render(e.data) */

import { SimController, type WorkerRequest, type WorkerResponse } from './worker-core'

/* `self` em contexto de worker — tipado por cast p/ evitar conflito com a lib DOM. */
const ctx = self as unknown as {
  postMessage: (m: WorkerResponse) => void
  onmessage: ((e: { data: PlayCmd | PauseCmd | WorkerRequest }) => void) | null
}

interface PlayCmd {
  type: 'play'
  fps?: number
  speed?: number // minutos simulados por segundo real (default 60 = 1 min sim/s ×60)
  dt?: number
}
interface PauseCmd {
  type: 'pause'
}

const ctl = new SimController((m) => ctx.postMessage(m))
let timer: ReturnType<typeof setInterval> | null = null

function stopLoop() {
  if (timer != null) {
    clearInterval(timer)
    timer = null
  }
}

ctx.onmessage = (e) => {
  const msg = e.data
  if (msg.type === 'play') {
    stopLoop()
    const fps = msg.fps ?? 30
    const simMinPerSec = msg.speed ?? 60
    const simMinPerTick = simMinPerSec / fps
    timer = setInterval(() => ctl.handle({ type: 'step', simMin: simMinPerTick, dt: msg.dt }), 1000 / fps)
    return
  }
  if (msg.type === 'pause') {
    stopLoop()
    return
  }
  if (msg.type === 'reset') stopLoop()
  ctl.handle(msg)
}
