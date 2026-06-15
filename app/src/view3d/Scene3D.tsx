/* Vista 3D do espaço (Three.js, imperativo). Lê a mesma `RestaurantScene` do editor e renderiza
   a casca (piso texturizado + paredes a partir do polígono, portão de enrolar na frente) e cada
   peça como volume detalhado (props3d). Câmera orbital com efeito "dollhouse" (esconde as paredes
   viradas para a câmera). Mapa de eixos: plano (x,y) → mundo (x,z); altura → y (para cima). */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { levelOf } from '../domain'
import type { Arch3D, Item, RestaurantScene } from '../domain/types'
import {
  buildProp,
  createMaterials,
  makeFloorTex,
  WALL_FIN,
  FLOOR_PERIOD,
  type FloorKind,
  type WallKind,
  type MatSet,
} from './props3d'

const WALL_H = 2.8
const WALL_T = 0.12 // parede grossa (paridade com sim-3d: WALL_T 0.12)

/** Presets de ponto de vista expostos via ref. */
export type CamPreset = 'iso' | 'top' | 'cliente' | 'balcao'

/** Acabamentos atuais (piso/parede) — controlados pelo React. */
export interface Finish3D {
  floor: FloorKind
  wall: WallKind
}

export interface Scene3DHandle {
  applyPreset: (name: CamPreset) => void
}

interface Scene3DProps {
  scene: RestaurantScene
  wallsTransparent: boolean
  /** efeito dollhouse: esconde as paredes cuja face aponta para a câmera */
  cullWalls: boolean
  showGrid: boolean
  fog: boolean
  finish: Finish3D
  collisions?: Set<string>
}

function polygonCenter(poly: Array<[number, number]>) {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  return {
    cx: (Math.min(...xs) + Math.max(...xs)) / 2,
    cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

function floorMesh(poly: Array<[number, number]>, floor: FloorKind): THREE.Mesh {
  const shape = new THREE.Shape()
  poly.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  shape.closePath()
  const geo = new THREE.ShapeGeometry(shape)
  geo.rotateX(-Math.PI / 2) // plano XY → chão XZ (Y vira Z)
  const tex = makeFloorTex(floor)
  const repeat = 1 / FLOOR_PERIOD[floor]
  tex.repeat.set(repeat, repeat)
  const mat = new THREE.MeshLambertMaterial({ map: tex })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.001
  mesh.receiveShadow = true
  return mesh
}

/** Metadados de culling guardados por parede. */
interface WallData {
  nx: number
  nz: number
  cx: number
  cz: number
}

/** Casca: paredes grossas a partir do polígono, com a frente (maxY) aberta para a entrada.
    Cada parede carrega a normal apontando para fora (userData) para o dollhouse-cull. */
function wallsGroup(
  poly: Array<[number, number]>,
  transparent: boolean,
  frontMaxY: number,
  wall: WallKind,
  center: { cx: number; cy: number },
): { group: THREE.Group; walls: THREE.Mesh[] } {
  const g = new THREE.Group()
  const walls: THREE.Mesh[] = []
  const solid = new THREE.MeshLambertMaterial({
    color: WALL_FIN[wall] ?? WALL_FIN.panna,
    transparent,
    opacity: transparent ? 0.18 : 1,
  })
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 1e-3) continue
    // frente aberta (linha do portão): não levanta parede
    const isFront = Math.abs(y1 - frontMaxY) < 1e-3 && Math.abs(y2 - frontMaxY) < 1e-3
    if (isFront) continue
    const geo = new THREE.BoxGeometry(len, WALL_H, WALL_T)
    const mesh = new THREE.Mesh(geo, solid)
    const mcx = (x1 + x2) / 2
    const mcz = (y1 + y2) / 2
    mesh.position.set(mcx, WALL_H / 2, mcz)
    mesh.rotation.y = Math.atan2(-dy, dx)
    mesh.castShadow = true
    mesh.receiveShadow = true
    // normal apontando para fora da sala (em direção contrária ao centro)
    let nx = dy / len
    let nz = -dx / len
    if (nx * (mcx - center.cx) + nz * (mcz - center.cy) < 0) {
      nx = -nx
      nz = -nz
    }
    mesh.userData = { nx, nz, cx: mcx, cz: mcz } satisfies WallData
    walls.push(mesh)
    g.add(mesh)
  }
  return { group: g, walls }
}

/** Portão de enrolar recolhido na frente (caixa + 2 trilhos), port de sim-3d.js:118-125.
    Derivado da extensão em X da abertura frontal (linha do maxY). */
