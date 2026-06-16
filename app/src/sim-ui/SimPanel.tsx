/* Painel de Operação: liga a planta do editor ao motor DES (via Web Worker), com vista 2D
   ao vivo, controles (play/pause/reset/dia rápido), parâmetros (atendentes, demanda, seed),
   KPIs em tempo real, chrome premium (relógio mono, velocidade segmentada, chips de cenário,
   toggles de camada) e o Monitor KDS — dock escuro inferior sobre a planta. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { loja206Scene, type RestaurantScene } from '../domain'
import { baseConfig } from '../sim/defaults'
import { sceneToSimItems } from '../sim/adapter'
import { createStorage } from '../storage'
import type { SimConfig } from '../sim/types'
import SimView, { type LayerToggles, type OpTrails } from './SimView'
import { useSimWorker } from './useSimWorker'
import './sim-panel.css'

const SPEEDS = [60, 120, 240, 480]
const SPEED_LABEL: Record<number, string> = { 60: '1×', 120: '5×', 240: '15×', 480: '60×' }

/** Cenários de demanda (chips) — mapeiam para a curva do dia do motor. */
const SCENARIOS: Array<{ id: SimConfig['demandCurve']; label: string }> = [
  { id: 'flat', label: 'Plano' },
  { id: 'lunch', label: 'Pico almoço' },
  { id: 'dinner', label: 'Pico jantar' },
  { id: 'both', label: 'Almoço + jantar' },
]

/** Janela de trilha por operador (últimas N posições acumuladas no cliente). */
const TRAIL_MAX = 80

const clock = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
const brl = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')

/** Fase do dia (espelha renderMonitor do protótipo). */
const dayPhase = (min: number) => {
  const h = Math.floor(min / 60)
  return h < 12 ? 'manhã' : h < 15 ? 'pico almoço' : h < 18 ? 'tarde' : h < 21 ? 'pico jantar' : 'noite'
}

