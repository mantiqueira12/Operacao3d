/**
 * Modelo de domínio do estúdio de planta, portado do protótipo (`prototype/planner`).
 *
 * Convenção de unidades: metros. Eixos x (largura) e y (profundidade) no plano.
 * Nomes desambiguados em relação ao protótipo:
 *   w  → width   (largura no plano)
 *   h  → depth   (profundidade no plano)
 *   hz → height  (altura vertical, usada no 3D)
 */

export type ItemCategory = 'atendimento' | 'cozinha' | 'gerais' | 'estrutura'

/** Arquétipo de volume para a renderização 3D. */
export type Arch3D = 'box' | 'counter' | 'fridge' | 'shelf' | 'panel' | 'appliance'

/** Definição de um tipo de peça no catálogo (paramétrica, reutilizável). */
export interface CatalogEntry {
  /** chave do tipo (ex.: "forno") */
  type: string
  /** rótulo exibido */
  name: string
  category: ItemCategory
  /** dimensões padrão em metros */
  width: number
  depth: number
  height: number
  /** cor (hex) — padrão deriva da categoria */
  color: string
  arch?: Arch3D
}

/** Peça posicionada na cena. */
export interface Item {
  id: string
  type: string
  name: string
  /** canto superior esquerdo, em metros */
  x: number
  y: number
  /** dimensões no plano, em metros */
  width: number
  depth: number
  /** altura vertical (3D), em metros */
  height: number
  /**
   * elevação da base acima do piso (m). 0 = no chão. Permite empilhar peças
   * (uma sobre a outra) e posicionar em prateleira. A peça ocupa a faixa vertical
   * [level, level + height]; duas peças só colidem se as faixas verticais se cruzam.
   */
  level?: number
  color: string
  arch?: Arch3D | null
}

/** Casca/perímetro do espaço. Por-projeto — nada de geometria hardcoded no motor. */
export interface Room {
  /** polígono interno em metros, lista de vértices [x, y] */
  polygon: Array<[number, number]>
  /** área oficial rotulada (m²); pode diferir da geométrica */
  labeledAreaM2?: number
  /** profundidade do FOH (frente para o cliente), em metros */
  fohDepth?: number
}

export interface Finishes {
  floor: string
  wall: string
}

/** Carimbo do projeto (legenda técnica). */
export interface TitleBlock {
  project: string
  unit: string
  address: string
  responsible: string
  dateRev: string
}

/**
 * Cena completa de um projeto. É o payload `data` persistido via `StorageAdapter`
 * (`Project<RestaurantScene>`).
 */
export interface RestaurantScene {
  room: Room
  items: Item[]
  finishes?: Finishes
  titleBlock?: TitleBlock
  /** grade de encaixe (m) */
  snap?: number
}
