import React, { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { Button } from './ui/button';
import {
  calculateMissionTotalBV,
  getAssignedMechs,
  getAssignedElementals,
} from '../lib/missions';
import { findPilotForMech, findMechForPilot } from '../lib/mechs';

// Safe number formatter for PDF (uses apostrophe as thousands separator)
const formatNumber = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '0';
  const n = Number(num);
  if (Number.isNaN(n)) return '0';
  return n
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};

// Military-themed styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#FFFFFF',
  },
  // Sci-fi frame and accents
  pageBackground: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    border: '1.5 solid #E5E7EB',
  },
  pageCornerAccent: {
    position: 'absolute',
    width: 40,
    height: 4,
    backgroundColor: '#111827',
  },
  // Cover/Header Section
  coverSection: {
    marginBottom: 30,
    borderBottom: '3 solid #2C2C2C',
    paddingBottom: 20,
  },
  forceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  forceSubtitle: {
    fontSize: 12,
    color: '#4A4A4A',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  forceStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  forceStatBox: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderLeft: '3 solid #8B4513',
    minWidth: 120,
  },
  forceStatLabel: {
    fontSize: 8,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  forceStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C2C2C',
  },
  // Section Headers
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 25,
    marginBottom: 15,
    paddingBottom: 8,
    borderBottom: '2 solid #8B4513',
  },
  // Unit Cards
  unitCard: {
    marginBottom: 15,
    padding: 12,
    border: '1 solid #CCCCCC',
    borderLeft: '4 solid #8B4513',
    backgroundColor: '#FAFAFA',
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1 solid #E0E0E0',
  },
  unitName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  unitBadge: {
    fontSize: 9,
    color: '#FFF',
    backgroundColor: '#4A7C59',
    padding: '3 8',
    borderRadius: 2,
  },
  unitBadgeDamaged: {
    backgroundColor: '#D97706',
  },
  unitBadgeDisabled: {
    backgroundColor: '#DC2626',
  },
  unitBadgeDestroyed: {
    backgroundColor: '#7F1D1D',
  },
  unitStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  unitStatItem: {
    flexDirection: 'row',
    minWidth: '45%',
  },
  unitStatLabel: {
    fontSize: 9,
    color: '#666',
    marginRight: 5,
  },
  unitStatValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#2C2C2C',
  },
  unitHistory: {
    fontSize: 9,
    color: '#555',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderLeft: '2 solid #CCC',
    fontStyle: 'italic',
  },
  // Mission Log
  missionCard: {
    marginBottom: 15,
    padding: 12,
    border: '1 solid #CCCCCC',
    borderTop: '3 solid #8B4513',
    backgroundColor: '#FAFAFA',
  },
  missionHeader: {
    marginBottom: 8,
  },
  missionName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  missionMeta: {
    fontSize: 8,
    color: '#666',
    marginBottom: 6,
  },
  missionSection: {
    marginTop: 8,
  },
  missionSectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4A4A4A',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  missionText: {
    fontSize: 9,
    color: '#555',
    lineHeight: 1.5,
  },
  missionUnits: {
    fontSize: 9,
    color: '#555',
    marginLeft: 10,
  },
  // Warchest accounting
  warchestSection: {
    marginTop: 10,
    marginBottom: 20,
    padding: 10,
    border: '1 solid #D4D4D4',
    backgroundColor: '#F9FAFB',
  },
  warchestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  warchestHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
  },
  warchestTableHeader: {
    flexDirection: 'row',
    borderBottom: '1 solid #E5E7EB',
    paddingBottom: 4,
    marginBottom: 4,
  },
  warchestTableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  warchestTableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  warchestCellDate: {
    width: '18%',
    fontSize: 9,
    color: '#374151',
  },
  warchestCellType: {
    width: '14%',
    fontSize: 9,
    color: '#374151',
  },
  warchestCellUnit: {
    width: '23%',
    fontSize: 9,
    color: '#374151',
  },
  warchestCellDesc: {
    width: '25%',
    fontSize: 9,
    color: '#4B5563',
  },
  warchestCellCost: {
    width: '10%',
    fontSize: 9,
    textAlign: 'right',
  },
  warchestCellGain: {
    width: '10%',
    fontSize: 9,
    textAlign: 'right',
  },
  warchestCostNegative: {
    color: '#B91C1C', // red-700
    fontWeight: 'bold',
  },
  warchestGainPositive: {
    color: '#166534', // green-700
    fontWeight: 'bold',
  },
  warchestSummaryRow: {
    marginTop: 6,
    borderTop: '1 solid #E5E7EB',
    paddingTop: 4,
  },
  warchestSummaryText: {
    fontSize: 9,
    color: '#111827',
  },
  // Footer
  pageNumber: {
    position: 'absolute',
    fontSize: 10,
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#999',
  },
});

