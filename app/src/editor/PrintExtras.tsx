/* Folha de prancha para impressão — caixa-de-handoff do arquiteto.
   Imprime DEPOIS da planta (página 2+): carimbo do projeto, lista de
   equipamentos (quantitativo agrupado por zona) e as três legendas
   (zonas, circulação e instalações). Componente puro: só lê a cena. */

import { Fragment } from 'react'
import './print.css'
import {
  equipmentSchedule,
  CATEGORY_COLORS,
  UTILITY_META,
  type ScheduleRow,
  type ItemCategory,
  type UtilityTag,
  type RestaurantScene,
} from '../domain'

/** Formato numérico brasileiro: duas casas, vírgula decimal. */
const fmt = (n: number): string => n.toFixed(2).replace('.', ',')

/** Rótulos das zonas (capitalizados) para os subcabeçalhos e a legenda. */
const CATEGORY_LABELS: Record<ItemCategory, string> = {
  atendimento: 'Atendimento',
  cozinha: 'Cozinha',
  gerais: 'Gerais',
  estrutura: 'Estrutura',
}

function categoryLabel(category: string): string {
  return (
    CATEGORY_LABELS[category as ItemCategory] ??
    category.charAt(0).toUpperCase() + category.slice(1)
  )
}

/** Faixas de circulação (passagem livre entre peças), em metros. */
const CIRCULATION: ReadonlyArray<{ color: string; label: string }> = [
  { color: '#E2000F', label: '< 0,60 m' },
  { color: '#C97B00', label: '0,60–0,90 m' },
  { color: '#1F8A5B', label: '≥ 0,90 m' },
]

/** Ordem canônica das instalações na legenda. */
const UTILITY_ORDER: readonly UtilityTag[] = [
  'eletrica',
  'hidraulica',
  'esgoto',
  'gas',
  'exaustao',
]

/** Linhas do carimbo (rótulo → valor), com fallback '—'. */
function titleBlockRows(scene: RestaurantScene): Array<[string, string]> {
  const tb = scene.titleBlock
  return [
    ['Projeto', tb?.project ?? '—'],
    ['Unidade', tb?.unit ?? '—'],
    ['Endereço', tb?.address ?? '—'],
    ['Responsável', tb?.responsible ?? '—'],
    ['Data/Rev', tb?.dateRev ?? '—'],
  ]
}

export default function PrintExtras({ scene }: { scene: RestaurantScene }) {
  const rows: ScheduleRow[] = equipmentSchedule(scene.items)

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0)
  const totalArea = rows.reduce((sum, r) => sum + r.totalAreaM2, 0)

  // Marca, ao percorrer as linhas (já ordenadas por categoria), a primeira de
  // cada zona — usada para inserir um subcabeçalho antes dela.
  const renderRows: Array<{ row: ScheduleRow; firstOfCategory: boolean }> = []
  let prevCategory: string | null = null
  for (const row of rows) {
    renderRows.push({ row, firstOfCategory: row.category !== prevCategory })
    prevCategory = row.category
  }

  return (
    <section className="print-sheet">
      {/* 1 — Carimbo do projeto */}
      <header className="pr-titleblock">
        <dl className="pr-tb-grid">
          {titleBlockRows(scene).map(([label, value]) => (
            <div className="pr-tb-row" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* 2 — Lista de equipamentos */}
      <h2 className="pr-h">Lista de equipamentos</h2>
      {rows.length === 0 ? (
        <p className="pr-empty">Nenhuma peça na planta.</p>
      ) : (
        <table className="pr-table">
          <thead>
            <tr>
              <th>Zona</th>
              <th>Item</th>
              <th>L×P×A</th>
              <th className="num">Nível (m)</th>
              <th className="num">Qtd</th>
              <th className="num">Área (m²)</th>
            </tr>
          </thead>
          <tbody>
            {renderRows.map(({ row, firstOfCategory }) => (
              <Fragment
                key={`${row.type}|${row.name}|${row.width}|${row.depth}|${row.height}|${row.level}`}
              >
                {firstOfCategory && (
                  <tr className="pr-cat">
                    <td colSpan={6}>{categoryLabel(row.category)}</td>
                  </tr>
                )}
                <tr className="pr-row">
                  <td>
                    <span
                      className="pr-dot"
                      style={{ background: row.color }}
                      title={categoryLabel(row.category)}
                    />
                  </td>
                  <td className="name">{row.name}</td>
                  <td className="dims">
                    {fmt(row.width)} × {fmt(row.depth)} × {fmt(row.height)} m
                  </td>
                  <td className="num">{fmt(row.level)}</td>
                  <td className="num">{row.qty}</td>
                  <td className="num">{fmt(row.totalAreaM2)}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="pr-foot">
              <td colSpan={4}>Total de peças</td>
              <td className="num">{totalQty}</td>
              <td className="num" />
            </tr>
            <tr className="pr-foot">
              <td colSpan={5}>Área total (peças)</td>
              <td className="num">{fmt(totalArea)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* 3 — Legendas (zonas · circulação · instalações) */}
      <div className="pr-legends">
        <div className="pr-legend">
          <h3>Zonas</h3>
          <ul>
            {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((cat) => (
              <li key={cat}>
                <span className="pr-dot" style={{ background: CATEGORY_COLORS[cat] }} />
                <span className="pr-lbl">{CATEGORY_LABELS[cat]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pr-legend">
          <h3>Circulação</h3>
          <ul>
            {CIRCULATION.map((c) => (
              <li key={c.label}>
                <span className="pr-dot" style={{ background: c.color }} />
                <span className="pr-lbl">{c.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pr-legend">
          <h3>Instalações</h3>
          <ul>
            {UTILITY_ORDER.map((tag) => {
              const meta = UTILITY_META[tag]
              return (
                <li key={tag}>
                  <span className="pr-dot" style={{ background: meta.color }} />
                  <span className="pr-short">{meta.short}</span>
                  <span className="pr-lbl">{meta.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