function gateGroup(poly: Array<[number, number]>, frontMaxY: number): THREE.Group {
  const g = new THREE.Group()
  // extensão em X dos vértices que tocam a frente
  const xsFront = poly.filter(([, y]) => Math.abs(y - frontMaxY) < 1e-3).map(([x]) => x)
  if (xsFront.length < 2) return g
  const x0 = Math.min(...xsFront)
  const x1 = Math.max(...xsFront)
  const span = x1 - x0
  const mx = (x0 + x1) / 2
  const mtl = new THREE.MeshPhongMaterial({ color: 0x707070, shininess: 30 })
  // caixa do tambor no alto
  const housing = new THREE.Mesh(new THREE.BoxGeometry(span, 0.32, 0.3), mtl)
  housing.position.set(mx, WALL_H - 0.16, frontMaxY)
  housing.castShadow = true
  g.add(housing)
  // trilhos laterais
  ;[x0 + 0.045, x1 - 0.045].forEach((x) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, WALL_H, 0.11), mtl)
    rail.position.set(x, WALL_H / 2, frontMaxY)
    rail.castShadow = true
    g.add(rail)
  })
  return g
}

/** Material por arquétipo (fallback de caixa genérica para tipos sem builder dedicado). */
function archMaterial(arch: Arch3D | null | undefined, color: string): THREE.MeshStandardMaterial {
  switch (arch) {
    case 'fridge':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.82 })
    case 'appliance':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 })
    case 'panel':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 })
    case 'counter':
      return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 })
    default:
      return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 })
  }
}

/** Volume de uma peça via fábrica de props detalhados, com fallback de caixa por arquétipo. */
function itemObject(it: Item, conflict: boolean, mats: MatSet): THREE.Object3D {
  const h = Math.max(0.05, it.height)
  const base = levelOf(it) // elevação da base (m): empilhamento / prateleira
  const cx = it.x + it.width / 2
  const cz = it.y + it.depth / 2

  const built = buildProp(it.type, it.width, it.depth, h, mats, { doorFlip: it.doorFlip })
  let obj: THREE.Object3D
  if (built) {
    built.position.set(cx, base, cz) // o grupo se apoia no piso (y: 0..h)
    obj = built
  } else {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(it.width, h, it.depth), archMaterial(it.arch, it.color))
    mesh.position.set(cx, base + h / 2, cz)
    mesh.castShadow = true
    obj = mesh
  }

  if (!conflict) return obj
  // conflito de colisão: envelope vermelho translúcido (não muta os materiais em cache)
  const env = new THREE.Mesh(
    new THREE.BoxGeometry(it.width * 1.03, h * 1.03, it.depth * 1.03),
    new THREE.MeshBasicMaterial({ color: '#E2000F', transparent: true, opacity: 0.3 }),
  )
  env.position.set(cx, base + h / 2, cz)
  const grp = new THREE.Group()
  grp.add(obj)
  grp.add(env)
  return grp
}

function disposeGroup(g: THREE.Group) {
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
}

