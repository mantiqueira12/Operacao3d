import { describe, expect, it } from 'vitest'
import { equipmentSchedule, scheduleToCSV } from './schedule'
import type { Item } from './types'

/** Cria uma peça mínima para teste (defaults sensatos, ids/nomes simples). */
function mk(over: Partial<Item> & { id: string }): Item {
  return {
    type: 'forno',
    name: over.id,
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 1,
    color: '#000',
    ...over,
  }
}

describe('equipmentSchedule', () => {
  it('agrupa peças idênticas e incrementa a quantidade', () => {
    const rows = equipmentSchedule([
      mk({ id: 'a', type: 'forno', name: 'Forno focaccia', width: 0.9, depth: 0.7, height: 1.6 }),
      mk({ id: 'b', type: 'forno', name: 'Forno focaccia', width: 0.9, depth: 0.7, height: 1.6 }),
      mk({ id: 'c', type: 'forno', name: 'Forno focaccia', width: 0.9, depth: 0.7, height: 1.6 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].qty).toBe(3)
    expect(rows[0].name).toBe('Forno focaccia')
  })

  it('dimensões distintas geram linhas separadas', () => {
    const rows = equipmentSchedule([
      mk({ id: 'a', type: 'forno', name: 'Forno', width: 0.9, depth: 0.7 }),
      mk({ id: 'b', type: 'forno', name: 'Forno', width: 1.2, depth: 0.7 }),
    ])
    expect(rows).toHaveLength(2)
  })

  it('níveis distintos geram linhas separadas', () => {
    const rows = equipmentSchedule([
      mk({ id: 'a', type: 'forno', name: 'Forno', level: 0 }),
      mk({ id: 'b', type: 'forno', name: 'Forno', level: 1.5 }),
    ])
    expect(rows).toHaveLength(2)
    const levels = rows.map((r) => r.level).sort()
    expect(levels).toEqual([0, 1.5])
  })

  it('trata nível ausente como 0 (agrupa com nível 0 explícito)', () => {
    const rows = equipmentSchedule([
      mk({ id: 'a', type: 'forno', name: 'Forno' }), // level undefined
      mk({ id: 'b', type: 'forno', name: 'Forno', level: 0 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].qty).toBe(2)
    expect(rows[0].level).toBe(0)
  })

  it('totalAreaM2 = qty × largura × profundidade', () => {
    const rows = equipmentSchedule([
      mk({ id: 'a', type: 'forno', name: 'Forno', width: 0.9, depth: 0.7 }),
      mk({ id: 'b', type: 'forno', name: 'Forno', width: 0.9, depth: 0.7 }),
    ])
    expect(rows[0].totalAreaM2).toBeCloseTo(2 * 0.9 * 0.7)
  })

  it('resolve a categoria pelo catálogo (forno→cozinha, caixa→atendimento)', () => {
    const rows = equipmentSchedule([
      mk({ id: 'a', type: 'forno', name: 'Forno' }),
      mk({ id: 'b', type: 'caixa', name: 'Caixa' }),
    ])
    const byType = Object.fromEntries(rows.map((r) => [r.type, r.category]))
    expect(byType.forno).toBe('cozinha')
    expect(byType.caixa).toBe('atendimento')
  })

  it('ordena por categoria (atendimento → cozinha) e depois por nome', () => {
    const rows = equipmentSchedule([
      mk({ id: 'a', type: 'forno', name: 'Zebra cozinha' }),
      mk({ id: 'b', type: 'forno', name: 'Alfa cozinha' }),
      mk({ id: 'c', type: 'caixa', name: 'Caixa PDV' }),
    ])
    // atendimento vem antes de cozinha; dentro da cozinha, nome A < Z
    expect(rows.map((r) => r.name)).toEqual(['Caixa PDV', 'Alfa cozinha', 'Zebra cozinha'])
  })

  it('é determinístico para a mesma entrada', () => {
    const items = [
      mk({ id: 'a', type: 'forno', name: 'Forno' }),
      mk({ id: 'b', type: 'caixa', name: 'Caixa' }),
    ]
    expect(equipmentSchedule(items)).toEqual(equipmentSchedule(items))
  })
})

describe('scheduleToCSV', () => {
  it('tem o cabeçalho + uma linha por ScheduleRow e usa decimais com vírgula', () => {
    const rows = equipmentSchedule([
      mk({ id: 'a', type: 'forno', name: 'Forno focaccia', width: 0.9, depth: 0.7, height: 1.6 }),
      mk({ id: 'b', type: 'forno', name: 'Forno focaccia', width: 0.9, depth: 0.7, height: 1.6 }),
      mk({ id: 'c', type: 'caixa', name: 'Caixa PDV', width: 0.7, depth: 0.55, height: 1.05 }),
    ])
    const csv = scheduleToCSV(rows)
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe(
      'Categoria;Item;Largura (m);Profundidade (m);Altura (m);Nível (m);Qtd;Área total (m²)',
    )
    expect(lines).toHaveLength(rows.length + 1)
    // vírgula decimal e separador ponto-e-vírgula
    expect(csv).toContain('0,90;0,70;1,60')
    expect(csv).toContain(';2;1,26') // qty=2 e área total do forno (2×0,9×0,7)
  })
})
