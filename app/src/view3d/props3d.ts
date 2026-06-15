/* =====================================================================
   props3d.ts — modelos 3D detalhados por equipamento (port de
   `prototype/planner/props.js` + o painel divisor de `sim/sim-3d.js`).

   Cada builder recebe (w, d, h) em metros e devolve um THREE.Group
   centrado em X/Z, apoiado no piso (y: 0..h). "Frente" = +Z.

   Substitui a caixa lisa única de Scene3D (`itemMesh`) — é a correção do
   "tudo um blocos" (backlog: 3d-props-builders-perdidos). Mantém o motor
   DES/domínio intactos: só a camada de apresentação 3D.

   Texturas procedurais são criadas UMA vez (cache de módulo) e
   reaproveitadas. Os materiais são criados por reconstrução de cena via
   `createMaterials()` — assim o `disposeGroup` de Scene3D pode descartá-los
   a cada rebuild sem invalidar as texturas em cache.
   ===================================================================== */
import * as THREE from 'three'

/* ---------- texturas procedurais (cache de módulo) ---------- */
type TexSet = { steel: THREE.Texture; wood: THREE.Texture; stone: THREE.Texture }
let _tex: TexSet | null = null

function makeTex(draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  if (ctx) draw(ctx, 128)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

function textures(): TexSet {
  if (_tex) return _tex
  const steel = makeTex((x, s) => {
    const g = x.createLinearGradient(0, 0, s, 0)
    g.addColorStop(0, '#cdd0d6')
    g.addColorStop(0.5, '#eef1f4')
    g.addColorStop(1, '#c7cad0')
    x.fillStyle = g
    x.fillRect(0, 0, s, s)
    x.globalAlpha = 0.06
    x.strokeStyle = '#5a6068'
    for (let i = 0; i < s; i += 2) {
      x.beginPath()
      x.moveTo(i, 0)
      x.lineTo(i, s)
      x.stroke()
    }
  })
  const wood = makeTex((x, s) => {
    x.fillStyle = '#b98a52'
    x.fillRect(0, 0, s, s)
    x.globalAlpha = 0.18
    x.strokeStyle = '#8a6038'
    x.lineWidth = 1
    for (let i = 0; i < 14; i++) {
      const y = Math.random() * s
      x.beginPath()
      x.moveTo(0, y)
      x.bezierCurveTo(s * 0.3, y + 4, s * 0.6, y - 4, s, y + 2)
      x.stroke()
    }
  })
  const stone = makeTex((x, s) => {
    x.fillStyle = '#ece8df'
    x.fillRect(0, 0, s, s)
    x.globalAlpha = 0.12
    for (let i = 0; i < 40; i++) {
      x.fillStyle = Math.random() > 0.5 ? '#cfc9ba' : '#d8d3c6'
      x.beginPath()
      x.arc(Math.random() * s, Math.random() * s, Math.random() * 5 + 1, 0, 7)
      x.fill()
    }
  })
  _tex = { steel, wood, stone }
  return _tex
}

/* ---------- materiais (um conjunto por rebuild de cena) ---------- */
export interface MatSet {
  steel: THREE.MeshPhongMaterial
  steelDark: THREE.MeshPhongMaterial
  black: THREE.MeshPhongMaterial
  wood: THREE.MeshPhongMaterial
  stone: THREE.MeshPhongMaterial
  rosso: THREE.MeshPhongMaterial
  rossoDark: THREE.MeshPhongMaterial
  glass: THREE.MeshPhongMaterial
  glowGlass: THREE.MeshPhongMaterial
  screen: THREE.MeshPhongMaterial
  shelf: THREE.MeshPhongMaterial
  white: THREE.MeshPhongMaterial
  rubber: THREE.MeshPhongMaterial
}

export function createMaterials(): MatSet {
  const t = textures()
  return {
    steel: new THREE.MeshPhongMaterial({ color: 0xeef1f4, map: t.steel, shininess: 78, specular: 0x555b63 }),
    steelDark: new THREE.MeshPhongMaterial({ color: 0x6b7078, map: t.steel, shininess: 60, specular: 0x33373c }),
    black: new THREE.MeshPhongMaterial({ color: 0x2b2d30, shininess: 30, specular: 0x222222 }),
    wood: new THREE.MeshPhongMaterial({ color: 0xc69a64, map: t.wood, shininess: 14 }),
    stone: new THREE.MeshPhongMaterial({ color: 0xece8df, map: t.stone, shininess: 24, specular: 0x888888 }),
    rosso: new THREE.MeshPhongMaterial({ color: 0xe2000f, shininess: 30, specular: 0x551111 }),
    rossoDark: new THREE.MeshPhongMaterial({ color: 0xb80714, shininess: 20 }),
    glass: new THREE.MeshPhongMaterial({ color: 0xcfe6ea, transparent: true, opacity: 0.3, shininess: 100, specular: 0xffffff }),
    glowGlass: new THREE.MeshPhongMaterial({ color: 0xe88a2a, transparent: true, opacity: 0.55, shininess: 80, emissive: 0x6a2c00, emissiveIntensity: 0.5 }),
    screen: new THREE.MeshPhongMaterial({ color: 0x121821, emissive: 0x16324a, emissiveIntensity: 0.4, shininess: 60 }),
    shelf: new THREE.MeshPhongMaterial({ color: 0xb9b0a0, shininess: 10 }),
    white: new THREE.MeshPhongMaterial({ color: 0xf3efe6, shininess: 18 }),
    rubber: new THREE.MeshPhongMaterial({ color: 0x3a3a3a, shininess: 8 }),
  }
}

/* ---------- helpers ---------- */
function box(w: number, h: number, d: number, m: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
}
function at(mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh {
  mesh.position.set(x, y, z)
  return mesh
}
function cyl(r1: number, r2: number, h: number, m: THREE.Material, seg = 20): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m)
}
function legs(g: THREE.Group, w: number, d: number, h: number, inset: number, thick: number, m: THREE.Material): void {
  const xs = [-w / 2 + inset, w / 2 - inset]
  const zs = [-d / 2 + inset, d / 2 - inset]
  xs.forEach((x) => zs.forEach((z) => g.add(at(box(thick, h, thick, m), x, h / 2, z))))
}
function bottles(g: THREE.Group, w: number, d: number, rows: number[]): void {
  const cols = [0xe2000f, 0xf2a23c, 0x2e9e5b, 0x2a6fdb, 0xead24a, 0xc0392b]
  rows.forEach((sy) => {
    const n = Math.max(3, Math.floor(w / 0.09))
    for (let i = 0; i < n; i++) {
      const m = new THREE.MeshPhongMaterial({ color: cols[(i + Math.round(sy * 10)) % cols.length], shininess: 60 })
      const b = cyl(0.028, 0.028, 0.16, m, 10)
      at(b, -w / 2 + 0.06 + (i * (w - 0.12)) / (n - 1 || 1), sy + 0.08, d * 0.1)
      g.add(b)
    }
  })
}
function counterBase(g: THREE.Group, w: number, d: number, h: number, m: MatSet, frontMat: THREE.Material): void {
  const baseH = h - 0.04
  g.add(at(box(w, baseH, d * 0.96, m.wood), 0, baseH / 2, 0))
  g.add(at(box(w + 0.05, 0.04, d + 0.05, m.stone), 0, h - 0.02, 0)) // tampo
  g.add(at(box(w, baseH, 0.02, frontMat), 0, baseH / 2, d / 2 - 0.005)) // frente
}
function prepTable(g: THREE.Group, w: number, d: number, h: number, m: MatSet): void {
  legs(g, w, d, h - 0.04, 0.05, 0.035, m.steel)
  g.add(at(box(w, 0.04, d, m.steel), 0, h - 0.02, 0)) // tampo
  g.add(at(box(w * 0.94, 0.03, d * 0.86, m.steel), 0, 0.16, 0)) // prateleira baixa
}

