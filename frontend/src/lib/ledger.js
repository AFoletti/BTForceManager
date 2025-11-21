// Shared ledger builder for in-app views and PDF export.
// This flattens all warchest-affecting actions across missions and unit
// activity logs into a single, chronologically ordered list.

import { formatNumber } from './utils';

/**
 * Build a flattened, chronologically ordered warchest ledger from a force.
 *
 * Each entry has the shape:
 *   {
 *     timestamp: string,
 *     sourceType: 'Mech' | 'Elemental' | 'Pilot' | 'Mission',
 *     unitName: string,
 *     description: string,
 *     cost: number,   // negative for spent, 0 otherwise
 *     gain: number    // positive for gained, 0 otherwise
 *   }
 *
 * This mirrors the logic originally implemented inside PDFExport, but is
 * shared so that both the PDF and the in-app Ledger tab use the exact same
 * behaviour.
 */
export function buildLedgerEntries(force) {
  if (!force || typeof force !== 'object') return [];

  const mechs = force.mechs || [];
  const pilots = force.pilots || [];
  const elementals = force.elementals || [];
  const missions = force.missions || [];

  const ledgerEntries = [];

  const pushCost = ({ timestamp, sourceType, unitName, description, cost }) => {
    if (!timestamp) return;
    const safeCost = typeof cost === 'number' && !Number.isNaN(cost) ? cost : 0;
    if (safeCost === 0) return;
    ledgerEntries.push({
      timestamp,
      sourceType,
      unitName,
      description,
      cost: -Math.abs(safeCost),
      gain: 0,
    });
  };

  const pushGain = ({ timestamp, sourceType, unitName, description, gain }) => {
    if (!timestamp) return;
    const safeGain = typeof gain === 'number' && !Number.isNaN(gain) ? gain : 0;
    if (safeGain === 0) return;
    ledgerEntries.push({
      timestamp,
      sourceType,
      unitName,
      description,
      cost: 0,
      gain: Math.abs(safeGain),
    });
  };

  // Mech activity costs (including downtime and "Other" unit-level actions)
  mechs.forEach((mech) => {
    (mech.activityLog || []).forEach((entry) => {
      if (typeof entry.cost === 'number' && entry.cost !== 0) {
        pushCost({
          timestamp: entry.inGameDate || entry.timestamp,
          sourceType: 'Mech',
          unitName: mech.name,
          description: entry.action,
          cost: entry.cost,
        });
      }
    });
  });

  // Elemental activity costs
  elementals.forEach((elemental) => {
    (elemental.activityLog || []).forEach((entry) => {
      if (typeof entry.cost === 'number' && entry.cost !== 0) {
        pushCost({
          timestamp: entry.inGameDate || entry.timestamp,
          sourceType: 'Elemental',
          unitName: elemental.name,
          description: entry.action,
          cost: entry.cost,
        });
      }
    });
  });

  // Pilot activity costs
  pilots.forEach((pilot) => {
    (pilot.activityLog || []).forEach((entry) => {
      if (typeof entry.cost === 'number' && entry.cost !== 0) {
        pushCost({
          timestamp: entry.inGameDate || entry.timestamp,
          sourceType: 'Pilot',
          unitName: pilot.name,
          description: entry.action,
          cost: entry.cost,
        });
      }
    });
  });

  // Mission costs and gains
  missions.forEach((mission) => {
    const missionTimestamp =
      mission.inGameDate || mission.completedAt || mission.createdAt || force.currentDate;

    const missionCost = mission.cost || 0;
    if (missionCost !== 0) {
      pushCost({
        timestamp: missionTimestamp,
        sourceType: 'Mission',
        unitName: mission.name || 'Mission',
        description: 'Track cost',
        cost: missionCost,
      });
    }

    const gain = mission.warchestGained || 0;
    if (gain !== 0) {
      pushGain({
        timestamp: missionTimestamp,
        sourceType: 'Mission',
        unitName: mission.name || 'Mission',
        description: 'Warchest points earned',
        gain,
      });
    }
  });

  // Sort ledger by timestamp (YYYY-MM-DD or ISO) oldest first.
  ledgerEntries.sort((a, b) => {
    const ta = a.timestamp || '';
    const tb = b.timestamp || '';
    return ta.localeCompare(tb);
  });

  return ledgerEntries;
}

/**
 * Helper to compute aggregate figures from a ledger.
 */
export function summariseLedger(ledgerEntries, currentWarchest, startingWarchest) {
  const totalSpent = ledgerEntries.reduce((sum, e) => sum + Math.min(e.cost, 0), 0);
  const totalGained = ledgerEntries.reduce((sum, e) => sum + Math.max(e.gain, 0), 0);

  return {
    totalSpent,
    totalGained,
    net: totalGained + totalSpent,
    currentWarchest,
    startingWarchest,
    formatted: {
      totalSpent: `-${formatNumber(Math.abs(totalSpent))}`,
      totalGained: `+${formatNumber(totalGained)}`,
      net: formatNumber(totalGained + totalSpent),
      current: formatNumber(currentWarchest || 0),
      starting: formatNumber(startingWarchest || 0),
    },
  };
}
