import { createItem } from '../catalog'
import type { RestaurantScene, Room } from '../types'

/**
 * Template do caso-âncora All'Antico Panino — Loja 206.
 *
 * Isto é um TEMPLATE, não uma constante do motor: a geometria e a cena vivem aqui,
 * de forma que outros projetos/lojas sejam apenas outros templates. Resolve a dívida
 * "tudo hardcoded para Loja 206" do protótipo.
 */
const ROOM: Room = {
  polygon: [
    [0, 0],
    [2.0, 0],
    [2.0, 3.0],
    [2.6, 3.0],
    [2.6, 5.15],
    [0, 5.15],
  ],
  labeledAreaM2: 11.0,
  fohDepth: 2.15,
}

/** Peças padrão (portado de DEFAULT_SCENE). `[type, overrides]`. */
const ITEMS: Array<[string, Partial<Parameters<typeof createItem>[2]>]> = [
  ['caixa', { name: 'Caixa · PDV', x: 0.0, y: 4.6, width: 0.77, depth: 0.55, height: 1.05, color: '#E2000F' }],
  ['vitrine', { name: 'Vitrine refrigerada', x: 0.8, y: 4.4, width: 1.7, depth: 0.72, height: 1.2, color: '#E2000F' }],
  ['montagem', { name: 'Bancada de montagem', x: 2.0, y: 3.08, width: 0.6, depth: 1.25, height: 0.9, color: '#1A1A1A' }],
  ['estoque', { name: 'Estoque', x: 0.08, y: 0.1, width: 1.0, depth: 0.4, height: 1.8, color: '#1A1A1A' }],
  ['forno', { name: 'Forno focaccia', x: 1.12, y: 0.1, width: 0.88, depth: 0.7, height: 1.6, color: '#1A1A1A' }],
  ['batedeira', { name: 'Batedeira de massa', x: 1.4, y: 1.0, width: 0.55, depth: 0.55, height: 1.3, color: '#8A5A2B' }],
  ['estufa', { name: 'Estufa de fermentação', x: 1.32, y: 1.7, width: 0.62, depth: 0.75, height: 1.75, color: '#B5781F' }],
  ['prep', { name: 'Bancada de prep', x: 0.08, y: 0.7, width: 0.58, depth: 1.35, height: 0.9, color: '#1A1A1A' }],
  ['pia', { name: 'Pia / lavagem', x: 0.08, y: 2.15, width: 0.58, depth: 0.55, height: 0.9, color: '#1A1A1A' }],
  ['bibite', { name: 'Geladeira bibite', x: 0.0, y: 3.35, width: 0.48, depth: 0.7, height: 1.4, color: '#1A1A1A' }],
  ['painel', { name: 'Painel de fundo (FOH/BOH)', x: 0.0, y: 2.95, width: 2.0, depth: 0.1, height: 2.8, color: '#EDE7D7', arch: 'panel' }],
]

const TITLE_BLOCK = {
  project: "Panineria All'Antico Panino",
  unit: 'Loja 206',
  address: 'R. das Oliveiras, 142 · V. Madalena, SP',
  responsible: '—',
  dateRev: '06 · 2026 — Rev 02',
}

/**
 * Constrói a cena da Loja 206. `makeId` gera ids únicos (injetado para manter pureza
 * e testabilidade).
 */
export function loja206Scene(makeId: () => string): RestaurantScene {
  return {
    room: ROOM,
    items: ITEMS.map(([type, overrides]) => createItem(type, makeId(), overrides)),
    finishes: { floor: 'porcelanato', wall: 'panna' },
    titleBlock: TITLE_BLOCK,
    snap: 0.05,
  }
}