/* ---------- builders ---------- */
type Builder = (w: number, d: number, h: number, m: MatSet) => THREE.Group

const B: Record<string, Builder> = {
  geladeira(w, d, h, m) {
    const g = new THREE.Group()
    g.add(at(box(w, h, d, m.steel), 0, h / 2, 0))
    g.add(at(box(w + 0.004, 0.012, d + 0.004, m.steelDark), 0, h * 0.52, 0)) // vinco 2 portas
    g.add(at(box(0.04, h * 0.34, 0.05, m.steelDark), w / 2 - 0.1, h * 0.74, d / 2 + 0.01)) // puxadores
    g.add(at(box(0.04, h * 0.34, 0.05, m.steelDark), w / 2 - 0.1, h * 0.3, d / 2 + 0.01))
    g.add(at(box(w, 0.03, d, m.steelDark), 0, h - 0.015, 0)) // friso de topo
    return g
  },
  bibite(w, d, h, m) {
    const g = new THREE.Group()
    g.add(at(box(w, h, d, m.steel), 0, h / 2, 0))
    g.add(at(box(w + 0.01, 0.14, d + 0.01, m.rosso), 0, h - 0.07, 0)) // banner topo rosso
    g.add(at(box(w - 0.08, h - 0.3, d * 0.7, m.black), 0, (h - 0.18) / 2, -d * 0.05)) // nicho escuro
    bottles(g, w - 0.1, d, [0.12, 0.52, 0.92].filter((y) => y < h - 0.3))
    g.add(at(box(w - 0.05, h - 0.22, 0.02, m.glass), 0, (h - 0.18) / 2, d / 2 - 0.01)) // porta de vidro
    g.add(at(box(0.03, h * 0.4, 0.04, m.steelDark), w / 2 - 0.07, (h - 0.18) / 2, d / 2 + 0.01))
    return g
  },
  vitrine(w, d, h, m) {
    const g = new THREE.Group()
    const baseH = h * 0.55
    g.add(at(box(w, baseH, d, m.steel), 0, baseH / 2, 0))
    g.add(at(box(w, 0.03, d * 0.5, m.rosso), 0, 0.05, d / 2 - d * 0.25)) // friso rosso frente
    g.add(at(box(w, 0.03, d, m.stone), 0, baseH + 0.015, 0)) // tampo
    const foods = [0xe3b23c, 0xc0392b, 0xe9dcc0, 0x7bae5a]
    const n = Math.max(2, Math.floor(w / 0.4))
    for (let i = 0; i < n; i++) {
      const fm = new THREE.MeshPhongMaterial({ color: foods[i % foods.length], shininess: 24 })
      g.add(at(box((w - 0.1) / n - 0.04, 0.06, d * 0.5, fm), -w / 2 + (i + 0.5) * (w / n), baseH + 0.06, 0))
    }
    const gh = h - baseH
    const glass = box(w, gh, 0.02, m.glass) // vidro inclinado
    at(glass, 0, baseH + gh / 2, d / 2 - 0.02)
    glass.rotation.x = -0.32
    g.add(glass)
    g.add(at(box(w, 0.02, d * 0.6, m.glass), 0, h - 0.02, -d * 0.05)) // topo vidro
    g.add(at(box(0.02, gh * 0.8, d * 0.55, m.glass), -w / 2 + 0.01, baseH + gh * 0.45, 0))
    g.add(at(box(0.02, gh * 0.8, d * 0.55, m.glass), w / 2 - 0.01, baseH + gh * 0.45, 0))
    return g
  },
  batedeira(w, d, h, m) {
    const g = new THREE.Group()
    g.add(at(box(w * 0.92, h * 0.46, d * 0.92, m.steel), 0, h * 0.23, 0)) // base
    g.add(at(box(w * 0.7, 0.03, d * 0.7, m.steelDark), 0, h * 0.47, 0))
    const bowl = cyl(w * 0.3, w * 0.22, h * 0.3, m.steel, 20)
    at(bowl, 0, h * 0.3, d * 0.05)
    g.add(bowl)
    g.add(at(box(w * 0.18, h * 0.5, d * 0.22, m.black), -w * 0.3, h * 0.7, -d * 0.18)) // coluna
    g.add(at(box(w * 0.6, h * 0.16, d * 0.34, m.black), w * 0.02, h * 0.86, 0)) // cabeçote
    g.add(at(cyl(0.018, 0.018, h * 0.22, m.steelDark), w * 0.02, h * 0.62, d * 0.05)) // batedor
    return g
  },
  estufa(w, d, h, m) {
    const g = new THREE.Group()
    g.add(at(box(w, h, d, m.steel), 0, h / 2, 0)) // gabinete
    g.add(at(box(w * 0.86, h * 0.9, 0.02, m.steelDark), 0, h * 0.5, d / 2)) // moldura
    g.add(at(box(w * 0.66, h * 0.66, 0.02, m.glass), 0, h * 0.54, d / 2 + 0.012)) // janela
    ;[0.32, 0.5, 0.68].forEach((fr) => {
      g.add(at(box(w * 0.6, 0.015, d * 0.5, m.wood), 0, h * fr, d * 0.02)) // bandejas
    })
    g.add(at(box(0.035, h * 0.4, 0.05, m.steelDark), w * 0.4, h * 0.55, d / 2 + 0.02)) // puxador
    g.add(at(box(w * 0.5, 0.05, 0.02, m.glowGlass), 0, h * 0.93, d / 2 + 0.01)) // painel luz
    legs(g, w, d, 0.06, 0.05, 0.05, m.steelDark)
    return g
  },
  forno(w, d, h, m) {
    const g = new THREE.Group()
    legs(g, w, d, 0.18, 0.05, 0.05, m.steelDark)
    const bodyY = 0.18
    const bodyH = h - 0.18
    g.add(at(box(w, bodyH, d, m.black), 0, bodyY + bodyH / 2, 0))
    ;[0.3, 0.66].forEach((fr) => {
      const cy = bodyY + bodyH * fr
      g.add(at(box(w * 0.9, bodyH * 0.3, 0.03, m.steelDark), 0, cy, d / 2 + 0.005))
      g.add(at(box(w * 0.62, bodyH * 0.16, 0.02, m.glowGlass), 0, cy + 0.01, d / 2 + 0.02))
      g.add(at(box(w * 0.82, 0.035, 0.05, m.steel), 0, cy - bodyH * 0.17, d / 2 + 0.03)) // puxador
    })
    g.add(at(box(w, 0.04, d, m.steel), 0, h - 0.02, 0)) // topo
    g.add(at(cyl(0.05, 0.05, 0.18, m.steelDark), w * 0.3, h + 0.09, -d * 0.2)) // chaminé
    return g
  },
  balcao(w, d, h, m) {
    const g = new THREE.Group()
    counterBase(g, w, d, h, m, m.rosso)
    g.add(at(box(w * 0.9, 0.04, 0.04, m.steelDark), 0, 0.08, d / 2 + 0.04)) // descanso de pé
    g.add(at(box(w + 0.05, 0.015, d + 0.05, m.rossoDark), 0, h - 0.045, 0)) // friso superior
    return g
  },
  caixa(w, d, h, m) {
    const g = new THREE.Group()
    counterBase(g, w, d, h, m, m.rosso)
    g.add(at(box(0.06, 0.14, 0.06, m.black), 0, h + 0.07, -d * 0.05)) // suporte do monitor
    const scr = box(0.3, 0.22, 0.03, m.screen)
    at(scr, 0, h + 0.22, -d * 0.02)
    scr.rotation.x = 0.18
    g.add(scr)
    const frame = box(0.33, 0.25, 0.02, m.black)
    at(frame, 0, h + 0.22, -d * 0.03)
    frame.rotation.x = 0.18
    g.add(frame)
    g.add(at(box(w * 0.5, 0.06, d * 0.6, m.steelDark), 0, h - 0.1, d * 0.1)) // gaveta
    return g
  },
  prep(w, d, h, m) {
    const g = new THREE.Group()
    prepTable(g, w, d, h, m)
    g.add(at(box(w * 0.4, 0.03, d * 0.5, m.wood), 0, h + 0.005, 0)) // tábua de corte
    return g
  },
  montagem(w, d, h, m) {
    const g = new THREE.Group()
    prepTable(g, w, d, h, m)
    g.add(at(box(w, 0.12, 0.02, m.steel), 0, h + 0.06, -d / 2 + 0.02)) // anteparo traseiro
    return g
  },
  pia(w, d, h, m) {
    const g = new THREE.Group()
    prepTable(g, w, d, h, m)
    g.add(at(box(w * 0.55, 0.14, d * 0.6, m.steelDark), 0, h - 0.05, d * 0.02)) // cuba
    g.add(at(box(w * 0.48, 0.1, d * 0.5, m.black), 0, h - 0.03, d * 0.02))
    g.add(at(cyl(0.018, 0.018, 0.22, m.steelDark), 0, h + 0.1, -d / 2 + 0.1)) // torneira
    const spout = at(cyl(0.016, 0.016, 0.14, m.steelDark), 0, h + 0.2, -d / 2 + 0.16)
    spout.rotation.x = Math.PI / 2
    g.add(spout)
    return g
  },
  estoque(w, d, h, m) {
    const g = new THREE.Group()
    const xs = [-w / 2 + 0.03, w / 2 - 0.03]
    const zs = [-d / 2 + 0.03, d / 2 - 0.03]
    xs.forEach((x) => zs.forEach((z) => g.add(at(box(0.03, h, 0.03, m.steelDark), x, h / 2, z)))) // montantes
    const shelves = 4
    const crates = [0xc9a05a, 0xd8cdb6, 0xb7895a, 0xa9b0a0]
    for (let s = 0; s < shelves; s++) {
      const y = 0.18 + (s * (h - 0.2)) / (shelves - 1)
      g.add(at(box(w - 0.02, 0.025, d - 0.02, m.shelf), 0, y, 0))
      if (s < shelves - 1) {
        const cm = new THREE.MeshPhongMaterial({ color: crates[s % crates.length], shininess: 8 })
        g.add(at(box(w * 0.4, 0.16, d * 0.7, cm), -w * 0.22, y + 0.1, 0))
        g.add(at(box(w * 0.34, 0.14, d * 0.6, cm), w * 0.24, y + 0.09, 0))
      }
    }
    return g
  },
  apoio(w, d, h, m) {
    const g = new THREE.Group()
    legs(g, w, d, h - 0.03, 0.05, 0.04, m.steelDark)
    g.add(at(box(w, 0.03, d, m.wood), 0, h - 0.015, 0))
    return g
  },
  lixeira(w, d, h, m) {
    const g = new THREE.Group()
    const r = (Math.min(w, d) / 2) * 0.9
    g.add(at(cyl(r, r * 0.86, h * 0.9, m.steelDark, 18), 0, h * 0.45, 0))
    g.add(at(cyl(r * 1.05, r * 1.05, 0.04, m.steel, 18), 0, h * 0.9, 0))
    return g
  },
  extintor(w, d, h, m) {
    const g = new THREE.Group()
    const r = (Math.min(w, d) / 2) * 0.8
    g.add(at(cyl(r, r, h * 0.8, m.rosso, 16), 0, h * 0.42, 0))
    g.add(at(cyl(r * 0.5, r * 0.5, 0.06, m.black, 12), 0, h * 0.85, 0))
    g.add(at(box(0.05, 0.05, 0.04, m.black), 0, h * 0.92, r * 0.4))
    return g
  },
  porta(w, _d, h, m) {
    const g = new THREE.Group()
    g.add(at(box(0.06, h, _d, m.steelDark), -w / 2, h / 2, 0)) // marco esq
    g.add(at(box(0.06, h, _d, m.steelDark), w / 2, h / 2, 0)) // marco dir
    g.add(at(box(w + 0.06, 0.06, _d, m.steelDark), 0, h - 0.03, 0)) // verga
    const leaf = new THREE.Group()
    leaf.add(at(box(0.04, h - 0.06, w * 0.92, m.wood), 0, 0, w * 0.46)) // folha
    leaf.add(at(cyl(0.02, 0.02, 0.1, m.steel, 10), 0.03, 0, w * 0.86)) // maçaneta
    leaf.position.set(-w / 2, h / 2, 0)
    leaf.rotation.y = -0.5
    g.add(leaf)
    return g
  },
  wall(w, d, h) {
    const g = new THREE.Group()
    g.add(at(box(w, h, d, new THREE.MeshPhongMaterial({ color: 0xede7d7, shininess: 6 })), 0, h / 2, 0))
    return g
  },
  painel(w, d, h, m) {
    return buildPanel3D(w, d, h, m)
  },
}

