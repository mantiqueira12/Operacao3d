/* Malha de navegação + A* dos operadores, dentro da casca.
   Port fiel de sim-core.js (linhas 184-378). Encapsulado em classe. */

import { GATE, inShell, OUT, W } from './geometry'
import type { SceneItem, Station, Vec2 } from './types'

const NAV_CELL = 0.05
const MARGIN = 0.1
const DIRS: Array<[number, number, number]> = [
  [-1, 0, 1],
  [1, 0, 1],
  [0, -1, 1],
  [0, 1, 1],
  [-1, -1, 1.414],
  [-1, 1, 1.414],
  [1, -1, 1.414],
  [1, 1, 1.414],
]

interface HeapNode {
  gx: number
  gz: number
  f: number
}

class MinHeap {
  private d: HeapNode[] = []
  push(n: HeapNode) {
    this.d.push(n)
    this.up(this.d.length - 1)
  }
  pop(): HeapNode {
    const t = this.d[0]
    const l = this.d.pop() as HeapNode
    if (this.d.length > 0) {
      this.d[0] = l
      this.down(0)
    }
    return t
  }
  size() {
    return this.d.length
  }
  private up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.d[p].f <= this.d[i].f) break
      ;[this.d[p], this.d[i]] = [this.d[i], this.d[p]]
      i = p
    }
  }
  private down(i: number) {
    const n = this.d.length
    for (;;) {
      let s = i
      const l = 2 * i + 1
      const r = 2 * i + 2
      if (l < n && this.d[l].f < this.d[s].f) s = l
      if (r < n && this.d[r].f < this.d[s].f) s = r
      if (s === i) break
      ;[this.d[s], this.d[i]] = [this.d[i], this.d[s]]
      i = s
    }
  }
}

export class NavGrid {
  ngW = 0
  ngH = 0
  private grid: Uint8Array = new Uint8Array(0)
  private reach: Uint8Array | null = null
  private pathCache = new Map<string, Vec2[]>()

  w2gx(v: number) {
    return Math.max(0, Math.min(this.ngW - 1, Math.round(v / NAV_CELL)))
  }
  w2gy(v: number) {
    return Math.max(0, Math.min(this.ngH - 1, Math.round(v / NAV_CELL)))
  }
  g2w(g: number) {
    return g * NAV_CELL
  }
  gFree(gx: number, gz: number) {
    return gx >= 0 && gx < this.ngW && gz >= 0 && gz < this.ngH && this.grid[gx + gz * this.ngW] === 0
  }

