/**
 * Store de "Meus modelos" — equipamentos personalizados criados pelo usuário.
 *
 * Persistência via StorageAdapter (MVP = localStorage; nuvem = trocar o adapter, sem
 * mudar esta API). Espelha CUSTOM/regCustom/loadCustom/saveCustom do protótipo
 * (planner.js:57-69), mas respeitando a arquitetura: o domínio (catalog.ts) só recebe
 * o registro dos tipos via setCustomEntries; a gravação fica aqui.
 *
 * NOTA MVP: hoje os modelos vivem num "projeto" dedicado no LocalStorageAdapter
 * (id fixo CUSTOM_PROJECT_ID). Ao migrar para nuvem, basta o mesmo contrato.
 */
import type { Arch3D, CatalogEntry, ItemCategory } from '../domain'
import { CATEGORY_COLORS, setCustomEntries } from '../domain/catalog'
import { LocalStorageAdapter, type StorageAdapter } from '../storage'

/**
 * Namespace dedicado: mantém os modelos custom FORA do índice de projetos da cena
 * (senão apareceriam em storage.list() e o useScene poderia carregá-los como cena).
 * Segue o padrão StorageAdapter — trocável por nuvem sem mexer na UI.
 */
function defaultStore(): StorageAdapter {
  return new LocalStorageAdapter('operacao3d-models')
}

/** Projeto único (id fixo) dentro do namespace de modelos. */
const CUSTOM_PROJECT_ID = 'custom-models'

/** Arquétipos 3D oferecidos no modal (mesma ordem do protótipo). */
export const ARCHETYPES: Array<{ value: Arch3D; label: string }> = [
  { value: 'box', label: 'Bloco' },
  { value: 'counter', label: 'Bancada' },
  { value: 'fridge', label: 'Geladeira' },
  { value: 'shelf', label: 'Prateleira' },
  { value: 'panel', label: 'Painel' },
  { value: 'appliance', label: 'Equip.' },
]

/** Swatches de cor rotulados por zona (index.html:199-206 + colorToCat). */
export const ZONE_SWATCHES: Array<{ color: string; label: string; category: ItemCategory }> = [
  { color: '#E2000F', label: 'Atend.', category: 'atendimento' },
  { color: '#1A1A1A', label: 'Cozinha', category: 'cozinha' },
  { color: '#2B2B2B', label: 'Estrut.', category: 'estrutura' },
  { color: '#9A9284', label: 'Gerais', category: 'gerais' },
  { color: '#2A6FDB', label: 'Frio', category: 'gerais' },
  { color: '#1F8A5B', label: 'Verde', category: 'gerais' },
]

/** Deriva a categoria a partir da cor escolhida (colorToCat do protótipo, planner.js:830). */
export function colorToCategory(color: string): ItemCategory {
  const hit = ZONE_SWATCHES.find((s) => s.color.toUpperCase() === color.toUpperCase())
  return hit?.category ?? 'gerais'
}

/** Gera um id de tipo custom estável (newType do protótipo). */
export function newCustomType(): string {
  return 'cst' + Date.now().toString(36) + Math.floor(Math.random() * 1000)
}

/** Seed: o "Char-broiler 2 bocas" do protótipo (props.js DEFAULT_CUSTOM). */
const DEFAULT_CUSTOM: CatalogEntry[] = [
  {
    type: 'cstmq5i9f2u5',
    name: 'Char-broiler 2 bocas',
    category: 'cozinha',
    width: 1.1,
    depth: 0.7,
    height: 1.15,
    color: '#1A1A1A',
    arch: 'appliance',
  },
]

function clone(list: CatalogEntry[]): CatalogEntry[] {
  return list.map((e) => ({ ...e }))
}

/** Normaliza uma entrada vinda do storage (defaults defensivos). */
function normalize(e: Partial<CatalogEntry> & { type: string }): CatalogEntry {
  const category: ItemCategory = e.category ?? 'gerais'
  return {
    type: e.type,
    name: e.name ?? 'Modelo',
    category,
    width: e.width ?? 1,
    depth: e.depth ?? 0.6,
    height: e.height ?? 0.9,
    color: e.color ?? CATEGORY_COLORS[category],
    arch: e.arch ?? undefined,
    utils: e.utils,
  }
}

/**
 * Carrega os modelos custom do storage (ou o seed na primeira vez), registra-os no
 * catálogo e retorna a lista. Idempotente.
 */
export async function loadCustomModels(storage: StorageAdapter = defaultStore()): Promise<CatalogEntry[]> {
  let list = clone(DEFAULT_CUSTOM)
  try {
    const p = await storage.get<CatalogEntry[]>(CUSTOM_PROJECT_ID)
    if (p && Array.isArray(p.data) && p.data.length) {
      list = p.data.map(normalize)
    }
  } catch {
    /* storage indisponível — usa o seed */
  }
  setCustomEntries(list)
  return list
}

/** Grava a lista inteira e re-registra no catálogo. */
export async function saveCustomModels(
  list: CatalogEntry[],
  storage: StorageAdapter = defaultStore(),
): Promise<void> {
  setCustomEntries(list)
  try {
    await storage.save<CatalogEntry[]>({ id: CUSTOM_PROJECT_ID, name: 'Meus modelos', data: list })
  } catch {
    /* persistência falhou — estado em memória segue válido nesta sessão */
  }
}