// Removed orphaned JSX block


const ForcePDF = ({ force }) => {
  const getStatusBadgeStyle = (status) => {
    if (status === 'Damaged' || status === 'Repairing') {
      return [styles.unitBadge, styles.unitBadgeDamaged];
    }
    if (status === 'Disabled' || status === 'Unavailable') {
      return [styles.unitBadge, styles.unitBadgeDisabled];
    }
    if (status === 'Destroyed') {
      return [styles.unitBadge, styles.unitBadgeDestroyed];
    }
    return styles.unitBadge;
  };

  // Helper to sort activity logs by timestamp (YYYY-MM-DD), oldest first
  const sortActivityLog = (log = []) => {
    return [...log].sort((a, b) => {
      const ta = a?.timestamp || '';
      const tb = b?.timestamp || '';
      return ta.localeCompare(tb);
    });
  };

  const formatActivityLine = (entry) => {
    const date = entry?.timestamp || '';
    const missionLabel = entry?.mission ? ` [${entry.mission}]` : '';
    const hasCost = typeof entry?.cost === 'number' && !Number.isNaN(entry.cost);
    const costLabel = hasCost ? ` (${formatNumber(entry.cost)} WP)` : '';
    return `${date}${date ? ' – ' : ''}${entry?.action || ''}${missionLabel}${costLabel}`;
  };

  const currentWarchest =
    typeof force.currentWarchest === 'number'
      ? force.currentWarchest
      : typeof force.warchest === 'number'
        ? force.warchest
        : 0;

  const startingWarchest = typeof force.startingWarchest === 'number' ? force.startingWarchest : 0;

  const mechs = force.mechs || [];
  const pilots = force.pilots || [];
  const elementals = force.elementals || [];
  const missions = force.missions || [];
  const currentDateLabel = force.currentDate;

  // Build a flattened, chronologically ordered warchest ledger
  const ledgerEntries = [];

  // Helper to push a cost (negative WP) entry
  const pushCost = ({ timestamp, sourceType, unitName, description, cost }) => {
    if (!timestamp) return;
    const safeCost = typeof cost === 'number' && !Number.isNaN(cost) ? cost : 0;
    ledgerEntries.push({
      timestamp,
      sourceType,
      unitName,
      description,
      cost: -Math.abs(safeCost),
      gain: 0,
    });
  };

  // Helper to push a gain (positive WP) entry
  const pushGain = ({ timestamp, sourceType, unitName, description, gain }) => {
    if (!timestamp) return;
    const safeGain = typeof gain === 'number' && !Number.isNaN(gain) ? gain : 0;
    ledgerEntries.push({
      timestamp,
      sourceType,
      unitName,
      description,
      cost: 0,
      gain: Math.abs(safeGain),
    });
  };

  // Mech activity costs
  mechs.forEach((mech) => {
    (mech.activityLog || []).forEach((entry) => {
      if (typeof entry.cost === 'number' && entry.cost !== 0) {
        pushCost({
          timestamp: entry.timestamp,
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
          timestamp: entry.timestamp,
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
          timestamp: entry.timestamp,
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

  // Sort ledger by timestamp (YYYY-MM-DD) oldest first
  ledgerEntries.sort((a, b) => {
    const ta = a.timestamp || '';
    const tb = b.timestamp || '';
    return ta.localeCompare(tb);
  });

  const totalSpent = ledgerEntries.reduce((sum, e) => sum + Math.min(e.cost, 0), 0);
  const totalGained = ledgerEntries.reduce((sum, e) => sum + Math.max(e.gain, 0), 0);


  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Force Information Header */}
        <View style={styles.coverSection}>
          <Text style={styles.forceTitle}>{force.name}</Text>
          <Text style={styles.forceSubtitle}>
        {/* Page frame accents for sci-fi look, optimized for white paper */}
        <View style={styles.pageBackground} fixed />
        <View style={[styles.pageCornerAccent, { top: 20, left: 20 }]} fixed />
        <View style={[styles.pageCornerAccent, { top: 20, right: 20 }]} fixed />
        <View style={[styles.pageCornerAccent, { bottom: 20, left: 20 }]} fixed />
        <View style={[styles.pageCornerAccent, { bottom: 20, right: 20 }]} fixed />

            {force.description || 'Elite mercenary unit force report'}
          </Text>

          <View style={styles.forceStatsRow}>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Current Warchest</Text>
              <Text style={styles.forceStatValue}>{formatNumber(currentWarchest)} WP</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Starting Warchest</Text>
              <Text style={styles.forceStatValue}>{formatNumber(startingWarchest)} WP</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Mechs</Text>
              <Text style={styles.forceStatValue}>{mechs.length}</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Pilots</Text>
              <Text style={styles.forceStatValue}>{pilots.length}</Text>
            </View>
          </View>
          <View style={styles.forceStatsRow}>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Elementals</Text>
              <Text style={styles.forceStatValue}>{elementals.length}</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Missions</Text>
              <Text style={styles.forceStatValue}>{missions.length}</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>WP Multiplier</Text>
              <Text style={styles.forceStatValue}>{force.wpMultiplier || 5}x</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Current Date</Text>
              <Text style={styles.forceStatValue}>{currentDateLabel || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Pilot Roster Section */}
        <Text style={styles.sectionHeader} break>
          █ PILOT ROSTER
        </Text>
        {pilots.length > 0 ? (
          pilots.map((pilot) => {
            const assignedMech = findMechForPilot(force, pilot);

        {/* Force Image */}
        {force.image && (
          <View style={{ marginTop: 12, marginBottom: 4, alignItems: 'flex-start' }}>
            <Image
              src={force.image}
              style={{
                maxWidth: 180,
                maxHeight: 90,
                objectFit: 'contain',
                borderRadius: 4,
                border: '1 solid #D1D5DB',
              }}
            />
          </View>
        )}


            return (
              <View key={pilot.id} style={styles.unitCard} wrap={false}>
                <View style={styles.unitHeader}>
                  <Text style={styles.unitName}>{pilot.name}</Text>
                  <Text style={styles.unitBadge}>
                    {pilot.injuries === 6 ? 'KIA' : `Injuries: ${pilot.injuries || 0}/6`}
                  </Text>
                </View>
                <View style={styles.unitStatsGrid}>
                  <View style={styles.unitStatItem}>
                    <Text style={styles.unitStatLabel}>Gunnery:</Text>
                    <Text style={styles.unitStatValue}>{pilot.gunnery || 0}</Text>
                  </View>
                  <View style={styles.unitStatItem}>
                    <Text style={styles.unitStatLabel}>Piloting:</Text>
                    <Text style={styles.unitStatValue}>{pilot.piloting || 0}</Text>
                  </View>
                  {assignedMech && (
                    <View style={styles.unitStatItem}>
                      <Text style={styles.unitStatLabel}>Assigned Mech:</Text>
                      <Text style={styles.unitStatValue}>{assignedMech.name}</Text>
                    </View>
                  )}
                </View>

                {pilot.image && (
                  <View style={{ marginBottom: 6, alignItems: 'flex-start' }}>
                    <Image
                      src={pilot.image}
                      style={{
                        maxWidth: 80,
                        maxHeight: 80,
                        objectFit: 'cover',
                        borderRadius: 4,
                        border: '1 solid #9CA3AF',
                      }}
                    />
                  </View>
                )}
                </View>
                {pilot.history && (
                  <View style={styles.unitHistory}>
                    <Text>{pilot.history}</Text>
                  </View>
                )}
                {pilot.activityLog && pilot.activityLog.length > 0 && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Activity Log:</Text>
                    {sortActivityLog(pilot.activityLog).map((entry, idx) => (
                      <Text key={idx} style={styles.missionText}>
                        {formatActivityLine(entry)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.missionText}>No pilots in this force.</Text>
        )}

        {/* Elemental Roster Section */}
        <Text style={styles.sectionHeader} break>
          █ ELEMENTAL ROSTER
        </Text>
        {elementals.length > 0 ? (
          elementals.map((elemental) => (
            <View key={elemental.id} style={styles.unitCard} wrap={false}>
              <View style={styles.unitHeader}>
                <Text style={styles.unitName}>{elemental.name}</Text>
                <Text style={getStatusBadgeStyle(elemental.status)}>{elemental.status}</Text>
              </View>
              <View style={styles.unitStatsGrid}>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Commander:</Text>
                  <Text style={styles.unitStatValue}>{elemental.commander || 'Unassigned'}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Gunnery:</Text>
                  <Text style={styles.unitStatValue}>{elemental.gunnery || 0}</Text>
              {elemental.image && (
                <View style={{ marginBottom: 6, alignItems: 'flex-start' }}>
                  <Image
                    src={elemental.image}
                    style={{
                      maxWidth: 80,
                      maxHeight: 80,
                      objectFit: 'cover',
                      borderRadius: 4,
                      border: '1 solid #9CA3AF',
                    }}
                  />
                </View>
              )}

                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Antimech:</Text>
                  <Text style={styles.unitStatValue}>{elemental.antimech || 0}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>BV:</Text>
                  <Text style={styles.unitStatValue}>{formatNumber(elemental.bv || 0)}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Suits Destroyed:</Text>
                  <Text style={styles.unitStatValue}>{elemental.suitsDestroyed || 0}/5</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Suits Damaged:</Text>
                  <Text style={styles.unitStatValue}>{elemental.suitsDamaged || 0}/5</Text>
                </View>
              </View>
              {elemental.history && (
                <View style={styles.unitHistory}>
                  <Text>{elemental.history}</Text>
                </View>
              )}
              {elemental.activityLog && elemental.activityLog.length > 0 && (
                <View style={styles.missionSection}>
                  <Text style={styles.missionSectionTitle}>Activity Log:</Text>
                  {sortActivityLog(elemental.activityLog).map((entry, idx) => (
                    <Text key={idx} style={styles.missionText}>
                      {formatActivityLine(entry)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.missionText}>No elemental points in this force.</Text>
        )}

        {/* Mech Information Section */}
        <Text style={styles.sectionHeader} break>
          █ MECH ROSTER
        </Text>
                {mech.image && (
                  <View style={{ marginBottom: 6, alignItems: 'flex-start' }}>
                    <Image
                      src={mech.image}
                      style={{
                        maxWidth: 100,
                        maxHeight: 80,
                        objectFit: 'contain',
                        borderRadius: 4,
                        border: '1 solid #9CA3AF',
                      }}
                    />
                  </View>
                )}

        {mechs.length > 0 ? (
          mechs.map((mech) => {
            const pilot = findPilotForMech(force, mech);

            let pilotDisplay = 'Missing Pilot';
            if (pilot) {
              if (pilot.injuries === 6) {
                pilotDisplay = `${pilot.name} - KIA`;
              } else {
                pilotDisplay = `${pilot.name} - G:${pilot.gunnery || 0} / P:${
                  pilot.piloting || 0
                }`;
              }
            }

            return (
              <View key={mech.id} style={styles.unitCard} wrap={false}>
                <View style={styles.unitHeader}>
                  <Text style={styles.unitName}>{mech.name}</Text>
                  <Text style={getStatusBadgeStyle(mech.status)}>{mech.status}</Text>
                </View>
                <View style={styles.unitStatsGrid}>
                  <View style={styles.unitStatItem}>
                    <Text style={styles.unitStatLabel}>Pilot:</Text>
                    <Text style={styles.unitStatValue}>{pilotDisplay}</Text>
                  </View>
                  <View style={styles.unitStatItem}>
                    <Text style={styles.unitStatLabel}>BV:</Text>
                    <Text style={styles.unitStatValue}>{formatNumber(mech.bv || 0)}</Text>
                  </View>
                  <View style={styles.unitStatItem}>
                    <Text style={styles.unitStatLabel}>Weight:</Text>
                    <Text style={styles.unitStatValue}>{mech.weight || 0}t</Text>
                  </View>
                </View>
                {mech.history && (
                  <View style={styles.unitHistory}>
                    <Text>{mech.history}</Text>
                  </View>
                )}
                {mech.activityLog && mech.activityLog.length > 0 && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Activity Log:</Text>
                    {sortActivityLog(mech.activityLog).map((entry, idx) => (
                      <Text key={idx} style={styles.missionText}>
                        {formatActivityLine(entry)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.missionText}>No mechs in this force.</Text>
        )}

        {/* Mission Log Section */}
        <Text style={styles.sectionHeader} break>
          █ MISSION LOG
        </Text>
        {missions.length > 0 ? (
          missions.map((mission) => {
            const assignedMechIds = mission.assignedMechs || [];
            const assignedElementalIds = mission.assignedElementals || [];
            const assignedMechObjects = getAssignedMechs(force, assignedMechIds);
            const assignedElementalObjects = getAssignedElementals(force, assignedElementalIds);
            const totalBV = calculateMissionTotalBV(
              force,
              assignedMechIds,
              assignedElementalIds,
            );

            const statusLabel = mission.completed ? 'COMPLETED' : 'ACTIVE';
            const missionDate = mission.createdAt || '';

            return (
              <View key={mission.id} style={styles.missionCard} wrap={false}>
                <View style={styles.missionHeader}>
                  <Text style={styles.missionName}>{mission.name || 'Unnamed Mission'}</Text>
                  <Text style={styles.missionMeta}>
                    Status: {statusLabel}
                    {missionDate ? ` | Date: ${missionDate}` : ''}
                  </Text>
                  <Text style={styles.missionMeta}>
                    Cost: {formatNumber(mission.cost || 0)} WP | Gained:{' '}
                    {formatNumber(mission.warchestGained || 0)} WP | Total BV:{' '}
                    {formatNumber(totalBV || 0)}
                  </Text>
                </View>

                {mission.description && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Description:</Text>
                    <Text style={styles.missionText}>{mission.description}</Text>
                  </View>
                )}

                {mission.objectives && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Objectives:</Text>
                    <Text style={styles.missionText}>{mission.objectives}</Text>
                  </View>
                )}

                {assignedMechObjects.length > 0 && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Assigned Mechs:</Text>
                    {assignedMechObjects.map((m) => (
                      <Text key={m.id} style={styles.missionUnits}>
                        • {m.name} ({formatNumber(m.bv || 0)} BV, {m.status || 'Unknown'})
                      </Text>
                    ))}
                  </View>
                )}

                {assignedElementalObjects.length > 0 && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Assigned Elementals:</Text>
                    {assignedElementalObjects.map((e) => (
                      <Text key={e.id} style={styles.missionUnits}>
                        • {e.name} ({formatNumber(e.bv || 0)} BV, {e.status || 'Unknown'})
                      </Text>
                    ))}
                  </View>
                )}

                {mission.recap && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>After Action Report:</Text>
                    <Text style={styles.missionText}>{mission.recap}</Text>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.missionText}>No missions recorded for this force.</Text>
        )}

        {/* Warchest Accounting */}
        <Text style={styles.sectionHeader} break>
          █ WARCHEST ACCOUNTING
        </Text>
        <View style={styles.warchestSection}>
          <View style={styles.warchestHeaderRow}>
            <Text style={styles.warchestHeaderText}>Financial Ledger</Text>
            <Text style={styles.warchestHeaderText}>
              Starting: {formatNumber(startingWarchest)} WP | Current: {formatNumber(currentWarchest)} WP
            </Text>
          </View>

          {ledgerEntries.length > 0 ? (
            <>
              <View style={styles.warchestTableHeader}>
                <Text style={[styles.warchestTableHeaderCell, styles.warchestCellDate]}>Date</Text>
                <Text style={[styles.warchestTableHeaderCell, styles.warchestCellType]}>Type</Text>
                <Text style={[styles.warchestTableHeaderCell, styles.warchestCellUnit]}>Unit/Mission</Text>
                <Text style={[styles.warchestTableHeaderCell, styles.warchestCellDesc]}>Description</Text>
                <Text style={[styles.warchestTableHeaderCell, styles.warchestCellCost]}>Cost</Text>
                <Text style={[styles.warchestTableHeaderCell, styles.warchestCellGain]}>Gain</Text>
              </View>

              {ledgerEntries.map((entry, idx) => (
                <View key={idx} style={styles.warchestTableRow} wrap={false}>
                  <Text style={styles.warchestCellDate}>{entry.timestamp}</Text>
                  <Text style={styles.warchestCellType}>{entry.sourceType}</Text>
                  <Text style={styles.warchestCellUnit}>{entry.unitName}</Text>
                  <Text style={styles.warchestCellDesc}>{entry.description}</Text>
                  <Text
                    style={[
                      styles.warchestCellCost,
                      entry.cost < 0 ? styles.warchestCostNegative : null,
                    ]}
                  >
                    {entry.cost < 0 ? `-${formatNumber(Math.abs(entry.cost))}` : ''}
                  </Text>
                  <Text
                    style={[
                      styles.warchestCellGain,
                      entry.gain > 0 ? styles.warchestGainPositive : null,
                    ]}
                  >
                    {entry.gain > 0 ? `+${formatNumber(entry.gain)}` : ''}
                  </Text>
                </View>
              ))}

              <View style={styles.warchestSummaryRow}>
                <Text style={styles.warchestSummaryText}>
                  Total Spent: -{formatNumber(Math.abs(totalSpent))} WP | Total Gained: +
                  {formatNumber(totalGained)} WP | Net:{' '}
                  {formatNumber(totalGained + totalSpent)} WP | Current Warchest:{' '}
                  {formatNumber(currentWarchest)} WP
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.missionText}>No warchest-affecting actions recorded.</Text>
          )}
        </View>

        {/* Other Actions History removed: other downtime actions are now logged directly on units */}

        {/* Page Number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default function PDFExport({ force }) {
  const [isGenerating, setIsGenerating] = useState(false);

  if (!force) return null;

  const handleGeneratePDF = async () => {
    try {
      setIsGenerating(true);
      const safeName = force.name ? force.name.replace(/\s+/g, '_') : 'force';
      const fileName = `${safeName}_Force_Report.pdf`;

      const blob = await pdf(<ForcePDF force={force} />).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsGenerating(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error generating PDF:', error);
      // eslint-disable-next-line no-alert
      alert('Failed to generate PDF. Please try again.');
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleGeneratePDF}
      disabled={isGenerating}
      className="bg-accent text-accent-foreground hover:bg-accent/90"
    >
      {isGenerating ? 'Generating PDF...' : 'Export PDF'}
    </Button>
  );
}
