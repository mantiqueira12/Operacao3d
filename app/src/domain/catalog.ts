import type { Arch3D, CatalogEntry, Item, ItemCategory } from './types'

/** Cor padrão por categoria (portado de CAT_COLORS do protótipo). */
export const CATEGORY_COLORS: Record<ItemCategory, string> = {
  atendimento: '#E2000F',
  cozinha: '#1A1A1A',
  gerais: '#9A9284',
  estrutura: '#2B2B2B',
}

/** Altura 3D padrão por tipo (m), portado de HZ. Fallback = 0.90. */
const HEIGHTS: Record<string, number> = {
  balcao: 1.05, caixa: 1.05, vitrine: 1.2, forno: 1.6, geladeira: 1.9,
  bibite: 1.4, prep: 0.9, batedeira: 1.3, estufa: 1.75, montagem: 0.9,
  pia: 0.9, estoque: 1.8, apoio: 0.75, lixeira: 0.7, extintor: 0.55,
  porta: 2.1, wall: 2.8, painel: 2.8,
}

function heightFor(type: string): number {
  return HEIGHTS[type] ?? 0.9
}

/** Dados crus do catálogo, por categoria (portado de CATALOG do protótipo). */
const RAW: Record<ItemCategory, Array<{ type: string; name: string; width: number; depth: number; arch?: Arch3D }>> = {
  atendimento: [
    { type: 'balcao', name: 'Balcão (divisa)', width: 1.8, depth: 0.55 },
    { type: 'caixa', name: 'Caixa · PDV', width: 0.7, depth: 0.55, arch: 'counter' },
    { type: 'vitrine', name: 'Vitrine refrigerada', width: 1.2, depth: 0.55, arch: 'fridge' },
  ],
  cozinha: [
    { type: 'forno', name: 'Forno focaccia', width: 0.9, depth: 0.7, arch: 'appliance' },
    { type: 'batedeira', name: 'Batedeira de massa', width: 0.55, depth: 0.55, arch: 'appliance' },
    { type: 'estufa', name: 'Estufa de fermentação', width: 0.62, depth: 0.75, arch: 'appliance' },
    { type: 'geladeira', name: 'Geladeira', width: 0.7, depth: 0.7, arch: 'fridge' },
    { type: 'bibite', name: 'Geladeira bibite', width: 0.5, depth: 0.6, arch: 'fridge' },
    { type: 'prep', name: 'Bancada de prep', width: 1.4, depth: 0.6, arch: 'counter' },
    { type: 'montagem', name: 'Bancada de montagem', width: 1.2, depth: 0.6, arch: 'counter' },
    { type: 'pia', name: 'Pia / lavagem', width: 0.6, depth: 0.55, arch: 'counter' },
    { type: 'estoque', name: 'Estoque / prateleira', width: 1.0, depth: 0.4, arch: 'shelf' },
  ],
  gerais: [
    { type: 'porta', name: 'Porta', width: 0.8, depth: 0.12 },
    { type: 'lixeira', name: 'Lixeira', width: 0.4, depth: 0.4, arch: 'box' },
    { type: 'extintor', name: 'Extintor', width: 0.25, depth: 0.15, arch: 'box' },
    { type: 'apoio', name: 'Mesa de apoio', width: 0.6, depth: 0.6, arch: 'box' },
  ],
  estrutura: [
    { type: 'wall', name: 'Parede', width: 1.0, depth: 0.12, arch: 'panel' },
    { type: 'painel', name: 'Painel divisor', width: 2.0, depth: 0.1, arch: 'panel' },
  ],
}

/** Catálogo normalizado (com cor, altura e categoria resolvidas). */
export const CATALOG: Record<ItemCategory, CatalogEntry[]> = Object.fromEntries(
  (Object.keys(RAW) as ItemCategory[]).map((cat) => [
    cat,
    RAW[cat].map((e) => ({
      ...e,
      category: cat,
      height: heightFor(e.type),
      color: CATEGORY_COLORS[cat],
    })),
  ]),
) as Record<ItemCategory, CatalogEntry[]>

/** Índice plano tipo → entrada, para lookup O(1). */
const INDEX: Map<string, CatalogEntry> = new Map(
  Object.values(CATALOG).flat().map((e) => [e.type, e]),
)

export function getCatalogEntry(type: string): CatalogEntry | undefined {
  return INDEX.get(type)
}

export function catalogEntries(): CatalogEntry[] {
  return [...INDEX.values()]
}

/**
 * Cria uma peça a partir do catálogo (paramétrica). O `id` é responsabilidade do
 * chamador/loja, mantendo esta função pura e testável.
 */
export function createItem(
  type: string,
  id: string,
  overrides: Partial<Omit<Item, 'id' | 'type'>> = {},
): Item {
  const entry = getCatalogEntry(type)
  if (!entry) throw new Error(`Tipo desconhecido no catálogo: "${type}"`)
  return {
    id,
    type,
    name: overrides.name ?? entry.name,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? entry.width,
    depth: overrides.depth ?? entry.depth,
    height: overrides.height ?? entry.height,
    color: overrides.color ?? entry.color,
    arch: overrides.arch ?? entry.arch ?? null,
  }
}
