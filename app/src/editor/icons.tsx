import type { CatalogEntry } from '../domain'

/** Ícone de barra de ferramentas (paths do protótipo). */
const PATHS: Record<string, string> = {
  select: 'M4 3l7 17 2.5-6.5L20 11 4 3z',
  measure: 'M3 17L17 3l4 4L7 21z M7 13l2 2M11 9l2 2M15 5l2 2',
  wall: 'M3 9h18M3 15h18M7 3v6M14 9v6M18 15v6M10 15v6',
  divisor: 'M3 12h18M5 6h14M5 18h14',
  room: 'M4 4h16v16H4z M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4',
  play: 'M5 3l14 9-14 9V3z',
  cube: 'M12 2l9 5v10l-9 5-9-5V7z M12 2v20M3 7l9 5 9-5',
  export: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  import: 'M12 15V3M7 8l5-5 5 5M4 21h16',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z',
  rotate: 'M21 12a9 9 0 1 1-3-6.7M21 3v5h-5',
  dup: 'M9 9h11v11H9z M5 15V5a2 2 0 0 1 2-2h10',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
  redo: 'M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8',
}

export function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      {PATHS[name].split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={'M' + seg} />
      ))}
    </svg>
  )
}

/** Mini-glyph do item no catálogo (rect branco com barra colorida no topo). */
export function CatalogGlyph({ entry }: { entry: CatalogEntry }) {
  const W = 36
  const H = 24
  const mw = 30
  const mh = 18
  const sc = Math.min(mw / entry.width, mh / entry.depth, 22)
  const w = entry.width * sc
  const h = entry.depth * sc
  const x = (W - w) / 2
  const y = (H - h) / 2

  if (entry.type === 'porta') {
    // batente + folha + arco tracejado (planner.js:773)
    return (
      <svg width={W} height={H}>
        <path d="M4,18 L4,6" stroke={entry.color} strokeWidth={1.4} fill="none" />
        <path d="M4,6 A12,12 0 0 1 16,18" fill="none" stroke={entry.color} strokeWidth={1} strokeDasharray="3 2" />
        <line x1={4} y1={18} x2={16} y2={18} stroke={entry.color} strokeWidth={1.4} />
      </svg>
    )
  }
  if (entry.type === 'painel' || entry.type === 'wall') {
    // barra bege com hachura diagonal (planner.js:772)
    return (
      <svg width={W} height={H}>
        <rect x={x} y={H / 2 - 3} width={w} height={6} fill="#EDE7D7" stroke="#1A1A1A" strokeWidth={1} />
        <line x1={x + 3} y1={H / 2 + 3} x2={x + 9} y2={H / 2 - 3} stroke="#1A1A1A" strokeWidth={0.6} />
        <line x1={x + 11} y1={H / 2 + 3} x2={x + 17} y2={H / 2 - 3} stroke="#1A1A1A" strokeWidth={0.6} />
        <line x1={x + 19} y1={H / 2 + 3} x2={x + 25} y2={H / 2 - 3} stroke="#1A1A1A" strokeWidth={0.6} />
      </svg>
    )
  }
  return (
    <svg width={W} height={H}>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="#fff" stroke="#1A1A1A" strokeWidth={1.2} />
      <rect x={x} y={y} width={w} height={3} fill={entry.color} />
    </svg>
  )
}
