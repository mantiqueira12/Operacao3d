/**
 * Lista de equipamentos (quantitativo) — agrupa peças idênticas da cena e produz
 * uma tabela ordenada por zona/nome, com área total ocupada. Puro e determinístico.
 *
 * "Peças idênticas" = mesmo tipo, nome e dimensões (largura × profundidade × altura)
 * no mesmo nível. A assinatura de agrupamento é `type|name|width|depth|height|level`.
 */

import type { Item } from './types'
import { getCatalogEntry } from './catalog'

/** Uma linha da lista: um grupo de peças idênticas, com quantidade e área somada. */
export interface ScheduleRow {
  type: string
  name: string
  category: string
  width: number
  depth: number
  height: number
  level: number
  qty: number
  color: string
  totalAreaM2: number
}

/** Ordem canônica das zonas (categorias) na lista. */
const CATEGORY_ORDER: readonly string[] = ['atendimento', 'cozinha', 'gerais', 'estrutura']

/** Formato numérico brasileiro: duas casas, vírgula decimal. */
const fmt = (n: number): string => n.toFixed(2).replace('.', ',')

/** Posição da categoria na ordem canônica (desconhecidas vão para o fim). */
function categoryRank(category: string): number {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

/**
 * Agrupa peças idênticas e devolve as linhas da lista de equipamentos.
 * Ordenadas por categoria (atendimento → cozinha → gerais → estrutura) e depois por nome (pt-BR).
 */
export function equipmentSchedule(items: Item[]): ScheduleRow[] {
  const groups = new Map<string, ScheduleRow>()

  for (const it of items) {
    const level = it.level ?? 0
    const key = `${it.type}|${it.name}|${it.width}|${it.depth}|${it.height}|${level}`
    const existing = groups.get(key)
    if (existing) {
      existing.qty += 1
      existing.totalAreaM2 = existing.qty * existing.width * existing.depth
    } else {
      const category = getCatalogEntry(it.type)?.category ?? 'gerais'
      groups.set(key, {
        type: it.type,
        name: it.name,
        category,
        width: it.width,
        depth: it.depth,
        height: it.height,
        level,
        qty: 1,
        color: it.color,
        totalAreaM2: it.width * it.depth,
      })
    }
  }

  return [...groups.values()].sort((a, b) => {
    const byCat = categoryRank(a.category) - categoryRank(b.category)
    if (byCat !== 0) return byCat
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

/** Envolve um campo em aspas apenas se contiver `;`, aspas ou quebra de linha. */
function csvField(value: string): string {
  if (/[";\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Serializa as linhas da lista em CSV separado por `;` (amigável ao Excel pt-BR),
 * com decimais em vírgula e terminadores `\r\n`.
 */
export function scheduleToCSV(rows: ScheduleRow[]): string {
  const header = 'Categoria;Item;Largura (m);Profundidade (m);Altura (m);Nível (m);Qtd;Área total (m²)'
  const lines = rows.map((r) =>
    [
      csvField(r.category),
      csvField(r.name),
      fmt(r.width),
      fmt(r.depth),
      fmt(r.height),
      fmt(r.level),
      String(r.qty),
      fmt(r.totalAreaM2),
    ].join(';'),
  )
  return [header, ...lines].join('\r\n')
}