const Scene3D = forwardRef<Scene3DHandle, Scene3DProps>(function Scene3D(
  { scene, wallsTransparent, cullWalls, showGrid, fog, finish, collisions },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const contentRef = useRef<THREE.Group | null>(null)
  // paredes do último rebuild + flags de culling lidas pelo loop sem recriar o loop
  const wallsRef = useRef<THREE.Mesh[]>([])
  const cullRef = useRef(cullWalls)
  const transpRef = useRef(wallsTransparent)
  // geometria da sala em coords de mundo (após offset de centralização) p/ presets:
  // centro (cx,cz) e o z da frente aberta (frontZ, perto do balcão)
  const roomRef = useRef({ cx: 0, cz: 0, frontZ: 2.5 })

  cullRef.current = cullWalls
  transpRef.current = wallsTransparent

  // aplica um preset de câmera (target + posição), espelhando sim-3d.js:preset
  const applyPreset = (name: CamPreset) => {
    const cam = cameraRef.current
    const ctrl = controlsRef.current
    if (!cam || !ctrl) return
    const { cx, cz, frontZ } = roomRef.current
    const spherical = (theta: number, phi: number, r: number) => {
      const st = Math.sin(phi) * r
      cam.position.set(
        ctrl.target.x + st * Math.cos(theta),
        ctrl.target.y + Math.cos(phi) * r,
        ctrl.target.z + st * Math.sin(theta),
      )
    }
    if (name === 'iso') {
      ctrl.target.set(cx, 0.4, cz + 0.6)
      spherical(-Math.PI * 0.62, 0.92, 7.0)
    } else if (name === 'top') {
      ctrl.target.set(cx, 0, cz + 0.7)
      spherical(-Math.PI / 2, 0.12, 6.8)
    } else if (name === 'cliente') {
      // olho do cliente: do lado de fora (calçada), olhando para o balcão na frente
      ctrl.target.set(cx, 1.1, frontZ - 0.7)
      spherical(Math.PI * 0.5, 1.18, 3.8)
    } else {
      // atrás do balcão, olhando para a frente/saída
      ctrl.target.set(cx, 1.0, frontZ - 0.9)
      spherical(-Math.PI * 0.5, 1.18, 3.4)
    }
    cam.lookAt(ctrl.target)
    ctrl.update()
  }

  useImperativeHandle(ref, () => ({ applyPreset }), [])

  // setup único (renderer, câmera, luzes, loop)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const w = host.clientWidth || 800
    const h = host.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setSize(w, h)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)

    const sc = new THREE.Scene()
    sc.background = new THREE.Color('#e6e1d5')

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
    camera.position.set(3.6, 3.4, 4.6)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0.9, 0)
    controls.minDistance = 1.5
    controls.maxDistance = 18
    controls.maxPolarAngle = Math.PI / 2.05 // não passa por baixo do chão

    // iluminação quente + neblina (port de sim-3d.js:357-373)
    sc.add(new THREE.HemisphereLight(0xffffff, 0xcfc8b6, 0.65))
    sc.add(new THREE.AmbientLight(0xffffff, 0.35))
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.0) // levemente quente
    sun.position.set(5, 9, 3)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -6
    sun.shadow.camera.right = 6
    sun.shadow.camera.top = 8
    sun.shadow.camera.bottom = -6
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 40
    sun.shadow.bias = -0.0004
    sc.add(sun)

    const content = new THREE.Group()
    sc.add(content)

    rendererRef.current = renderer
    sceneRef.current = sc
    cameraRef.current = camera
    controlsRef.current = controls
    contentRef.current = content

    // dollhouse: esconde por frame as paredes cuja face aponta para a câmera (port de cullWalls)
    const applyCull = () => {
      const cp = camera.position
      wallsRef.current.forEach((wm) => {
        const u = wm.userData as WallData
        if (transpRef.current) {
          wm.visible = true
          return
        }
        if (!cullRef.current) {
          wm.visible = true
          return
        }
        const facing = u.nx * (cp.x - u.cx) + u.nz * (cp.z - u.cz)
        wm.visible = facing < 0.15
      })
    }

    let raf = 0
    const loop = () => {
      controls.update()
      applyCull()
      renderer.render(sc, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => {
      const cw = host.clientWidth || 1
      const ch = host.clientHeight || 1
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      renderer.setSize(cw, ch)
    })
    ro.observe(host)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      disposeGroup(content)
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
      rendererRef.current = null
    }
  }, [])

  // fog: liga/desliga sem recriar a cena (cor casa com o background)
  useEffect(() => {
    const sc = sceneRef.current
    if (!sc) return
    sc.fog = fog ? new THREE.Fog(0xe6e1d5, 14, 32) : null
  }, [fog])

  // (re)constrói o conteúdo quando a cena, paredes ou acabamentos mudam
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    disposeGroup(content)
    content.clear()

    const { cx, cy, maxY } = polygonCenter(scene.room.polygon)
    content.position.set(-cx, 0, -cy) // centraliza a sala na origem
    // centro em coords de mundo (já centralizado); frontZ = z da abertura frontal
    roomRef.current = { cx: 0, cz: 0, frontZ: maxY - cy }

    content.add(floorMesh(scene.room.polygon, finish.floor))

    if (showGrid) {
      const grid = new THREE.GridHelper(12, 48, 0xcfc8b8, 0xe2dccd)
      grid.position.set(cx, 0.006, cy)
      content.add(grid)
    }

    const { group: walls, walls: wallMeshes } = wallsGroup(
      scene.room.polygon,
      wallsTransparent,
      maxY,
      finish.wall,
      { cx, cy },
    )
    content.add(walls)
    wallsRef.current = wallMeshes

    content.add(gateGroup(scene.room.polygon, maxY))

    const mats = createMaterials()
    scene.items.forEach((it) => {
      content.add(itemObject(it, collisions?.has(it.id) ?? false, mats))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, wallsTransparent, showGrid, finish.floor, finish.wall, collisions])

  return <div ref={hostRef} className="scene3d-host" />
})

export default Scene3D
