// Shared domain constants for unit statuses and downtime action identifiers.

export const UNIT_STATUS = {
  OPERATIONAL: 'Operational',
  DAMAGED: 'Damaged',
  DISABLED: 'Disabled',
  DESTROYED: 'Destroyed',
  REPAIRING: 'Repairing',
  UNAVAILABLE: 'Unavailable',
};

const STATUS_TO_BADGE_VARIANT = {
  [UNIT_STATUS.OPERATIONAL]: 'operational',
  [UNIT_STATUS.DAMAGED]: 'damaged',
  [UNIT_STATUS.DISABLED]: 'disabled',
  [UNIT_STATUS.DESTROYED]: 'destroyed',
  [UNIT_STATUS.REPAIRING]: 'repairing',
  [UNIT_STATUS.UNAVAILABLE]: 'disabled',
};

/**
 * Map a domain status value to a Badge visual variant.
 * Falls back to 'outline' for unknown values.
 */
export function getStatusBadgeVariant(status) {
  return STATUS_TO_BADGE_VARIANT[status] || 'outline';
}

// Downtime action identifiers as used in data/downtime-actions.json.
export const DOWNTIME_ACTION_IDS = {
  REPAIR_ARMOR: 'repair-armor',
  REPAIR_STRUCTURE: 'repair-structure',
  RECONFIGURE: 'reconfigure',
  REPAIR_ELEMENTAL: 'repair-elemental',
  PURCHASE_ELEMENTAL: 'purchase-elemental',
  TRAIN_GUNNERY: 'train-gunnery',
  TRAIN_PILOTING: 'train-piloting',
  HEAL_INJURY: 'heal-injury',
};
