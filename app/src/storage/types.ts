/**
 * Contrato de persistência do Operacao3d.
 *
 * Cloud-ready: toda a API é assíncrona (Promise). No MVP o adapter concreto é
 * `LocalStorageAdapter` (custo-0, roda no cliente). Trocar para Supabase/D1 depois
 * é só implementar esta mesma interface — a UI não muda.
 */

/** Metadados de um projeto (sem o payload pesado). Usado em listagens. */
export interface ProjectMeta {
  id: string
  name: string
  /** ISO 8601 */
  createdAt: string
  /** ISO 8601 */
  updatedAt: string
}

/**
 * Projeto completo. `data` é o payload da cena (planta, catálogo, simulação).
 * Genérico de propósito: o modelo de domínio tipado entra no próximo passo da fila.
 */
export interface Project<TData = unknown> extends ProjectMeta {
  data: TData
}

/** Entrada de gravação. Sem `id` = cria; com `id` = atualiza. */
export interface SaveProjectInput<TData = unknown> {
  id?: string
  name: string
  data: TData
}

export interface StorageAdapter {
  /** Lista metadados de todos os projetos, mais recentes primeiro. */
  list(): Promise<ProjectMeta[]>
  /** Retorna o projeto completo ou `null` se não existir. */
  get<TData = unknown>(id: string): Promise<Project<TData> | null>
  /** Cria ou atualiza um projeto e retorna o estado persistido. */
  save<TData = unknown>(input: SaveProjectInput<TData>): Promise<Project<TData>>
  /** Remove um projeto. Idempotente: não falha se já não existir. */
  remove(id: string): Promise<void>
  /** Apaga todos os projetos deste namespace. */
  clear(): Promise<void>
}
