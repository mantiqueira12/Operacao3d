import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampToPolygon,
  collisionPairs,
  collisionSet,
  createItem,
  isSolid,
  loja206Scene,
  outOfBoundsSet,
  stackTopBelow,
  type Item,
  type RestaurantScene,
  type TitleBlock,
} from '../domain'
import { createStorage } from '../storage'
import { boundsOf, clampPosition, rotated } from './geometry'

const newId = () => crypto.randomUUID()

/** Estado + mutações da cena, com carga e gravação automática na persistência. */
export function useScene() {
  const storage = useMemo(() => createStorage(), [])
  const [scene, setScene] = useState<RestaurantScene | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Carga inicial: projeto salvo ou template Loja 206.
  useEffect(() => {
    let alive = true
    void (async () => {
      const metas = await storage.list()
      if (!alive) return
      if (metas.length > 0) {
        const p = await storage.get<RestaurantScene>(metas[0].id)
        if (alive && p) {
          setScene(p.data)
          setProjectId(p.id)
          return
        }
      }
      const fresh = loja206Scene(newId)
      const saved = await storage.save<RestaurantScene>({
        name: fresh.titleBlock?.unit ?? 'Projeto',
        data: fresh,
      })
      if (alive) {
        setScene(saved.data)
        setProjectId(saved.id)
      }
    })()
    return () => {
      alive = false
    }
  }, [storage])

  // Gravação com debounce a cada mudança.
  useEffect(() => {
    if (!scene || !projectId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void storage.save({
        id: projectId,
        name: scene.titleBlock?.unit ?? 'Projeto',
        data: scene,
      })
    }, 400)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [scene, projectId, storage])

  const grid = scene?.snap ?? 0.05
  const bounds = useMemo(
    () => (scene ? boundsOf(scene.room.polygon) : null),
    [scene],
  )

  /** Peças que ocupam o mesmo volume (sobreposição plano ∩ altura). Recalcula ao vivo. */
  const collisions = useMemo(
    () => (scene ? collisionSet(scene.items) : new Set<string>()),
    [scene],
  )
  const conflicts = useMemo(
    () => (scene ? collisionPairs(scene.items) : []),
    [scene],
  )
  /** Peças sólidas cujo footprint sai da casca (layout inválido). */
  const outOfBounds = useMemo(
    () => (scene ? outOfBoundsSet(scene.items, scene.room.polygon) : new Set<string>()),
    [scene],
  )

  const patchItem = useCallback(
    (id: string, patch: Partial<Item>) => {
      setScene((s) =>
        s
          ? { ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }
          : s,
      )
    },
    [],
  )

  /** Move a peça para (x, y) com clamp na casca (snap é aplicado pela UI). */
  const moveItem = useCallback(
    (id: string, x: number, y: number) => {
      setScene((s) => {
        if (!s) return s
        const it = s.items.find((i) => i.id === id)
        if (!it) return s
        const poly = s.room.polygon
        // peças sólidas travam dentro do polígono; marcadores (porta/extintor) seguem a bbox
        const c = isSolid(it)
          ? clampToPolygon(x, y, it.width, it.depth, poly)
          : clampPosition(x, y, it.width, it.depth, boundsOf(poly))
        return { ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...c } : i)) }
      })
    },
    [],
  )

  const patchTitleBlock = useCallback((patch: Partial<TitleBlock>) => {
    setScene((s) => {
      if (!s) return s
      const base: TitleBlock = s.titleBlock ?? {
        project: '', unit: 'Projeto', address: '', responsible: '', dateRev: '',
      }
      return { ...s, titleBlock: { ...base, ...patch } }
    })
  }, [])

  const replaceScene = useCallback((next: RestaurantScene) => {
    setScene(next)
    setSelectedId(null)
  }, [])

  const addItem = useCallback((type: string) => {
    setScene((s) => {
      if (!s) return s
      const b = boundsOf(s.room.polygon)
      const draft = createItem(type, newId())
      const x = (b.minX + b.maxX) / 2 - draft.width / 2
      const y = (b.minY + b.maxY) / 2 - draft.depth / 2
      const placed = { ...draft, ...clampPosition(x, y, draft.width, draft.depth, b) }
      setSelectedId(placed.id)
      return { ...s, items: [...s.items, placed] }
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setScene((s) => (s ? { ...s, items: s.items.filter((i) => i.id !== id) } : s))
    setSelectedId((cur) => (cur === id ? null : cur))
  }, [])

  const duplicateItem = useCallback((id: string) => {
    setScene((s) => {
      if (!s) return s
      const it = s.items.find((i) => i.id === id)
      if (!it) return s
      const b = boundsOf(s.room.polygon)
      const copy: Item = {
        ...it,
        id: newId(),
        ...clampPosition(it.x + 0.2, it.y + 0.2, it.width, it.depth, b),
      }
      setSelectedId(copy.id)
      return { ...s, items: [...s.items, copy] }
    })
  }, [])

  const rotateItem = useCallback((id: string) => {
    setScene((s) => {
      if (!s) return s
      const it = s.items.find((i) => i.id === id)
      if (!it) return s
      const b = boundsOf(s.room.polygon)
      const g = s.snap ?? 0.05
      const r = rotated(it, g)
      const c = clampPosition(r.x, r.y, r.width, r.depth, b)
      return {
        ...s,
        items: s.items.map((i) =>
          i.id === id ? { ...i, width: r.width, depth: r.depth, ...c } : i,
        ),
      }
    })
  }, [])

  /** Eleva a peça para o topo da(s) peça(s) sob o mesmo footprint ("colocar em cima de"). */
  const stackOnBelow = useCallback((id: string) => {
    setScene((s) => {
      if (!s) return s
      const it = s.items.find((i) => i.id === id)
      if (!it) return s
      const top = stackTopBelow(it, s.items)
      if (top == null) return s
      return { ...s, items: s.items.map((i) => (i.id === id ? { ...i, level: top } : i)) }
    })
  }, [])

  const selected = scene?.items.find((i) => i.id === selectedId) ?? null

  return {
    scene,
    bounds,
    grid,
    selected,
    selectedId,
    select: setSelectedId,
    addItem,
    moveItem,
    patchItem,
    removeItem,
    duplicateItem,
    rotateItem,
    stackOnBelow,
    collisions,
    conflicts,
    outOfBounds,
    patchTitleBlock,
    replaceScene,
  }
}
