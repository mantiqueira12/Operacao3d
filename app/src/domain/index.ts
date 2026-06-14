export type {
  Arch3D,
  CatalogEntry,
  Finishes,
  Item,
  ItemCategory,
  RestaurantScene,
  Room,
  TitleBlock,
  UtilityTag,
} from './types'

export {
  CATALOG,
  CATEGORY_COLORS,
  UTILITY_META,
  catalogEntries,
  createItem,
  getCatalogEntry,
  utilsFor,
} from './catalog'

export { polygonArea } from './geometry'

export {
  GAP_BAD,
  GAP_WARN,
  TOUCH,
  classifyGap,
  clampToPolygon,
  clearances,
  collides,
  collisionPairs,
  collisionSet,
  footprintInside,
  isSolid,
  levelOf,
  outOfBoundsSet,
  overlapsInHeight,
  overlapsInPlane,
  pointInPolygon,
  stackTopBelow,
  topOf,
} from './spatial'
export type { Clearance, CollisionPair, Dir, GapLevel } from './spatial'

export { equipmentSchedule, scheduleToCSV } from './schedule'
export type { ScheduleRow } from './schedule'

export { loja206Scene } from './templates/loja206'
