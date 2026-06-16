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
  clearanceFor,
  createItem,
  getCatalogEntry,
  utilsFor,
} from './catalog'
export type { ClearanceKind, ClearanceMeta } from './catalog'

export { polygonArea } from './geometry'

export {
  CIRC_CRIT,
  CIRC_IDEAL,
  CIRC_MIN,
  GAP_BAD,
  GAP_WARN,
  TOUCH,
  TURN_CIRCLE,
  classifyCirc,
  classifyGap,
  clampToPolygon,
  clearances,
  collides,
  collisionPairs,
  collisionSet,
  complianceChecks,
  corridorAnalysis,
  dimsToNeighbors,
  footprintInside,
  isSolid,
  levelOf,
  outOfBoundsSet,
  overlapsInHeight,
  overlapsInPlane,
  pointInPolygon,
  stackTopBelow,
  topOf,
  workZones,
} from './spatial'
export type {
  Clearance,
  CollisionPair,
  ComplianceIssue,
  ComplianceSeverity,
  CorridorSeg,
  Dir,
  GapLevel,
  NeighborDim,
  Severity,
  WorkZone,
  WorkZoneKind,
} from './spatial'

export { equipmentSchedule, scheduleToCSV } from './schedule'
export type { ScheduleRow } from './schedule'

export { loja206Scene } from './templates/loja206'
