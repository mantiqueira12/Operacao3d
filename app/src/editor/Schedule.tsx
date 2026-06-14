/* Lista de equipamentos — modal que apresenta o quantitativo de peças da cena
   (agrupadas por zona) e exporta o resultado em CSV para o Excel. */

import { Fragment, useMemo } from 'react'
import './schedule.css'
import { equipmentSchedule, scheduleToCSV, type ScheduleRow } from '../domain/schedule'
import { type RestaurantScene } from '../domain'

/** Formato numérico brasileiro: duas casas, vírgula decimal. */
const fmt = (n: number): string => n.toFixed(2).replace('.', ',')

/** Rótulos das zonas (capitalizados) para os subcabeçalhos. */
const CATEGORY_LABELS: Record<string, string> = {
  atendimento: 'Atendimento',
  cozinha: 'Cozinha',
  gerais: 'Gerais',
  estrutura: 'Estrutura',
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1)
}

export default function ScheduleModal({
  scene,
  onClose,
}: {
  scene: RestaurantScene
  onClose: () => void
}) {
  const rows = useMemo(() => equipmentSchedule(scene.items), [scene.items])

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0)
  const totalArea = rows.reduce((sum, r) => sum + r.totalAreaM2, 0)

  function exportCSV(): void {
    const BOM = '﻿'
    const blob = new Blob([BOM + scheduleToCSV(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lista-equipamentos.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Marca, ao percorrer as linhas (já ordenadas por categoria), a primeira de cada
  // zona — usada para inserir um subcabeçalho antes dela.
  const renderRows: Array<{ row: ScheduleRow; firstOfCategory: boolean }> = []
  let prevCategory: string | null = null
  for (const row of rows) {
    renderRows.push({ row, firstOfCategory: row.category !== prevCategory })
    prevCategory = row.category
  }

  return (
    <div className="sch-overlay" onClick={onClose}>
      <div className="sch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sch-head">
          <h2>
            Lista de equipamentos
            <small>Quantitativo da planta</small>
          </h2>
          <button type="button" className="sch-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="sch-body">
          {rows.length === 0 ? (
            <p className="sch-empty">Nenhuma peça na planta ainda.</p>
          ) : (
            <table className="sch-table">
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
                  <Fragment key={`${row.type}|${row.name}|${row.width}|${row.depth}|${row.height}|${row.level}`}>
                    {firstOfCategory && (
                      <tr className="sch-cat">
                        <td colSpan={6}>{categoryLabel(row.category)}</td>
                      </tr>
                    )}
                    <tr className="sch-row">
                      <td>
                        <span className="sch-zone">
                          <span
                            className="sch-dot"
                            style={{ background: row.color }}
                            title={categoryLabel(row.category)}
                          />
                        </span>
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
            </table>
          )}
        </div>

        <div className="sch-foot">
          <div className="sch-totals">
            <div className="sch-total">
              <span className="k">Total de peças</span>
              <span className="v">{totalQty}</span>
            </div>
            <div className="sch-total">
              <span className="k">Área total ocupada</span>
              <span className="v">{fmt(totalArea)} m²</span>
            </div>
          </div>
          <button
            type="button"
            className="sch-export"
            onClick={exportCSV}
            disabled={rows.length === 0}
          >
            Exportar CSV
          </button>
        </div>
      </div>
    </div>
  )
}
