/* Painel da vista 3D: carrega a planta salva (ou template Loja 206) e a renderiza em volume,
   para avaliação de espaço/dimensões. Etapa "3D" do fluxo 2D → 3D → Simulação.
   Controles: acabamentos (piso/parede), presets de câmera, dollhouse, grade e neblina. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { collisionSet, loja206Scene, topOf, type RestaurantScene } from '../domain'
import { createStorage } from '../storage'
import { baseConfig } from '../sim/defaults'
import { sceneToSimItems } from '../sim/adapter'
import { useSimWorker } from '../sim-ui/useSimWorker'
import type { SimConfig } from '../sim/types'
import Scene3D, { type CamPreset, type Finish3D, type Scene3DHandle } from './Scene3D'
import type { FloorKind, WallKind } from './props3d'
import './view3d.css'

const PREFS_LS = 'operacao3d_view3d_prefs_v1'

const FLOOR_OPTS: Array<{ id: FloorKind; label: string }> = [
  { id: 'porcelanato', label: 'Porcelanato' },
  { id: 'granilite', label: 'Granilite' },
  { id: 'cimento', label: 'Cimento' },
]
const WALL_OPTS: Array<{ id: WallKind; label: string }> = [
  { id: 'panna', label: 'Panna' },
  { id: 'branco', label: 'Branco' },
  { id: 'oliva', label: 'Oliva' },
]
const PRESETS: Array<{ id: CamPreset; label: string }> = [
  { id: 'iso', label: 'Isométrica' },
  { id: 'top', label: 'Topo' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'balcao', label: 'Balcão' },
]

interface Prefs {
  finish: Finish3D
  showGrid: boolean
  fog: boolean
  transparent: boolean
}
const DEFAULT_PREFS: Prefs = {
  finish: { floor: 'porcelanato', wall: 'panna' },
  showGrid: false, // default off quando o piso é texturizado (3d-grid-helper-extra)
  fog: true,
  transparent: false,
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_LS)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>
      return {
        finish: { ...DEFAULT_PREFS.finish, ...p.finish },
        showGrid: p.showGrid ?? DEFAULT_PREFS.showGrid,
        fog: p.fog ?? DEFAULT_PREFS.fog,
        transparent: p.transparent ?? DEFAULT_PREFS.transparent,
      }
    }
  } catch {
    /* prefs corrompidas → padrão */
  }
  return DEFAULT_PREFS
}

const OP_SPEED = 120 // velocidade da operação 3D (× tempo real)

