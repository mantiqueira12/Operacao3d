import type { Arch3D, CatalogEntry, Item, ItemCategory, UtilityTag } from './types'

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

/**
 * Cor de acento por-tipo (sobrepõe a cor da categoria ao inserir do catálogo).
 * Portado de DEFAULT_SCENE do protótipo (planner.js:86-87): batedeira e estufa têm
 * acento marrom/laranja distinto do preto da cozinha. Mantém CATEGORY_COLORS como fallback.
 */
const ACCENT_COLORS: Record<string, string> = {
  batedeira: '#8A5A2B',
  estufa: '#B5781F',
}
function accentFor(type: string, category: ItemCategory): string {
  return ACCENT_COLORS[type] ?? CATEGORY_COLORS[category]
}

/** Instalações por tipo (pontos de execução: elétrica/hidráulica/esgoto/gás/exaustão). */
const UTILS: Record<string, UtilityTag[]> = {
  forno: ['gas', 'eletrica', 'exaustao'],
  estufa: ['eletrica'],
  batedeira: ['eletrica'],
  geladeira: ['eletrica'],
  bibite: ['eletrica'],
  vitrine: ['eletrica'],
  caixa: ['eletrica'],
  pia: ['hidraulica', 'esgoto'],
  prep: ['eletrica'],
}
function utilsForType(type: string): UtilityTag[] {
  return UTILS[type] ?? []
}

/** Metadados de UI das instalações (sigla, rótulo, cor). */
export const UTILITY_META: Record<UtilityTag, { short: string; label: string; color: string }> = {
  eletrica: { short: 'E', label: 'Elétrica', color: '#E8A400' },
  hidraulica: { short: 'H', label: 'Hidráulica (água)', color: '#2A6FDB' },
  esgoto: { short: 'S', label: 'Esgoto', color: '#6B5B95' },
  gas: { short: 'G', label: 'Gás', color: '#E2000F' },
  exaustao: { short: 'X', label: 'Exaustão', color: '#7A7A7A' },
}

/* ---------- folgas operacionais (zonas de trabalho/segurança) ---------- */

/**
 * Tipo de zona de folga que uma peça projeta no piso (consumido por `workZones`
 * em domain/spatial). Aditivo ao catálogo — não altera o modelo de `Item`.
 *   work → faixa de operação à frente do equipamento (atendente/cozinheiro em pé).
 *   hot  → afastamento de calor/segurança em volta (forno, gás, char-broiler).
 *   door → vão de abertura de porta/tampa à frente (geladeira, estufa, bibite).
 */
export type ClearanceKind = 'work' | 'hot' | 'door'

/** Metadados de folga por tipo: a natureza da zona e sua profundidade (m). */
export interface ClearanceMeta {
  kind: ClearanceKind
  /** profundidade da zona, em metros */
  depth: number
}

/** Profundidades de referência (m): sanitária SP / NBR 9050 e boas práticas de cozinha. */
const WORK_DEPTH = 0.9 // faixa de operação confortável à frente da bancada
const HOT_DEPTH = 0.4 // afastamento de calor/combustível em volta do forno
const DOOR_DEPTH = 0.6 // profundidade de abertura de porta de geladeira/estufa

/**
 * Folga operacional por tipo. Quem não estiver mapeado não projeta zona
 * (`clearanceFor` devolve `null`) — marcadores e estruturas (porta, extintor,
 * lixeira, apoio, estoque, wall, painel) não têm faixa de trabalho dedicada.
 */
const CLEARANCE: Record<string, ClearanceMeta> = {
  // calor / gás / segurança — afastamento em volta
  forno: { kind: 'hot', depth: HOT_DEPTH },
  // abertura de porta/tampa — vão à frente
  geladeira: { kind: 'door', depth: DOOR_DEPTH },
  bibite: { kind: 'door', depth: DOOR_DEPTH },
  estufa: { kind: 'door', depth: DOOR_DEPTH },
  vitrine: { kind: 'door', depth: DOOR_DEPTH },
  // faixa de operação à frente — atendente / cozinheiro em pé
  caixa: { kind: 'work', depth: WORK_DEPTH },
  prep: { kind: 'work', depth: WORK_DEPTH },
  montagem: { kind: 'work', depth: WORK_DEPTH },
  pia: { kind: 'work', depth: WORK_DEPTH },
  balcao: { kind: 'work', depth: WORK_DEPTH },
  batedeira: { kind: 'work', depth: WORK_DEPTH },
}

/** Folga operacional de um tipo (ou `null` se o tipo não projeta zona). */
export function clearanceFor(type: string): ClearanceMeta | null {
  return CLEARANCE[type] ?? null
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
      color: accentFor(e.type, cat),
      utils: utilsForType(e.type),
    })),
  ]),
) as Record<ItemCategory, CatalogEntry[]>

/** Índice plano tipo → entrada, para lookup O(1). */
const INDEX: Map<string, CatalogEntry> = new Map(
  Object.values(CATALOG).flat().map((e) => [e.type, e]),
)

/**
 * Registro de modelos personalizados ("Meus modelos"), criados pelo usuário.
 * Aditivo e separado do CATALOG base: a UI registra/limpa os custom aqui para que
 * `getCatalogEntry`/`createItem` resolvam o tipo custom (renderização 2D/3D cai no
 * fallback genérico por arquétipo). A persistência fica na camada de UI (StorageAdapter),
 * mantendo o domínio puro. Portado de regCustom/CUSTOM do protótipo (planner.js:57-69).
 */
const CUSTOM_INDEX: Map<string, CatalogEntry> = new Map()

/** Registra (ou atualiza) um modelo custom no índice de lookup. */
export function registerCustomEntry(entry: CatalogEntry): void {
  CUSTOM_INDEX.set(entry.type, entry)
}

/** Remove um modelo custom do índice. */
export function unregisterCustomEntry(type: string): void {
  CUSTOM_INDEX.delete(type)
}

/** Substitui o conjunto inteiro de modelos custom (usado ao recarregar do storage). */
export function setCustomEntries(entries: CatalogEntry[]): void {
  CUSTOM_INDEX.clear()
  for (const e of entries) CUSTOM_INDEX.set(e.type, e)
}

export function getCatalogEntry(type: string): CatalogEntry | undefined {
  return INDEX.get(type) ?? CUSTOM_INDEX.get(type)
}

/** Instalações demandadas por um tipo (vazio se não mapeado). */
export function utilsFor(type: string): UtilityTag[] {
  return INDEX.get(type)?.utils ?? []
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
    level: overrides.level ?? 0,
    color: overrides.color ?? entry.color,
    arch: overrides.arch ?? entry.arch ?? null,
  }
}
