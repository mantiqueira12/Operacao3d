import { useEffect, useState } from 'react'
import type { Arch3D, CatalogEntry } from '../domain'
import { ARCHETYPES, ZONE_SWATCHES, colorToCategory, newCustomType } from './customModels'

const fmt = (n: number) => n.toFixed(2).replace('.', ',')
const parse = (s: string) => parseFloat(s.replace(',', '.'))

export interface EquipmentDraft {
  name: string
  width: number
  depth: number
  height: number
  arch: Arch3D
  color: string
}

/**
 * Modal "Criar equipamento" — nome, dimensões, arquétipo (segmented) e cor (swatches
 * rotuladas), com preview SVG ao vivo. Portado de openModal/createFromModal/drawPreview
 * do protótipo (planner.js:851-896). Devolve um CatalogEntry pronto para registrar.
 */
export default function EquipmentModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (entry: CatalogEntry) => void
}) {
  const [name, setName] = useState('')
  const [w, setW] = useState('1,00')
  const [d, setD] = useState('0,60')
  const [h, setH] = useState('0,90')
  const [arch, setArch] = useState<Arch3D>('box')
  const [color, setColor] = useState('#E2000F')

  // Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const wv = Math.max(0.05, parse(w) || 1)
  const dv = Math.max(0.05, parse(d) || 0.6)
  const hv = Math.max(0.05, parse(h) || 0.9)

  // preview SVG (drawPreview do protótipo): rect proporcional + barra de cor + cota
  const sc = Math.min(150 / wv, 60 / hv, 95)
  const rw = Math.max(14, wv * sc)
  const rh = Math.max(10, hv * sc)
  const top = 64 - rh + 6

  function submit() {
    const entry: CatalogEntry = {
      type: newCustomType(),
      name: (name || 'Equipamento').trim(),
      category: colorToCategory(color),
      width: wv,
      depth: dv,
      height: hv,
      color,
      arch,
    }
    onCreate(entry)
  }

  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Criar equipamento">
        <div className="modal-head">
          <h2>Criar equipamento</h2>
          <button className="modal-x" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <p className="modal-sub">
          Defina um equipamento sob medida. Ele entra em <b>Meus modelos</b> e pode ser inserido
          na planta como qualquer peça do catálogo.
        </p>
        <div className="modal-body">
          <div className="field name">
            <label>Nome</label>
            <input
              value={name}
              autoFocus
              placeholder="ex.: Char-broiler 2 bocas"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            />
          </div>
          <div className="grid3">
            <div className="field"><label>Largura</label><div className="unit"><input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /></div></div>
            <div className="field"><label>Profund.</label><div className="unit"><input inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} /></div></div>
            <div className="field"><label>Altura</label><div className="unit"><input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /></div></div>
          </div>
          <div className="field">
            <label>Volume 3D (arquétipo)</label>
            <div className="seg" id="m-arch">
              {ARCHETYPES.map((a) => (
                <button
                  key={a.value}
                  className={`segb${arch === a.value ? ' active' : ''}`}
                  onClick={() => setArch(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Zona / cor</label>
            <div className="swatches big">
              {ZONE_SWATCHES.map((s) => (
                <button
                  key={s.color + s.label}
                  className={`swatch${color === s.color ? ' active' : ''}`}
                  style={{ background: s.color }}
                  data-col={s.color}
                  onClick={() => setColor(s.color)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="modal-preview">
            <svg width={rw + 128} height={78}>
              <line x1={10} y1={70} x2={rw + 10} y2={70} stroke="#D9D3C4" strokeWidth={1} />
              <rect x={10} y={top} width={rw} height={rh} rx={2} fill="#fff" stroke="#1A1A1A" strokeWidth={1.4} />
              <rect x={10} y={top} width={rw} height={4} fill={color} />
              <text x={rw + 24} y={34} fontFamily="var(--mono, 'IBM Plex Mono', monospace)" fontSize={12} fill="#1A1A1A">{fmt(wv)} × {fmt(dv)} m</text>
              <text x={rw + 24} y={52} fontFamily="var(--mono, 'IBM Plex Mono', monospace)" fontSize={10} fill="#9A9284">alt. {fmt(hv)} m · {arch}</text>
            </svg>
          </div>
        </div>
        <div className="modal-foot">
          <button className="pbtn" onClick={onClose}>Cancelar</button>
          <button className="pbtn primary" onClick={submit}>Criar e inserir</button>
        </div>
      </div>
    </div>
  )
}
