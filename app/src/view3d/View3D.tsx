/* Painel da vista 3D: carrega a planta salva (ou template Loja 206) e a renderiza em volume,
   para avaliação de espaço/dimensões. Etapa "3D" do fluxo 2D → 3D → Simulação. */

import { useEffect, useMemo, useState } from 'react'
import { loja206Scene, type RestaurantScene } from '../domain'
import { createStorage } from '../storage'
import Scene3D from './Scene3D'
import './view3d.css'

export default function View3D({ onClose }: { onClose: () => void }) {
  const [scene, setScene] = useState<RestaurantScene | null>(null)
  const [transparent, setTransparent] = useState(false)

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

  const info = useMemo(() => {
    if (!scene) return null
    const pieces = scene.items.filter((i) => i.type !== 'porta' && i.type !== 'extintor' && i.type !== 'wall' && i.type !== 'painel')
    const maxH = scene.items.reduce((m, i) => Math.max(m, i.height), 0)
    return { area: scene.room.labeledAreaM2 ?? 0, pieces: pieces.length, maxH }
  }, [scene])

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
          </div>
        )}
        <div className="toolgroup">
          <button className={`tbtn${transparent ? ' active' : ''}`} onClick={() => setTransparent((t) => !t)}>
            Paredes translúcidas
          </button>
        </div>
      </header>

      <main id="v3d-stage">
        {scene ? <Scene3D scene={scene} wallsTransparent={transparent} /> : <div className="v3d-empty">Carregando cena…</div>}
        <div className="v3d-hint">Arraste: orbitar · roda: zoom · botão direito: deslocar</div>
      </main>
    </div>
  )
}