/** Minutos simulados → relógio HH:MM. */
const opClock = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function View3D({ onClose }: { onClose: () => void }) {
  const [scene, setScene] = useState<RestaurantScene | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())
  const sceneRef = useRef<Scene3DHandle | null>(null)
  // modo "Operação 3D": liga a simulação (avatares animados) sobre o layout
  const [opMode, setOpMode] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [showTrails, setShowTrails] = useState(true)

  // persiste preferências de visualização (acabamentos/camadas)
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_LS, JSON.stringify(prefs))
    } catch {
      /* storage indisponível → ignora */
    }
  }, [prefs])

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

  // semeia acabamentos da cena salva na primeira carga (se o usuário ainda não escolheu)
  useEffect(() => {
    if (!scene?.finishes) return
    setPrefs((p) => {
      // só semeia quando ainda no padrão (evita sobrescrever escolha do usuário)
      if (localStorage.getItem(PREFS_LS)) return p
      const floor = scene.finishes!.floor as FloorKind
      const wall = scene.finishes!.wall as WallKind
      const okFloor = FLOOR_OPTS.some((o) => o.id === floor)
      const okWall = WALL_OPTS.some((o) => o.id === wall)
      return { ...p, finish: { floor: okFloor ? floor : p.finish.floor, wall: okWall ? wall : p.finish.wall } }
    })
  }, [scene])

  const collisions = useMemo(
    () => (scene ? collisionSet(scene.items) : new Set<string>()),
    [scene],
  )

  // --- Operação 3D: mesma simulação (Web Worker) da tela 2D, frames p/ avatares ---
  // só alimenta itens ao worker quando o modo operação está ligado (evita custo à toa)
  const simItems = useMemo(
    () => (opMode && scene ? sceneToSimItems(scene) : null),
    [opMode, scene],
  )
  const simConfig = useMemo<SimConfig>(() => baseConfig(), [])
  const sim = useSimWorker(simItems, simConfig)
  const playing = sim.status === 'playing'

  // ao entrar no modo operação, começa a tocar; ao sair, pausa
  useEffect(() => {
    if (opMode) sim.start(OP_SPEED)
    else sim.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opMode])

  const info = useMemo(() => {
    if (!scene) return null
    const pieces = scene.items.filter((i) => i.type !== 'porta' && i.type !== 'extintor' && i.type !== 'wall' && i.type !== 'painel')
    const maxH = scene.items.reduce((m, i) => Math.max(m, topOf(i)), 0)
    return { area: scene.room.labeledAreaM2 ?? 0, pieces: pieces.length, maxH }
  }, [scene])

  const setFloor = (floor: FloorKind) => setPrefs((p) => ({ ...p, finish: { ...p.finish, floor } }))
  const setWall = (wall: WallKind) => setPrefs((p) => ({ ...p, finish: { ...p.finish, wall } }))

  return (
    <div id="v3dapp">
      <header id="v3d-top">
        <button className="tbtn" onClick={onClose}>
          ← Planta
        </button>
        <div className="v3d-title">
          Espaço · <b>vista 3D</b>
        </div>
        <div className="topspacer" />
        {info && (
          <div className="v3d-info">
            <span>{info.area.toFixed(1).replace('.', ',')} m²</span>
            <span>{info.pieces} peças</span>
            <span>alt. máx {info.maxH.toFixed(2).replace('.', ',')} m</span>
            {collisions.size > 0 && <span className="warn">⚠ {collisions.size} sobrepos.</span>}
          </div>
        )}
        <div className="toolgroup">
          <button
            className={`tbtn${opMode ? ' active' : ''}`}
            onClick={() => setOpMode((v) => !v)}
            title="Ver a operação em 3D — clientes e operadores andando no layout"
          >
            {opMode ? '❚❚ Operação 3D' : '▸ Operação 3D'}
          </button>
          <button
            className={`tbtn${prefs.transparent ? ' active' : ''}`}
            onClick={() => setPrefs((p) => ({ ...p, transparent: !p.transparent }))}
            title="Paredes translúcidas (alternativa ao dollhouse)"
          >
            Translúcidas
          </button>
        </div>
      </header>

      <main id="v3d-stage">
        {scene ? (
          <Scene3D
            ref={sceneRef}
            scene={scene}
            wallsTransparent={prefs.transparent}
            cullWalls={!prefs.transparent}
            showGrid={prefs.showGrid}
            fog={prefs.fog}
            finish={prefs.finish}
            collisions={collisions}
            frame={opMode ? sim.frame : null}
            showLabels={showLabels}
            showTrails={showTrails}
          />
        ) : (
          <div className="v3d-empty">Carregando cena…</div>
        )}

        {/* presets de câmera */}
        <div className="v3d-cam">
          {PRESETS.map((p) => (
            <button key={p.id} className="v3d-chip" onClick={() => sceneRef.current?.applyPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* barra da operação 3D (avatares animados) */}
        {opMode && (
          <div className="v3d-op">
            <span className="v3d-op-clock">{opClock(sim.frame ? sim.frame.simTime : 10 * 60)}</span>
            <button
              className="v3d-seg-btn"
              onClick={() => (playing ? sim.pause() : sim.start(OP_SPEED))}
              title="Reproduzir / pausar a operação"
            >
              {playing ? '❚❚' : '▸'}
            </button>
            <button className="v3d-seg-btn" onClick={() => sim.reset()} title="Reiniciar o dia">
              ⟲
            </button>
            <span className="v3d-op-sep" />
            <button
              className={`v3d-seg-btn${showLabels ? ' active' : ''}`}
              onClick={() => setShowLabels((v) => !v)}
              title="Rótulos dos operadores (tag/status)"
            >
              Rótulos
            </button>
            <button
              className={`v3d-seg-btn${showTrails ? ' active' : ''}`}
              onClick={() => setShowTrails((v) => !v)}
              title="Trilhas (rastros) dos operadores"
            >
              Trilhas
            </button>
          </div>
        )}

        {/* painel de acabamentos + camadas */}
        <div className="v3d-fin">
          <div className="v3d-fin-row">
            <span className="v3d-fin-lbl">Piso</span>
            <div className="v3d-seg">
              {FLOOR_OPTS.map((o) => (
                <button
                  key={o.id}
                  className={`v3d-seg-btn${prefs.finish.floor === o.id ? ' active' : ''}`}
                  onClick={() => setFloor(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="v3d-fin-row">
            <span className="v3d-fin-lbl">Parede</span>
            <div className="v3d-seg">
              {WALL_OPTS.map((o) => (
                <button
                  key={o.id}
                  className={`v3d-seg-btn${prefs.finish.wall === o.id ? ' active' : ''}`}
                  onClick={() => setWall(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="v3d-fin-row">
            <span className="v3d-fin-lbl">Camadas</span>
            <div className="v3d-seg">
              <button
                className={`v3d-seg-btn${prefs.showGrid ? ' active' : ''}`}
                onClick={() => setPrefs((p) => ({ ...p, showGrid: !p.showGrid }))}
              >
                Grade
              </button>
              <button
                className={`v3d-seg-btn${prefs.fog ? ' active' : ''}`}
                onClick={() => setPrefs((p) => ({ ...p, fog: !p.fog }))}
              >
                Neblina
              </button>
            </div>
          </div>
        </div>

        <div className="v3d-hint">Arraste: orbitar · roda: zoom · botão direito: deslocar</div>
      </main>
    </div>
  )
}