  private markBlocked(x0: number, y0: number, x1: number, y1: number, m = MARGIN) {
    const gx0 = Math.max(0, Math.floor((x0 - m) / NAV_CELL))
    const gx1 = Math.min(this.ngW - 1, Math.ceil((x1 + m) / NAV_CELL))
    const gy0 = Math.max(0, Math.floor((y0 - m) / NAV_CELL))
    const gy1 = Math.min(this.ngH - 1, Math.ceil((y1 + m) / NAV_CELL))
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) this.grid[gx + gy * this.ngW] = 1
  }

  private unblock(x0: number, y0: number, x1: number, y1: number) {
    const gx0 = Math.max(0, Math.ceil(x0 / NAV_CELL))
    const gx1 = Math.min(this.ngW - 1, Math.floor(x1 / NAV_CELL))
    const gy0 = Math.max(0, Math.ceil(y0 / NAV_CELL))
    const gy1 = Math.min(this.ngH - 1, Math.floor(y1 / NAV_CELL))
    for (let gy = gy0; gy <= gy1; gy++)
      for (let gx = gx0; gx <= gx1; gx++) {
        if (inShell(gx * NAV_CELL, gy * NAV_CELL)) this.grid[gx + gy * this.ngW] = 0
      }
  }

  /** Constrói a malha, marca bloqueadores/mobiliário, calcula pontos de serviço e alcance. */
  build(blockers: SceneItem[], stations: Station[]) {
    this.ngW = Math.ceil(W / NAV_CELL) + 1
    this.ngH = Math.ceil(GATE / NAV_CELL) + 1
    this.grid = new Uint8Array(this.ngW * this.ngH)
    const BODY = 0.1
    for (let gy = 0; gy < this.ngH; gy++)
      for (let gx = 0; gx < this.ngW; gx++) {
        const x = gx * NAV_CELL
        const y = gy * NAV_CELL
        if (!inShell(x, y) || !inShell(x - BODY, y) || !inShell(x + BODY, y) || !inShell(x, y - BODY))
          this.grid[gx + gy * this.ngW] = 1
      }
    blockers.forEach((b) => this.markBlocked(b.x, b.y, b.x + b.w, b.y + b.h, 0.08))
    // vão da porta de correr do painel volta a ser passável
    blockers.forEach((b) => {
      if (b.t !== 'painel') return
      const horiz = b.w >= b.h
      const len = horiz ? b.w : b.h
      if (len < 1.1) return
      const d0 = 0.1 + 0.05
      const d1 = Math.min(0.9, len - 0.2) - 0.05
      if (d1 - d0 < 0.15) return
      if (horiz) this.unblock(b.x + d0, b.y - 0.1, b.x + d1, b.y + b.h + 0.1)
      else this.unblock(b.x - 0.1, b.y + d0, b.x + b.w + 0.1, b.y + d1)
    })
    stations.forEach((st) => this.markBlocked(st.x, st.y, st.x + st.w, st.y + st.h, MARGIN))
    this.pathCache.clear()
    stations.forEach((st) => (st.sp = this.servicePoint(st)))
    this.computeReach(stations)
  }

  private computeReach(stations: Station[]) {
    this.reach = new Uint8Array(this.ngW * this.ngH)
    let seed: { gx: number; gz: number } | null = null
    const tries: Array<[number, number]> = [
      [0.9, 1.5],
      [1.3, 4.0],
      [0.5, 2.5],
      [1.3, 0.5],
    ]
    for (let s = 0; s < tries.length && !seed; s++)
      seed = this.findNearFree(this.w2gx(tries[s][0]), this.w2gy(tries[s][1]), 12)
    if (!seed) return
    const stack = [seed.gx + seed.gz * this.ngW]
    this.reach[seed.gx + seed.gz * this.ngW] = 1
    while (stack.length) {
      const k = stack.pop() as number
      const gx = k % this.ngW
      const gz = (k / this.ngW) | 0
      const nb: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
      for (let n = 0; n < 4; n++) {
        const nx = gx + nb[n][0]
        const nz = gz + nb[n][1]
        if (!this.gFree(nx, nz)) continue
        const nk = nx + nz * this.ngW
        if (!this.reach[nk]) {
          this.reach[nk] = 1
          stack.push(nk)
        }
      }
    }
    stations.forEach((st) => {
      st.unreachable = !(st.sp && this.reach && this.reach[this.w2gx(st.sp.x) + this.w2gy(st.sp.y) * this.ngW])
    })
  }

  findNearFree(gx: number, gz: number, maxR: number): { gx: number; gz: number } | null {
    if (this.gFree(gx, gz)) return { gx, gz }
    for (let r = 1; r <= maxR; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
          if (this.gFree(gx + dx, gz + dz)) return { gx: gx + dx, gz: gz + dz }
        }
    return null
  }

  servicePoint(st: Station): Vec2 {
    const cands: Vec2[] = [
      { x: st.cx, y: st.y + st.h + 0.22 },
      { x: st.cx, y: st.y - 0.22 },
      { x: st.x - 0.22, y: st.cy },
      { x: st.x + st.w + 0.22, y: st.cy },
    ]
    for (const c of cands) {
      if (c.y > GATE - 0.1) continue
      const nf = this.findNearFree(this.w2gx(c.x), this.w2gy(c.y), 6)
      if (nf) {
        const px = this.g2w(nf.gx)
        const py = this.g2w(nf.gz)
        if (Math.hypot(px - c.x, py - c.y) < 0.3) return { x: px, y: py }
      }
    }
    const any = this.findNearFree(this.w2gx(st.cx), this.w2gy(st.cy), 24)
    return any ? { x: this.g2w(any.gx), y: this.g2w(any.gz) } : { x: st.cx, y: st.cy }
  }

  /** A* entre dois pontos do mundo. Retorna caminho parcial se o destino for inalcançável. */
  findPath(sx: number, sy: number, ex: number, ey: number): Vec2[] {
    if (!this.grid.length) return []
    const sgx = this.w2gx(sx)
    const sgz = this.w2gy(sy)
    const egx = this.w2gx(ex)
    const egz = this.w2gy(ey)
    const key = sgx + ',' + sgz + '>' + egx + ',' + egz
    const cached = this.pathCache.get(key)
    if (cached) return cached.slice()
    if (sgx === egx && sgz === egz) return [{ x: ex, y: ey }]
    const fs = this.findNearFree(sgx, sgz, 24)
    const fe = this.findNearFree(egx, egz, 24)
    if (!fs || !fe) return []
    const destFree = this.gFree(egx, egz)
    const open = new MinHeap()
    const gScore = new Map<number, number>()
    const from = new Map<number, number | undefined>()
    const closed = new Set<number>()
    const heur = (gx: number, gz: number) => {
      const dx = Math.abs(gx - fe.gx)
      const dz = Math.abs(gz - fe.gz)
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz)
    }
    const startKey = fs.gx * 10000 + fs.gz
    gScore.set(startKey, 0)
    from.set(startKey, undefined)
    open.push({ gx: fs.gx, gz: fs.gz, f: heur(fs.gx, fs.gz) })
    let iter = 0
    let bestKey = startKey
    let bestDist = heur(fs.gx, fs.gz)
    const rebuild = (endKey: number, snapEnd: boolean): Vec2[] => {
      const raw: number[] = []
      let k: number | undefined = endKey
      while (k !== undefined) {
        raw.push(k)
        k = from.get(k)
      }
      raw.reverse()
      const path: Vec2[] = []
      for (let i = 1; i < raw.length; i++) {
        const ggx = Math.floor(raw[i] / 10000)
        const ggz = raw[i] % 10000
        path.push({ x: this.g2w(ggx), y: this.g2w(ggz) })
      }
      if (snapEnd && destFree && path.length > 0) path[path.length - 1] = { x: ex, y: ey }
      return path
    }
    while (open.size() > 0 && iter < 9000) {
      iter++
      const cur = open.pop()
      const curKey = cur.gx * 10000 + cur.gz
      if (closed.has(curKey)) continue
      closed.add(curKey)
      const dh = heur(cur.gx, cur.gz)
      if (dh < bestDist) {
        bestDist = dh
        bestKey = curKey
      }
      if (cur.gx === fe.gx && cur.gz === fe.gz) {
        const p = rebuild(curKey, true)
        if (p.length > 0) {
          if (this.pathCache.size > 600) this.pathCache.clear()
          this.pathCache.set(key, p)
          return p.slice()
        }
      }
      const cg = gScore.get(curKey) as number
      for (let i = 0; i < DIRS.length; i++) {
        const dx = DIRS[i][0]
        const dz = DIRS[i][1]
        const cost = DIRS[i][2]
        const nx = cur.gx + dx
        const nz = cur.gz + dz
        if (!this.gFree(nx, nz)) continue
        if (dx !== 0 && dz !== 0 && (!this.gFree(cur.gx + dx, cur.gz) || !this.gFree(cur.gx, cur.gz + dz))) continue
        const nKey = nx * 10000 + nz
        if (closed.has(nKey)) continue
        const ng = cg + cost
        const prev = gScore.get(nKey)
        if (prev === undefined || ng < prev) {
          gScore.set(nKey, ng)
          from.set(nKey, curKey)
          open.push({ gx: nx, gz: nz, f: ng + heur(nx, nz) })
        }
      }
    }
    if (bestKey !== startKey) {
      const pb = rebuild(bestKey, false)
      if (pb.length > 0) return pb
    }
    if (this.pathCache.size > 600) this.pathCache.clear()
    this.pathCache.set(key, [])
    return []
  }

  pathLen(path: Vec2[], sx: number, sy: number): number {
    let L = 0
    let px = sx
    let py = sy
    for (const p of path) {
      L += Math.hypot(p.x - px, p.y - py)
      px = p.x
      py = p.y
    }
    return L
  }
}

