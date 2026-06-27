/* Painel de Operação: liga a planta do editor ao motor DES (via Web Worker), com vista 2D
   ao vivo, controles (play/pause/reset/dia rápido), parâmetros (atendentes, demanda, seed) e
   KPIs em tempo real. */

import { useEffect, useMemo, useState } from 'react'
import { loja206Scene, type RestaurantScene } from '../domain'
import { baseConfig } from '../sim/defaults'
import { sceneToSim } from '../sim/adapter'
import { createStorage } from '../storage'
import type { SimConfig } from '../sim/types'
import SimView from './SimView'
import { useSimWorker } from './useSimWorker'
import './sim-panel.css'

const SPEEDS = [60, 120, 240, 480]
const clock = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
const brl = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')

export default function SimPanel({ onClose }: { onClose: () => void }) {
  const [scene, setScene] = useState<RestaurantScene | null>(null)
  const [ops, setOps] = useState(2)
  const [rate, setRate] = useState(30)
  const [seed, setSeed] = useState(42)
  const [speed, setSpeed] = useState(120)

  // carrega a planta salva (ou o template Loja 206)
  useEffect(() => {
    const storage = createStorage()
    let alive = true
    void (async () => {
      const metas = await storage.list()
      if (!alive) return
      if (metas.length > 0) {
        const p = await storage.get<RestaurantScene>(metas[0].id)
        if (alive && p) {
          setScene(p.data)
          return
        }
      }
      if (alive) setScene(loja206Scene(() => crypto.randomUUID()))
    })()
    return () => {
      alive = false
    }
  }, [])

  const simInput = useMemo(() => (scene ? sceneToSim(scene) : null), [scene])
  const simItems = simInput?.items ?? null
  const polygon = simInput?.polygon
  const config = useMemo<SimConfig>(() => ({ ...baseConfig(), ops, rate, seed }), [ops, rate, seed])

  const sim = useSimWorker(simItems, config, polygon)
  const k = sim.kpis
  const simMin = sim.frame ? sim.frame.simTime : k ? 10 * 60 + (k.elapsedHours ?? 0) * 60 : 10 * 60
  const playing = sim.status === 'playing'

  return (
    <div id="simapp">
      <header id="sim-top">
        <button className="tbtn" onClick={onClose}>
          ← Planta
        </button>
        <div className="sim-title">
          Operação · <b>simulação DES</b>
        </div>
        <div className="sim-clock">{clock(simMin)}</div>
        <div className="topspacer" />
        <div className="toolgroup">
          <button className="tbtn play" onClick={() => (playing ? sim.pause() : sim.start(speed))}>
            {playing ? '❚❚ Pausar' : '▸ Reproduzir'}
          </button>
          <button className="tbtn" onClick={sim.reset}>
            Reiniciar
          </button>
          <button className="tbtn" onClick={sim.runFull} title="Roda o dia inteiro instantaneamente">
            Dia rápido
          </button>
        </div>
        <div className="toolgroup">
          <span className="sim-lbl">Velocidade</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
      </header>

      <main id="sim-stage">
        <SimView scene={sim.scene} frame={sim.frame} />
        <div className="sim-legend">
          <span><i style={{ background: '#2A6FDB' }} /> fila</span>
          <span><i style={{ background: '#E2000F' }} /> no caixa</span>
          <span><i style={{ background: '#1F8A5B' }} /> retirada</span>
          <span><i style={{ background: '#2A6FDB', borderRadius: 2 }} /> atendente</span>
          <span><i style={{ background: '#8A5A2B', borderRadius: 2 }} /> padeiro</span>
        </div>
      </main>

      <aside id="sim-right" className="rail">
        <div className="sec">
          <h3>Parâmetros</h3>
          <div className="sim-params">
            <label className="sim-field">
              <span>Atendentes</span>
              <select value={ops} onChange={(e) => setOps(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="sim-field">
              <span>Demanda (cli/h)</span>
              <input
                type="number"
                min={1}
                max={200}
                value={rate}
                onChange={(e) => setRate(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              />
            </label>
            <label className="sim-field">
              <span>Seed</span>
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
            </label>
          </div>
          <p className="sim-note">Mudar parâmetros reinicia a simulação.</p>
        </div>

        <div className="sec">
          <h3>Clientes</h3>
          <div className="sim-kpis">
            <Stat label="Chegaram" v={k?.arrived ?? 0} />
            <Stat label="Atendidos" v={k?.served ?? 0} accent="green" />
            <Stat label="Desistiram (fila)" v={k?.balked ?? 0} accent="red" />
            <Stat label="Abandono retirada" v={k?.balkedPickup ?? 0} accent="red" />
            <Stat label="Atendimento" v={`${k?.serviceRate ?? 0}%`} />
            <Stat label="Vazão" v={`${k?.throughputPerHour ?? 0}/h`} />
            <Stat label="Fila agora" v={sim.frame?.waitQueue ?? 0} />
            <Stat label="Espera média" v={`${k?.avgWaitMin ?? 0} min`} />
            <Stat label="SLA no prazo" v={`${k?.slaPct ?? 0}%`} />
          </div>
        </div>

        <div className="sec">
          <h3>Financeiro (dia)</h3>
          <div className="sim-kpis">
            <Stat label="Receita" v={brl(k?.revenueNet ?? 0)} />
            <Stat label="Custo op." v={brl(k?.operationalCost ?? 0)} />
            <Stat label="Margem" v={brl(k?.margin ?? 0)} accent={(k?.margin ?? 0) >= 0 ? 'green' : 'red'} />
            <Stat label="Ticket médio" v={brl(k?.avgTicket ?? 0)} />
          </div>
        </div>

        <div className="sec">
          <h3>Padaria (fundo)</h3>
          <div className="sim-kpis">
            <Stat label="Estoque pães" v={sim.frame?.breadStock ?? k?.bread.stock ?? 0} />
            <Stat label="Produzidos" v={k?.bread.baked ?? 0} />
            <Stat label="Consumidos" v={k?.bread.consumed ?? 0} />
            <Stat label="Falta de pão" v={`${k?.bread.stockoutMin ?? 0} min`} accent={(k?.bread.stockoutMin ?? 0) > 5 ? 'red' : undefined} />
          </div>
        </div>

        {k && (
          <div className="sec">
            <h3>Utilização operadores</h3>
            <div className="sim-util">
              {k.opUtilizationPct.map((u, i) => (
                <div key={i} className="sim-util-row">
                  <span>{i + 1 <= ops ? `Atend. ${i + 1}` : 'Padeiro'}</span>
                  <div className="sim-bar">
                    <i style={{ width: `${u}%`, background: u > 85 ? 'var(--rosso)' : 'var(--green)' }} />
                  </div>
                  <span className="sim-util-v">{u}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function Stat({ label, v, accent }: { label: string; v: string | number; accent?: 'green' | 'red' }) {
  return (
    <div className="sim-stat">
      <span className="k">{label}</span>
      <span className={`v${accent ? ' ' + accent : ''}`}>{v}</span>
    </div>
  )
}
