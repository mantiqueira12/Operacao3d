/* Tipos do motor de simulação (port de prototype/planner/sim/sim-core.js).
   Unidades: metros · minutos simulados. */

export type Vec2 = { x: number; y: number }

/** Etapa de preparo de um item do cardápio, numa estação. */
export interface MenuStep {
  type: string // tipo de estação: montagem | vitrine | bibite | forno | prep ...
  time: number // minutos
}

export interface MenuItem {
  id: string
  name: string
  prob: number // probabilidade de escolha (normalizada pela soma)
  price: number // R$
  cat: 'lanche' | 'bebida'
  pao: number // pães consumidos por unidade
  steps: MenuStep[]
}

export interface BreadConfig {
  mode: 'propria' | 'terc' | 'hibrido'
  batchSize: number
  mixTime: number
  proofTime: number
  bakeTime: number
  breadStart: number
  target: number
  flourStart: number
  flourPerBread: number
  flourPrice: number
  extraPerBread: number
  energyPerBatch: number
  bakerCost: number
  bakerHours: number
  invest: number
  deprecMonths: number
  rentM2: number
  tercPrice: number
  tercFrete: number
  tercQty: number
  storageCap: number
  shiftStart: number
  shiftHours: number
  shifts: number
  hybridOwnPct: number
  investBatedeira: number
  lifeBatedeira: number
  investEstufa: number
  lifeEstufa: number
  investForno: number
  lifeForno: number
}

export interface SimConfig {
  ops: number
  fixedEq: string[]
  rate: number // clientes/hora (base)
  demandCurve: 'flat' | 'lunch' | 'dinner' | 'both'
  maxItems: number
  groupBias: number
  tol: number // desistência na fila (min)
  pickupTimeout: number // limite de retirada (min)
  sla: number // alvo de entrega (min)
  opCost: number // R$/h por atendente
  fixedCost: number // R$/dia
  walkSpeed: number // m/min operador
  custSpeed: number // m/min cliente
  payTime: number // min no PDV
  capacity: Record<string, number>
  cfgV: number
  menu: MenuItem[]
  bread: BreadConfig
  inv: { bibiteStart: number; bibiteCap: number; vitrineCap: number }
  seed?: number // semente do RNG (reprodutibilidade — extensão sobre o original)
}

/** Item da cena, no formato nativo do sim-core (t/n/x/y/w/h). */
export interface SceneItem {
  id?: string
  t: string
  n?: string
  x: number
  y: number
  w: number
  h: number
  color?: string
  hz?: number
}

/** Estação derivada da cena. */
export interface Station {
  id: string
  type: string
  name: string
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
  color: string
  hz?: number
  capacity: number
  sp: Vec2 | null
  unreachable?: boolean
}