/** Slots de fila e retirada na calçada. Port de computeSlots (linhas 359-378). */
export function computeSlots(stations: Station[]): { queueSlots: Vec2[]; pickupSlots: Vec2[] } {
  const queueSlots: Vec2[] = []
  const pickupSlots: Vec2[] = []
  const cx = stations.find((s) => s.type === 'caixa')
  const vt = stations.find((s) => s.type === 'vitrine')
  const qx0 = cx ? Math.max(OUT.x0 + 0.25, Math.min(cx.cx, W - 0.2)) : 0.4
  let row = 0
  let count = 0
  while (count < 40 && row < 4) {
    const y = GATE + 0.45 + row * 0.55
    const goingRight = row % 2 === 0
    let x = goingRight ? qx0 : OUT.x1 - 0.3
    while (count < 40) {
      if (goingRight ? x > OUT.x1 - 0.3 : x < qx0) break
      queueSlots.push({ x, y })
      x += goingRight ? 0.5 : -0.5
      count++
    }
    row++
  }
  const px0 = vt ? vt.cx - 0.55 : 1.1
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 5; i++) pickupSlots.push({ x: Math.max(OUT.x0 + 0.25, px0 + i * 0.45), y: GATE + 0.4 + r * 0.5 })
  return { queueSlots, pickupSlots }
}
