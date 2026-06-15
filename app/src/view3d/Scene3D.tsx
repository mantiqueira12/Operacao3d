/* Vista 3D do espaço (Three.js, imperativo). Lê a mesma `RestaurantScene` do editor e renderiza
   a casca (piso + paredes a partir do polígono) e cada peça como volume à escala (width × height
   × depth), com material por arquétipo (`arch`). Câmera orbital. Mapa de eixos: plano (x,y) →
   mundo (x,z); altura → y (para cima). */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { levelOf } from '../domain'
import type { Arch3D, Item, RestaurantScene } from '../domain/types'
import { buildProp, createMaterials, type MatSet } from './props3d'

const WALL_H = 2.8
const WALL_T = 0.08

function polygonCenter(poly: Array<[number, number]>) {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, maxY: Math.max(...ys) }
}

function floorMesh(poly: Array<[number, number]>): THREE.Mesh {
  const shape = new THREE.Shape()
  poly.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  shape.closePath()
  const geo = new THREE.ShapeGeometry(shape)
  geo.rotateX(-Math.PI / 2) // plano XY → chão XZ (Y vira Z)
  const mat = new THREE.MeshStandardMaterial({ color: '#efe9db', roughness: 0.95, metalness: 0 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0
  mesh.receiveShadow = true
  return mesh
}

function wallsGroup(poly: Array<[number, number]>, transparent: boolean, frontMaxY: number): THREE.Group {
  const g = new THREE.Group()
  const solid = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.9, transparent, opacity: transparent ? 0.18 : 1 })
  const glass = new THREE.MeshStandardMaterial({ color: '#bcd3e0', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.14 })
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 1e-3) continue
    const isFront = Math.abs(y1 - frontMaxY) < 1e-3 && Math.abs(y2 - frontMaxY) < 1e-3 // vitrine/entrada → vidro
    const geo = new THREE.BoxGeometry(len, WALL_H, WALL_T)
    const mesh = new THREE.Mesh(geo, isFront ? glass : solid)
    mesh.position.set((x1 + x2) / 2, WALL_H / 2, (y1 + y2) / 2)
    mesh.rotation.y = Math.atan2(-dy, dx)
    g.add(mesh)
  }
  return g
}

/** Material por arquétipo (acabamento aproximado). */
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

/** Volume de uma peça: usa o builder paramétrico de `props3d` (geladeira, forno,
    vitrine, balcão…) e cai na caixa genérica por arquétipo só para tipos sem modelo
    dedicado. Correção do "tudo um blocos". */
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

export default function Scene3D({ scene, wallsTransparent, collisions }: { scene: RestaurantScene; wallsTransparent: boolean; collisions?: Set<string> }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const contentRef = useRef<THREE.Group | null>(null)

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
    sc.background = new THREE.Color('#e9e4d8')

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
    camera.position.set(3.6, 3.4, 4.6)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0.9, 0)
    controls.minDistance = 1.5
    controls.maxDistance = 16
    controls.maxPolarAngle = Math.PI / 2.05 // não passa por baixo do chão

    sc.add(new THREE.HemisphereLight(0xffffff, 0x9a9284, 0.85))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(4, 9, 6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -6
    key.shadow.camera.right = 6
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -6
    sc.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-5, 4, -3)
    sc.add(fill)

    const content = new THREE.Group()
    sc.add(content)

    rendererRef.current = renderer
    sceneRef.current = sc
    cameraRef.current = camera
    controlsRef.current = controls
    contentRef.current = content

    let raf = 0
    const loop = () => {
      controls.update()
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

  // (re)constrói o conteúdo quando a cena ou a opção de paredes muda
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    disposeGroup(content)
    content.clear()

    const { cx, cy, maxY } = polygonCenter(scene.room.polygon)
    content.position.set(-cx, 0, -cy) // centraliza a sala na origem

    content.add(floorMesh(scene.room.polygon))
    const grid = new THREE.GridHelper(12, 48, 0xcfc8b8, 0xe2dccd)
    grid.position.set(cx, 0.005, cy)
    content.add(grid)
    content.add(wallsGroup(scene.room.polygon, wallsTransparent, maxY))
    const mats = createMaterials()
    scene.items.forEach((it) => {
      content.add(itemObject(it, collisions?.has(it.id) ?? false, mats))
    })
  }, [scene, wallsTransparent, collisions])

  return <div ref={hostRef} className="scene3d-host" />
}
