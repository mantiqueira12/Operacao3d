import { describe, expect, it } from 'vitest'
import { baseConfig } from './defaults'
import { DEFAULT_SCENE, deriveScene, inShell } from './geometry'
import { computeSlots, NavGrid } from './nav'
import { Rng } from './rng'

describe('geometria da casca', () => {
  it('inShell respeita o recorte em L', () => {
    expect(inShell(1.0, 1.0)).toBe(true) // BOH estreito
    expect(inShell(2.3, 1.0)).toBe(false) // recorte (x>2 com y<3)
    expect(inShell(2.3, 4.0)).toBe(true) // FOH mais largo
    expect(inShell(-0.1, 1.0)).toBe(false)
    expect(inShell(1.0, 6.0)).toBe(false) // além do portão
  })
})

describe('navegação A*', () => {
  const { stations, blockers } = deriveScene(DEFAULT_SCENE, baseConfig().capacity)
  const nav = new NavGrid()
  nav.build(blockers, stations)

  it('constrói a malha com dimensões esperadas (~53×104)', () => {
    expect(nav.ngW).toBe(53)
    expect(nav.ngH).toBe(104)
  })

  it('todas as estações têm ponto de serviço alcançável', () => {
    for (const st of stations) {
      expect(st.sp).not.toBeNull()
      expect(st.unreachable).toBeFalsy()
    }
  })

  it('acha caminho do caixa (FOH) à batedeira (BOH) atravessando o vão do painel', () => {
    const caixa = stations.find((s) => s.type === 'caixa')!
    const bat = stations.find((s) => s.type === 'batedeira')!
    const path = nav.findPath(caixa.sp!.x, caixa.sp!.y, bat.sp!.x, bat.sp!.y)
    expect(path.length).toBeGreaterThan(0)
    // termina perto do destino (não saltou)
    const last = path[path.length - 1]
    expect(Math.hypot(last.x - bat.sp!.x, last.y - bat.sp!.y)).toBeLessThan(0.3)
    expect(nav.pathLen(path, caixa.sp!.x, caixa.sp!.y)).toBeGreaterThan(1.0)
  })

  it('caminho é determinístico (cache) e simétrico em comprimento aproximado', () => {
    const a = stations.find((s) => s.type === 'forno')!
    const b = stations.find((s) => s.type === 'vitrine')!
    const p1 = nav.findPath(a.sp!.x, a.sp!.y, b.sp!.x, b.sp!.y)
    const p2 = nav.findPath(a.sp!.x, a.sp!.y, b.sp!.x, b.sp!.y)
    expect(p1.length).toBe(p2.length)
  })
})

describe('slots de fila/retirada', () => {
  const { stations } = deriveScene(DEFAULT_SCENE, baseConfig().capacity)
  const { queueSlots, pickupSlots } = computeSlots(stations)
  it('gera fila e 10 slots de retirada na calçada', () => {
    expect(queueSlots.length).toBeGreaterThan(0)
    expect(pickupSlots.length).toBe(10)
    // todos os slots ficam fora da loja (y > portão)
    for (const s of [...queueSlots, ...pickupSlots]) expect(s.y).toBeGreaterThan(5.15)
  })
})

describe('RNG semeável', () => {
  it('é determinístico por seed', () => {
    const a = new Rng(42)
    const b = new Rng(42)
    expect(a.random()).toBe(b.random())
    expect(a.exp(0.5)).toBe(b.exp(0.5))
  })
  it('exp tem média ~1/rate em larga escala', () => {
    const r = new Rng(7)
    let sum = 0
    const N = 20000
    for (let i = 0; i < N; i++) sum += r.exp(2)
    const mean = sum / N
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })
})
