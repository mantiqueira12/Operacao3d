export type {
  Arch3D,
  CatalogEntry,
  Finishes,
  Item,
  ItemCategory,
  RestaurantScene,
  Room,
  TitleBlock,
} from './types'

export {
  CATALOG,
  CATEGORY_COLORS,
  catalogEntries,
  createItem,
  getCatalogEntry,
} from './catalog'

export { polygonArea } from './geometry'

export {
  GAP_BAD,
  GAP_WARN,
  TOUCH,
  classifyGap,
  clearances,
  collides,
  collisionPairs,
  collisionSet,
  isSolid,
  levelOf,
  overlapsInHeight,
  overlapsInPlane,
  stackTopBelow,
  topOf,
} from './spatial'
export type { Clearance, CollisionPair, Dir, GapLevel } from './spatial'

export { loja206Scene } from './templates/loja206'
