import { useState } from 'react'
import Planner from './editor/Planner'
import SimPanel from './sim-ui/SimPanel'

/**
 * App — módulo Operacao3d. Alterna entre o editor de planta 2D ("Planta") e o painel de
 * simulação da operação ("Operação", motor DES em Web Worker). Vista 3D: próximo passo.
 */
export default function App() {
  const [mode, setMode] = useState<'plan' | 'sim'>('plan')
  return mode === 'sim' ? <SimPanel onClose={() => setMode('plan')} /> : <Planner onOpenSim={() => setMode('sim')} />
}
