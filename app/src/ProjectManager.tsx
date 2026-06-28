/**
 * ProjectManager — tela de entrada (full-screen) para gerenciar projetos.
 *
 * Componente 100% apresentacional: não toca em storage nem em estado global. Toda a persistência
 * (criar/abrir/renomear/excluir/duplicar) é delegada ao chamador via callbacks. A lista chega
 * pronta e já ordenada (updatedAt desc) de fora.
 */

import { useRef, useState } from 'react'
import type { ProjectMeta } from './storage/types'
import './ProjectManager.css'

type Template = 'blank' | 'loja206'

export interface ProjectManagerProps {
  /** Já ordenado por updatedAt desc pelo chamador. */
  projects: ProjectMeta[]
  currentId: string | null
  onOpen: (id: string) => void
  onCreate: (template: 'blank' | 'loja206', name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onExport: (id: string) => void
  onImport: (file: File) => void
  onClose: () => void
}

const TEMPLATES: { value: Template; label: string }[] = [
  { value: 'blank', label: 'Em branco' },
  { value: 'loja206', label: 'Loja 206 (modelo)' },
]

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR')

export default function ProjectManager({
  projects,
  currentId,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onExport,
  onImport,
  onClose,
}: ProjectManagerProps) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<Template>('blank')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    onCreate(template, name.trim() || 'Novo restaurante')
    setName('')
  }

  const handleRename = (project: ProjectMeta) => {
    const next = window.prompt('Novo nome', project.name)
    if (next === null) return
    const trimmed = next.trim()
    if (trimmed && trimmed !== project.name) onRename(project.id, trimmed)
  }

  const handleDelete = (project: ProjectMeta) => {
    if (window.confirm('Excluir "' + project.name + '"? Esta ação não pode ser desfeita.')) {
      onDelete(project.id)
    }
  }

  return (
    <div className="pm-screen">
      <div className="pm-shell">
        <header className="pm-head">
          <div className="pm-brand">
            <h1 className="pm-title">Projetos</h1>
            <p className="pm-subtitle">Operação 3D — arquitetura de restaurantes</p>
          </div>
          {currentId !== null && (
            <button type="button" className="pm-close" onClick={onClose} aria-label="Fechar">
              <span aria-hidden="true">×</span> Fechar
            </button>
          )}
        </header>

        <section className="pm-create" aria-label="Novo projeto">
          <h2 className="pm-section-title">Novo projeto</h2>
          <div className="pm-create-row">
            <input
              type="text"
              className="pm-input"
              placeholder="Nome do restaurante"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
            />
            <div className="pm-segmented" role="radiogroup" aria-label="Modelo do projeto">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={template === t.value}
                  className={'pm-seg' + (template === t.value ? ' is-active' : '')}
                  onClick={() => setTemplate(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button type="button" className="pm-btn pm-btn-primary pm-create-btn" onClick={handleCreate}>
              Criar
            </button>
          </div>
          <div className="pm-create-aux">
            <button type="button" className="pm-btn" onClick={() => fileRef.current?.click()}>
              Importar projeto (.json)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImport(f)
                e.target.value = ''
              }}
            />
          </div>
        </section>

        <section className="pm-list-wrap" aria-label="Lista de projetos">
          <h2 className="pm-section-title">Projetos salvos</h2>
          {projects.length === 0 ? (
            <p className="pm-empty">Nenhum projeto ainda — crie o primeiro acima.</p>
          ) : (
            <ul className="pm-list">
              {projects.map((p) => {
                const isCurrent = p.id === currentId
                return (
                  <li key={p.id} className={'pm-row' + (isCurrent ? ' is-current' : '')}>
                    <button type="button" className="pm-row-main" onClick={() => onOpen(p.id)}>
                      <span className="pm-row-name">{p.name}</span>
                      <span className="pm-row-meta">
                        {isCurrent && <span className="pm-badge">● atual</span>}
                        <span className="pm-row-date">Atualizado em {formatDate(p.updatedAt)}</span>
                      </span>
                    </button>
                    <div className="pm-row-actions">
                      <button type="button" className="pm-btn pm-btn-primary" onClick={() => onOpen(p.id)}>
                        Abrir
                      </button>
                      <button type="button" className="pm-btn" onClick={() => onDuplicate(p.id)}>
                        Duplicar
                      </button>
                      <button type="button" className="pm-btn" onClick={() => onExport(p.id)}>
                        Exportar
                      </button>
                      <button type="button" className="pm-btn" onClick={() => handleRename(p)}>
                        Renomear
                      </button>
                      <button type="button" className="pm-btn pm-btn-danger" onClick={() => handleDelete(p)}>
                        Excluir
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