/* ---------- painel divisor detalhado (port de sim-3d.js:buildPanel3D) ---------- */
let _logoTex: THREE.Texture | null = null
function logoTexture(): THREE.Texture {
  if (_logoTex) return _logoTex
  const lc = document.createElement('canvas')
  lc.width = 1024
  lc.height = 128
  const lx = lc.getContext('2d')
  if (lx) {
    lx.fillStyle = '#FFFFFF'
    lx.font = "italic 800 76px Bitter, Georgia, serif"
    lx.textAlign = 'center'
    lx.textBaseline = 'middle'
    lx.fillText("All'Antico Panino", 512, 68)
  }
  _logoTex = new THREE.CanvasTexture(lc)
  _logoTex.anisotropy = 8
  return _logoTex
}

function buildPanel3D(w: number, d: number, h: number, m: MatSet): THREE.Group {
  const horiz = w >= d
  const L = horiz ? w : d
  const T = horiz ? d : w
  const g = new THREE.Group()
  const add = (mesh: THREE.Mesh) => {
    g.add(mesh)
    return mesh
  }
  const BAND = 0.4
  const bodyH = h - BAND
  add(box(L, h, T * 0.5, new THREE.MeshPhongMaterial({ color: 0xd9d0bb, shininess: 8 }))).position.y = h / 2
  const d0 = -L / 2 + 0.1
  const d1 = -L / 2 + Math.min(0.9, L - 0.2)
  const dw = d1 - d0
  const hasDoor = L >= 1.1
  const slatW = 0.06
  const gap = 0.018
  const zFace = T * 0.25 + 0.012
  for (let x = -L / 2 + slatW / 2; x <= L / 2 - slatW / 2 + 0.001; x += slatW + gap) {
    if (hasDoor && x > d0 - slatW / 2 && x < d1 + slatW / 2) continue
    const tone = Math.round((x + L / 2) / (slatW + gap)) % 2 === 0 ? 0xc69a64 : 0xb98f5c
    const s = add(box(slatW, bodyH, 0.024, new THREE.MeshPhongMaterial({ color: tone, shininess: 12 })))
    s.position.set(x, bodyH / 2, zFace)
  }
  const band = add(box(L, BAND, T * 0.5 + 0.05, m.rosso))
  band.position.y = h - BAND / 2
  const letW = Math.min(1.7, L * 0.85)
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(letW, letW * 0.125),
    new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true }),
  )
  plane.position.set(0, h - BAND / 2, T * 0.25 + 0.032)
  g.add(plane)
  if (hasDoor) {
    const rec = add(box(dw, 2.1, T * 0.18, new THREE.MeshPhongMaterial({ color: 0x4a4438, shininess: 6 })))
    rec.position.set(d0 + dw / 2, 1.05, T * 0.16)
    const slide = 0.3
    const leaf = add(box(dw, 2.06, 0.035, new THREE.MeshPhongMaterial({ color: 0x8a6a44, shininess: 12 })))
    leaf.position.set(d0 + dw / 2 + slide, 1.03, zFace + 0.03)
    const trackLen = dw * 2.2
    const track = add(box(trackLen, 0.06, 0.05, m.black))
    track.position.set(d0 + trackLen / 2, 2.16, zFace + 0.03)
  }
  if (!horiz) g.rotation.y = Math.PI / 2
  return g
}

/* ---------- fábrica pública ---------- */
/**
 * Constrói o volume 3D detalhado de um equipamento pelo `type`. Devolve um
 * THREE.Group centrado em X/Z, apoiado no piso (y: 0..h), frente = +Z — pronto
 * para `position.set(x + w/2, level, y + depth/2)`. Retorna `null` para tipos
 * sem builder dedicado (o chamador desenha a caixa genérica de fallback).
 */
export function buildProp(
  type: string,
  w: number,
  d: number,
  h: number,
  m: MatSet,
  opts?: { doorFlip?: boolean },
): THREE.Group | null {
  const fn = B[type]
  if (!fn) return null
  const g = fn(w, d, h, m)
  if (type === 'porta' && opts?.doorFlip) g.scale.x = -1 // inverte a dobradiça
  g.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })
  return g
}
