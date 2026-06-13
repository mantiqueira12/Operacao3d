import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageAdapter } from './LocalStorageAdapter'

function makeAdapter() {
  return new LocalStorageAdapter('test-ns')
}

describe('LocalStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('começa vazio', async () => {
    expect(await makeAdapter().list()).toEqual([])
  })

  it('cria projeto com id e timestamps', async () => {
    const a = makeAdapter()
    const p = await a.save({ name: 'Loja 206', data: { area: 11 } })

    expect(p.id).toBeTruthy()
    expect(p.name).toBe('Loja 206')
    expect(p.data).toEqual({ area: 11 })
    expect(p.createdAt).toBe(p.updatedAt)
    expect(await a.list()).toHaveLength(1)
  })

  it('recupera o projeto completo por id', async () => {
    const a = makeAdapter()
    const saved = await a.save({ name: 'X', data: { foo: 'bar' } })
    const got = await a.get<{ foo: string }>(saved.id)

    expect(got?.id).toBe(saved.id)
    expect(got?.data.foo).toBe('bar')
  })

  it('retorna null para id inexistente', async () => {
    expect(await makeAdapter().get('nao-existe')).toBeNull()
  })

  it('atualiza preservando createdAt e mudando updatedAt', async () => {
    const a = makeAdapter()
    const created = await a.save({ name: 'v1', data: 1 })
    await new Promise((r) => setTimeout(r, 2))
    const updated = await a.save({ id: created.id, name: 'v2', data: 2 })

    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
    expect(updated.data).toBe(2)
    expect(await a.list()).toHaveLength(1)
  })

  it('lista mais recentes primeiro', async () => {
    const a = makeAdapter()
    const first = await a.save({ name: 'antigo', data: null })
    await new Promise((r) => setTimeout(r, 2))
    const second = await a.save({ name: 'novo', data: null })

    const ids = (await a.list()).map((m) => m.id)
    expect(ids).toEqual([second.id, first.id])
  })

  it('remove é idempotente', async () => {
    const a = makeAdapter()
    const p = await a.save({ name: 'X', data: null })
    await a.remove(p.id)
    await a.remove(p.id) // não deve lançar

    expect(await a.get(p.id)).toBeNull()
    expect(await a.list()).toEqual([])
  })

  it('clear apaga tudo do namespace', async () => {
    const a = makeAdapter()
    await a.save({ name: 'A', data: null })
    await a.save({ name: 'B', data: null })
    await a.clear()

    expect(await a.list()).toEqual([])
  })

  it('isola namespaces diferentes', async () => {
    const a = new LocalStorageAdapter('ns-a')
    const b = new LocalStorageAdapter('ns-b')
    await a.save({ name: 'so-no-a', data: null })

    expect(await a.list()).toHaveLength(1)
    expect(await b.list()).toEqual([])
  })
})
