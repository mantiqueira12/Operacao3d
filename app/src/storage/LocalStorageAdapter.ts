import type {
  Project,
  ProjectMeta,
  SaveProjectInput,
  StorageAdapter,
} from './types'

/**
 * Persistência em `localStorage` (MVP custo-0).
 *
 * Layout de chaves (espelha um KV de nuvem, facilitando a migração):
 *   {ns}:index            → ProjectMeta[] (ordenado por updatedAt desc)
 *   {ns}:project:{id}     → Project completo (JSON)
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly ns: string
  private readonly store: Storage

  constructor(namespace = 'operacao3d', store: Storage = globalThis.localStorage) {
    if (!store) {
      throw new Error('localStorage indisponível neste ambiente.')
    }
    this.ns = namespace
    this.store = store
  }

  private indexKey(): string {
    return `${this.ns}:index`
  }

  private projectKey(id: string): string {
    return `${this.ns}:project:${id}`
  }

  private readIndex(): ProjectMeta[] {
    const raw = this.store.getItem(this.indexKey())
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as ProjectMeta[]) : []
    } catch {
      return []
    }
  }

  private writeIndex(metas: ProjectMeta[]): void {
    const sorted = [...metas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    this.store.setItem(this.indexKey(), JSON.stringify(sorted))
  }

  list(): Promise<ProjectMeta[]> {
    return Promise.resolve(this.readIndex())
  }

  get<TData = unknown>(id: string): Promise<Project<TData> | null> {
    const raw = this.store.getItem(this.projectKey(id))
    if (!raw) return Promise.resolve(null)
    try {
      return Promise.resolve(JSON.parse(raw) as Project<TData>)
    } catch {
      return Promise.resolve(null)
    }
  }

  save<TData = unknown>(input: SaveProjectInput<TData>): Promise<Project<TData>> {
    const now = new Date().toISOString()
    const index = this.readIndex()
    const existing = input.id ? index.find((m) => m.id === input.id) : undefined

    const project: Project<TData> = {
      id: input.id ?? crypto.randomUUID(),
      name: input.name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      data: input.data,
    }

    this.store.setItem(this.projectKey(project.id), JSON.stringify(project))

    const meta: ProjectMeta = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }
    const nextIndex = index.filter((m) => m.id !== project.id)
    nextIndex.push(meta)
    this.writeIndex(nextIndex)

    return Promise.resolve(project)
  }

  remove(id: string): Promise<void> {
    this.store.removeItem(this.projectKey(id))
    this.writeIndex(this.readIndex().filter((m) => m.id !== id))
    return Promise.resolve()
  }

  clear(): Promise<void> {
    for (const meta of this.readIndex()) {
      this.store.removeItem(this.projectKey(meta.id))
    }
    this.store.removeItem(this.indexKey())
    return Promise.resolve()
  }
}
