import { lazy, Suspense, useState } from 'react'
import Planner from './editor/Planner'

/**
 * App — módulo Operacao3d. Alterna entre o editor de planta 2D ("Planta"), a vista 3D do espaço
 * ("3D") e o painel de simulação da operação ("Operação", motor DES em Web Worker).
 *
 * 3D (Three.js) e Simulação são carregados sob demanda (code-splitting) para manter a carga
 * inicial leve — o bundle pesado do Three só baixa ao abrir a vista 3D.
 */
const SimPanel = lazy(() => import('./sim-ui/SimPanel'))
const View3D = lazy(() => import('./view3d/View3D'))

// Fallback de carga sob demanda — usa tokens do design system (var com fallback).
const Loading = () => (
  <div
    style={{
      display: 'grid',
      placeItems: 'center',
      height: '100vh',
      fontFamily: 'var(--ui, Manrope, system-ui, sans-serif)',
      fontWeight: 600,
      letterSpacing: '0.04em',
      color: 'var(--muted, #9a9284)',
      background: 'var(--desk, #e6e1d5)',
    }}
  >
    Carregando…
  </div>
)

export default function App() {
  const [mode, setMode] = useState<'plan' | 'view3d' | 'sim'>('plan')
  if (mode === 'sim')
    return (
      <Suspense fallback={<Loading />}>
        <SimPanel onClose={() => setMode('plan')} />
      </Suspense>
    )
  if (mode === 'view3d')
    return (
      <Suspense fallback={<Loading />}>
        <View3D onClose={() => setMode('plan')} />
      </Suspense>
    )
  return <Planner onOpenSim={() => setMode('sim')} onOpen3D={() => setMode('view3d')} />
}
