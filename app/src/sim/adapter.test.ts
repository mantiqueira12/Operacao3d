import { describe, expect, it } from 'vitest'
import { loja206Scene } from '../domain'
import { baseConfig } from './defaults'
import { runSimulation } from './engine'
import { itemToSimItem, sceneToSim, sceneToSimItems } from './adapter'
import type { Item } from '../domain/types'

describe('adapter cena→sim', () => {
  it('renomeia os campos do domínio para o formato do motor', () => {
    const it: Item = {
      id: 'x1',
      type: 'forno',
      name: 'Forno teste',
      x: 1,
      y: 2,
      width: 0.9,
      depth: 0.7,
      height: 1.6,
      color: '#abc',
      arch: 'appliance',
    }
    expect(itemToSimItem(it)).toEqual({ id: 'x1', t: 'forno', n: 'Forno teste', x: 1, y: 2, w: 0.9, h: 0.7, color: '#abc', hz: 1.6 })
  })

  it('converte a cena da Loja 206 preservando todas as peças', () => {
    let seq = 0
    const scene = loja206Scene(() => 'id' + seq++)
    const items = sceneToSimItems(scene)
    expect(items).toHaveLength(scene.items.length)
    // tipos esperados presentes
    const types = items.map((i) => i.t)
    for (const t of ['caixa', 'vitrine', 'montagem', 'forno', 'batedeira', 'estufa', 'painel']) {
      expect(types).toContain(t)
    }
  })

  it('sceneToSim devolve itens + o polígono da casca', () => {
    let seq = 0
    const scene = loja206Scene(() => 'id' + seq++)
    const { items, polygon } = sceneToSim(scene)
    expect(items).toHaveLength(scene.items.length)
    expect(polygon).toEqual(scene.room.polygon) // casca em L da 206 repassada ao motor
  })

  it('a cena convertida roda no motor e produz KPIs sãos', () => {
    let seq = 0
    const scene = loja206Scene(() => 'id' + seq++)
    const k = runSimulation({ ...baseConfig(), seed: 42 }, sceneToSimItems(scene))
    expect(k.served).toBeGreaterThan(20)
    expect(k.revenueNet).toBeGreaterThan(0)
    expect(k.bread.baked).toBeGreaterThan(0) // padaria do fundo funciona com a cena do editor
  })

  it('passar o polígono da casca explicitamente preserva o resultado da 206', () => {
    let seq = 0
    const scene = loja206Scene(() => 'id' + seq++)
    const items = sceneToSimItems(scene)
    const cfg = { ...baseConfig(), seed: 42 }
    const semCasca = runSimulation(cfg, items) // casca default (206)
    const comCasca = runSimulation(cfg, items, {}, scene.room.polygon) // casca threaded
    expect(comCasca.served).toBe(semCasca.served)
    expect(comCasca.revenueNet).toBe(semCasca.revenueNet)
    expect(comCasca.walkMetersTotal).toBe(semCasca.walkMetersTotal)
    expect(comCasca.bread.baked).toBe(semCasca.bread.baked)
  })
})
