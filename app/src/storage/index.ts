import { LocalStorageAdapter } from './LocalStorageAdapter'
import type { StorageAdapter } from './types'

export type {
  Project,
  ProjectMeta,
  SaveProjectInput,
  StorageAdapter,
} from './types'
export { LocalStorageAdapter } from './LocalStorageAdapter'

/**
 * Adapter padrão da aplicação. Hoje aponta para `localStorage` (custo-0).
 * Para migrar à nuvem, troque só esta função por outro adapter.
 */
export function createStorage(): StorageAdapter {
  return new LocalStorageAdapter()
}