export default function SimPanel({ onClose }: { onClose: () => void }) {
  const [scene, setScene] = useState<RestaurantScene | null>(null)
  const [ops, setOps] = useState(2)
  const [rate, setRate] = useState(30)
  const [seed, setSeed] = useState(42)
  const [speed, setSpeed] = useState(120)
  const [demandCurve, setDemandCurve] = useState<SimConfig['demandCurve']>('both')
  const [layers, setLayers] = useState<LayerToggles>({ trails: true, heatmap: false, labels: true })
  const [kdsCollapsed, setKdsCollapsed] = useState(false)

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

  const simItems = useMemo(() => (scene ? sceneToSimItems(scene) : null), [scene])
  const config = useMemo<SimConfig>(
    () => ({ ...baseConfig(), ops, rate, seed, demandCurve }),
    [ops, rate, seed, demandCurve],
  )

  const sim = useSimWorker(simItems, config)
  const k = sim.kpis
  const simMin = sim.frame ? sim.frame.simTime : k ? 10 * 60 + (k.elapsedHours ?? 0) * 60 : 10 * 60
  const playing = sim.status === 'playing'

  // ---- trilhas dos operadores: acumuladas no cliente a partir dos frames (sem tocar no motor)
  const trailsRef = useRef<OpTrails>(new Map())
  const [trails, setTrails] = useState<OpTrails>(new Map())
  // reinicia ao trocar de cena/config
  useEffect(() => {
    trailsRef.current = new Map()
    setTrails(new Map())
  }, [simItems, config])
  useEffect(() => {
    const f = sim.frame
    if (!f) return
    const map = trailsRef.current
    f.operators.forEach((o) => {
      const arr = map.get(o.idx) ?? []
      const last = arr[arr.length - 1]
      if (!last || Math.abs(last.x - o.x) > 0.02 || Math.abs(last.y - o.y) > 0.02) {
        arr.push({ x: o.x, y: o.y })
        if (arr.length > TRAIL_MAX) arr.shift()
        map.set(o.idx, arr)
      }
    })
    setTrails(new Map(map))
  }, [sim.frame])

  // ---- métricas rápidas do KDS (derivadas do frame + KPIs já existentes)
  const qNow = sim.frame?.waitQueue ?? 0
  const pickupNow = sim.frame
    ? sim.frame.customers.filter((c) => c.state === 'waiting_pickup').length
    : 0
  const ritmo = k?.throughputPerHour ?? 0
  const esperaMed = k?.avgWaitMin ?? 0

  return (
    <div id="simapp">
      <header id="sim-top">
        <button className="tbtn" onClick={onClose}>
          ← Planta
        </button>
        <div className="sim-title">
          Operação · <b>simulação DES</b>
        </div>
        {/* relógio grande mono (relogio-grande-mono) */}
        <div className="sim-clock">{clock(simMin)}</div>
        <span className="sim-phase">{dayPhase(simMin)}</span>
        <div className="topspacer" />

        {/* play com estado pausado (play-estado-pausado) + reiniciar / dia rápido */}
        <div className="toolgroup">
          <button
            className={`tbtn play${playing ? ' on' : ' paused'}`}
            onClick={() => (playing ? sim.pause() : sim.start(speed))}
          >
            {playing ? '❚❚ Pausar' : '▸ Reproduzir'}
          </button>
          <button className="tbtn" onClick={sim.reset}>
            Reiniciar
          </button>
          <button className="tbtn" onClick={sim.runFull} title="Roda o dia inteiro instantaneamente">
            Dia rápido
          </button>
        </div>

        {/* velocidade em botões segmentados (controles-velocidade-botoes) */}
        <div className="toolgroup spdgroup">
          <span className="sim-lbl">Vel.</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`spd${speed === s ? ' on' : ''}`}
              onClick={() => {
                setSpeed(s)
                if (playing) sim.start(s)
              }}
            >
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
      </header>

      <main id="sim-stage" className={kdsCollapsed ? 'has-dock collapsed' : 'has-dock'}>
        <div className="sim-stage-canvas">
          <SimView scene={sim.scene} frame={sim.frame} layers={layers} trails={trails} />
          <div className="sim-legend">
            <span><i style={{ background: '#2A6FDB' }} /> fila</span>
            <span><i style={{ background: '#E2000F' }} /> no caixa</span>
            <span><i style={{ background: '#1F8A5B' }} /> retirada</span>
            <span><i style={{ background: '#2A6FDB', borderRadius: 2 }} /> atendente</span>
            <span><i style={{ background: '#8A5A2B', borderRadius: 2 }} /> padeiro</span>
          </div>
        </div>

        {/* ===== Monitor KDS — dock escuro inferior sobre a planta (monitor-kds-dock) ===== */}
        <div className={`kds-dock${kdsCollapsed ? ' collapsed' : ''}`}>
          <div className="kds-dockhead">
            <span className="kd-title">Monitor da operação</span>
            <div className="kt-clock">
              <span>{clock(simMin)}</span>
              <em>{dayPhase(simMin)}</em>
            </div>
            <div className="kt-metrics">
              <Met v={k?.served ?? 0} l="servidos" />
              <Met v={qNow} l="na fila" warn={qNow > 8} />
              <Met v={pickupNow} l="retirada" />
              <Met v={`${ritmo}/h`} l="ritmo" />
              <Met v={`${esperaMed}m`} l="espera" warn={esperaMed > 8} />
              <Met v={k?.balked ?? 0} l="desist." warn={(k?.balked ?? 0) > 0} />
              <Met v={sim.frame?.breadStock ?? k?.bread.stock ?? 0} l="pães" />
            </div>
            <button
              className="km-collapse"
              onClick={() => setKdsCollapsed((v) => !v)}
              title="Recolher / expandir"
            >
              {kdsCollapsed ? '▴' : '▾'}
            </button>
          </div>
          {!kdsCollapsed && (
            <div className="kds-cols">
              <div className="kds-foh">
                <div className="kds-h">
                  <span>FOH · Frente</span>
                  <span>{qNow} na fila · {pickupNow} retirada</span>
                </div>
                <div className="km-body">
                  <div className="km-stat">
                    <b>{k?.served ?? 0}</b> servidos · {k?.serviceRate ?? 0}% atendimento
                  </div>
                  <div className="km-stat sub">
                    Vazão {ritmo}/h · espera média {esperaMed} min · SLA {k?.slaPct ?? 0}%
                  </div>
                  {qNow > 8 && <div className="km-warn">⚠ Fila longa — {qNow} clientes aguardando</div>}
                </div>
              </div>

              <div className="kds-boh">
                <div className="kds-h">
                  <span>BOH · Fábrica de pães</span>
                  <span>{k?.bread.baked ?? 0} produzidos</span>
                </div>
                <div className="km-body">
                  <div className="km-boh-stock">
                    <b>{sim.frame?.breadStock ?? k?.bread.stock ?? 0}</b> pães em estoque
                    <span className="km-boh-bar">
                      <i style={{ width: `${Math.min(100, Math.round(((sim.frame?.breadStock ?? k?.bread.stock ?? 0) / Math.max(1, k?.bread.storageCap ?? 60)) * 100))}%` }} />
                    </span>
                  </div>
                  <div className="km-boh-row">
                    Produzidos {k?.bread.baked ?? 0} · consumidos {k?.bread.consumed ?? 0}
                  </div>
                  {(k?.bread.stockoutMin ?? 0) > 0 && (
                    <div className="km-warn">⚠ Falta de pão por {k?.bread.stockoutMin} min</div>
                  )}
                </div>
              </div>

              <div className="kds-alerts">
                <div className="kds-h">
                  <span>Resumo do dia</span>
                  <span />
                </div>
                <div className="km-body">
                  <div className="km-stat">
                    Receita <b className="pos">{brl(k?.revenueNet ?? 0)}</b>
                  </div>
                  <div className="km-stat sub">Custo op. {brl(k?.operationalCost ?? 0)}</div>
                  <div className="km-stat">
                    Margem{' '}
                    <b className={(k?.margin ?? 0) >= 0 ? 'pos' : 'neg'}>{brl(k?.margin ?? 0)}</b>
                  </div>
                  {(k?.balked ?? 0) > 0 && (
                    <div className="km-warn">⚠ {k?.balked} desistência(s) na fila</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <aside id="sim-right" className="rail">
        <div className="sec">
          <h3>Cenário de demanda</h3>
          <div className="sim-chips">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                className={`chip${demandCurve === s.id ? ' on' : ''}`}
                onClick={() => setDemandCurve(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

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

        {/* toggles de camada (toggles-camadas) — switches estilo protótipo */}
        <div className="sec">
          <h3>Camadas</h3>
          <div className="sim-toggles">
            <Toggle
              label="Trilhas dos operadores"
              on={layers.trails}
              onClick={() => setLayers((l) => ({ ...l, trails: !l.trails }))}
            />
            <Toggle
              label="Heatmap de circulação"
              on={layers.heatmap}
              onClick={() => setLayers((l) => ({ ...l, heatmap: !l.heatmap }))}
            />
            <Toggle
              label="Rótulos"
              on={layers.labels}
              onClick={() => setLayers((l) => ({ ...l, labels: !l.labels }))}
            />
          </div>
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

/** Métrica do dock KDS (valor mono grande + rótulo). */
function Met({ v, l, warn }: { v: string | number; l: string; warn?: boolean }) {
  return (
    <div className="km-met">
      <div className={`v${warn ? ' warn' : ''}`}>{v}</div>
      <div className="l">{l}</div>
    </div>
  )
}

/** Switch de camada estilo protótipo (.sw/.toggle). */
function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={`sim-sw${on ? ' on' : ''}`} onClick={onClick} type="button">
      <span>{label}</span>
      <span className="sim-toggle" />
    </button>
  )
}
