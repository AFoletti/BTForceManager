import React, { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { Button } from './ui/button';
import {
  calculateMissionTotalBV,
  getAssignedMechs,
  getAssignedElementals,
  getMissionObjectiveReward,
} from '../lib/missions';
import { findPilotForMech, findMechForPilot } from '../lib/mechs';
import { buildLedgerEntries, summariseLedger } from '../lib/ledger';
import { getStatusBadgeVariant } from '../lib/constants';

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
    padding: 28,
    fontFamily: 'Helvetica',
    fontSize: 9,
    backgroundColor: '#FFFFFF',
  },
  // Sci-fi frame and accents
  pageBackground: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    border: '0.75 solid #CBD5F5',
  },
  pageCornerAccent: {
    position: 'absolute',
    width: 32,
    height: 2,
    backgroundColor: '#111827',
  },
  // Cover/Header Section
  coverSection: {
    marginBottom: 16,
    borderBottom: '1 solid #D1D5DB',
    paddingBottom: 10,
  },
  coverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  forceImageWrapper: {
    width: 70,
    marginRight: 10,
  },
  forceTitleWrapper: {
    flex: 1,
  },
  forceTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  forceSubtitle: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  forceStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  forceStatBox: {
    padding: 6,
    backgroundColor: '#F9FAFB',
    borderLeft: '2 solid #4B5320',
    minWidth: 110,
  },
  forceStatLabel: {
    fontSize: 7,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  forceStatValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2C2C2C',
  },
  // Section Headers
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '2 solid #4B5320',
  },
  // Roster grid
  rosterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  rosterItem: {
    width: '48%',
    marginBottom: 8,
  },
  // Unit Cards
  unitCard: {
    padding: 8,
    border: '0.75 solid #D1D5DB',
    borderLeft: '3 solid #4B5320',
    backgroundColor: '#FFFFFF',
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: '1 solid #E0E0E0',
  },
  unitName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  unitBadge: {
    fontSize: 8,
    color: '#FFF',
    backgroundColor: '#16A34A', // operational - green
    padding: '2 6',
    borderRadius: 2,
  },
  unitBadgeDamaged: {
    backgroundColor: '#F59E0B', // damaged - amber
  },
  unitBadgeDisabled: {
    backgroundColor: '#9CA3AF', // disabled/unavailable - gray
  },
  unitBadgeDestroyed: {
    backgroundColor: '#DC2626', // destroyed/KIA - red
  },
  unitBadgeKIA: {
    backgroundColor: '#DC2626',
  },
  unitBadgeRepairing: {
    backgroundColor: '#3B82F6', // repairing - blue
  },
  unitContentRow: {
    flexDirection: 'row',
  },
  unitImageWrapper: {
    width: 80,
    alignItems: 'flex-start',
    marginRight: 6,
  },
  unitStatsWrapper: {
    flex: 1,
  },
  unitStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  unitStatItem: {
    flexDirection: 'row',
    minWidth: '45%',
    marginRight: 6,
    marginBottom: 3,
  },
  unitStatLabel: {
    fontSize: 8,
    color: '#666',
    marginRight: 4,
  },
  unitStatValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#2C2C2C',
  },
  unitHistory: {
    fontSize: 8,
    color: '#374151',
    marginTop: 5,
    padding: 5,
    backgroundColor: '#F9FAFB',
    borderLeft: '1.5 solid #D1D5DB',
    fontStyle: 'italic',
  },
  // Mission Log
  missionCard: {
    marginBottom: 10,
    padding: 8,
    border: '1 solid #CCCCCC',
    borderTop: '3 solid #4B5320',
    backgroundColor: '#FAFAFA',
  },
  missionHeader: {
    marginBottom: 6,
  },
  missionName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  missionMeta: {
    fontSize: 8,
    color: '#666',
    marginBottom: 4,
  },
  missionSection: {
    marginTop: 6,
  },
  missionSectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4A4A4A',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  missionText: {
    fontSize: 8,
    color: '#555',
    lineHeight: 1.4,
  },
  missionUnits: {
    fontSize: 8,
    color: '#555',
    marginLeft: 10,
  },
  // Activity log table-style rows
  activityRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  activityDate: {
    width: '24%',
    fontSize: 8,
    color: '#6B7280',
  },
  activityText: {
    flex: 1,
    fontSize: 8,
    color: '#555',
  },
  // Decorative hexagon grid (bottom-right) for sci-fi feel
  hexRow: {
    flexDirection: 'row',
  },
  hex: {
    width: 10,
    height: 10,
    borderRadius: 2,
    border: '0.5 solid #E5E7EB',
    margin: 1,
  },
  hexRowOffset: {
    marginLeft: 5,
  },
  // Warchest accounting
  warchestSection: {
    marginTop: 10,
    marginBottom: 16,
    padding: 8,
    border: '0.75 solid #D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  warchestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  warchestHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  warchestTableHeader: {
    flexDirection: 'row',
    borderBottom: '1 solid #E5E7EB',
    paddingBottom: 3,
    marginBottom: 3,
  },
  warchestTableHeaderCell: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  warchestTableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  warchestCellDate: {
    width: '18%',
    fontSize: 8,
    color: '#374151',
  },
  warchestCellType: {
    width: '14%',
    fontSize: 8,
    color: '#374151',
  },
  warchestCellUnit: {
    width: '23%',
    fontSize: 8,
    color: '#374151',
  },
  warchestCellDesc: {
    width: '25%',
    fontSize: 8,
    color: '#4B5563',
  },
  warchestCellCost: {
    width: '10%',
    fontSize: 8,
    textAlign: 'right',
  },
  warchestCellGain: {
    width: '10%',
    fontSize: 8,
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
    marginTop: 4,
    borderTop: '1 solid #E5E7EB',
    paddingTop: 3,
  },
  warchestSummaryText: {
    fontSize: 8,
    color: '#111827',
  },
  // Footer
  pageNumber: {
    position: 'absolute',
    fontSize: 9,
    bottom: 18,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#999',
  },
});

// Map UI badge variants to PDF badge styles so status visuals are centralised.
const VARIANT_TO_STYLE = {
  operational: styles.unitBadge,
  damaged: [styles.unitBadge, styles.unitBadgeDamaged],
  disabled: [styles.unitBadge, styles.unitBadgeDisabled],
  destroyed: [styles.unitBadge, styles.unitBadgeDestroyed],
  repairing: [styles.unitBadge, styles.unitBadgeRepairing],
};

const getStatusBadgeStyle = (status) => {
  const variant = getStatusBadgeVariant(status);
  const style = VARIANT_TO_STYLE[variant];
  return style || styles.unitBadge;
};

const ForcePDF = ({ force }) => {
  // Helper to sort activity logs by timestamp (YYYY-MM-DD), oldest first
  const sortActivityLog = (log = []) => {
    return [...log].sort((a, b) => {
      const ta = a?.timestamp || '';
      const tb = b?.timestamp || '';
      return ta.localeCompare(tb);
    });
  };

  const formatActivityLine = (entry) => {
    const missionLabel = entry?.mission ? ` [${entry.mission}]` : '';
    const hasCost = typeof entry?.cost === 'number' && !Number.isNaN(entry.cost);
    const costLabel = hasCost ? ` (${formatNumber(entry.cost)} WP)` : '';
    return `${entry?.action || ''}${missionLabel}${costLabel}`;
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

  // Build ledger via shared helper
  const ledgerEntries = buildLedgerEntries(force);
  const { totalSpent, totalGained } = summariseLedger(
    ledgerEntries,
    currentWarchest,
    startingWarchest,
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Page frame & accents */}
        <View style={styles.pageBackground} fixed />
        <View style={[styles.pageCornerAccent, { top: 18, left: 18 }]} fixed />
        <View style={[styles.pageCornerAccent, { top: 18, right: 18 }]} fixed />
        <View style={[styles.pageCornerAccent, { bottom: 18, left: 18 }]} fixed />
        <View style={[styles.pageCornerAccent, { bottom: 18, right: 18 }]} fixed />

        {/* Force Information Header */}
        <View style={styles.coverSection}>
          <View style={{ position: 'relative', marginBottom: 6 }}>
            <View style={{
              position: 'absolute',
              left: 0,
              top: -10,
              width: 140,
              height: 140,
              borderRadius: 70,
              border: '0.75 solid #E5E7EB',
              opacity: 0.15,
            }} />
          </View>
          <View style={styles.coverHeaderRow}>
            <View style={styles.forceImageWrapper}>
              {force.image && (
                <Image
                  src={force.image}
                  style={{
                    maxWidth: 80,
                    maxHeight: 80,
                    objectFit: 'contain',
                    borderRadius: 4,
                    border: '0.75 solid #D1D5DB',
                  }}
                />
              )}
            </View>
            <View style={styles.forceTitleWrapper}>
              <Text style={styles.forceTitle}>{force.name}</Text>
              <Text style={styles.forceSubtitle}>
                {force.description || 'Elite mercenary unit force report'}
              </Text>
            </View>
          </View>

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

        {/* Campaign Notes (first page, if present) */}
        {force.notes && force.notes.trim().length > 0 && (
          <View>
            <Text style={styles.sectionHeader}>
              █ CAMPAIGN NOTES
            </Text>
            <Text style={styles.missionText}>{force.notes}</Text>
          </View>
        )}

        {/* Pilot Roster Section */}
        <Text style={styles.sectionHeader} break>
          █ PILOT ROSTER
        </Text>
        {pilots.length > 0 ? (
          <View style={styles.rosterGrid}>
            {pilots.map((pilot) => {
              const assignedMech = findMechForPilot(force, pilot);

              return (
                <View key={pilot.id} style={[styles.unitCard, styles.rosterItem]} wrap={false}>
                  <View style={styles.unitHeader}>
                    <Text style={styles.unitName}>{pilot.name}</Text>
                    <Text
                      style={
                        pilot.injuries === 6
                          ? [styles.unitBadge, styles.unitBadgeKIA]
                          : styles.unitBadge
                      }
                    >
                      {pilot.injuries === 6 ? 'KIA' : `Injuries: ${pilot.injuries || 0}/6`}
                    </Text>
                  </View>
                  <View style={styles.unitContentRow}>
                    <View style={styles.unitImageWrapper}>
                      {pilot.image && (
                        <Image
                          src={pilot.image}
                          style={{
                            maxWidth: 85,
                            maxHeight: 110,
                            objectFit: 'cover',
                            borderRadius: 4,
                            border: '0.75 solid #9CA3AF',
                          }}
                        />
                      )}
                    </View>
                    <View style={styles.unitStatsWrapper}>
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
                    </View>
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
                        <View key={idx} style={styles.activityRow}>
                          <Text style={styles.activityDate}>{entry.timestamp || ''}</Text>
                          <Text style={styles.activityText}>{formatActivityLine(entry)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.missionText}>No pilots in this force.</Text>
        )}

        {/* Elemental Roster Section */}
        <Text style={styles.sectionHeader} break>
          █ ELEMENTAL ROSTER
        </Text>
        {elementals.length > 0 ? (
          <View style={styles.rosterGrid}>
            {elementals.map((elemental) => (
              <View key={elemental.id} style={[styles.unitCard, styles.rosterItem]} wrap={false}>
                <View style={styles.unitHeader}>
                  <Text style={styles.unitName}>{elemental.name}</Text>
                  <Text style={getStatusBadgeStyle(elemental.status)}>{elemental.status}</Text>
                </View>
                <View style={styles.unitContentRow}>
                  <View style={styles.unitImageWrapper}>
                    {elemental.image && (
                      <Image
                        src={elemental.image}
                        style={{
                          maxWidth: 85,
                          maxHeight: 110,
                          objectFit: 'cover',
                          borderRadius: 4,
                          border: '0.75 solid #9CA3AF',
                        }}
                      />
                    )}
                  </View>
                  <View style={styles.unitStatsWrapper}>
                    <View style={styles.unitStatsGrid}>
                      <View style={styles.unitStatItem}>
                        <Text style={styles.unitStatLabel}>Commander:</Text>
                        <Text style={styles.unitStatValue}>{elemental.commander || 'Unassigned'}</Text>
                      </View>
                      <View style={styles.unitStatItem}>
                        <Text style={styles.unitStatLabel}>Gunnery:</Text>
                        <Text style={styles.unitStatValue}>{elemental.gunnery || 0}</Text>
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
                      <View key={idx} style={styles.activityRow}>
                        <Text style={styles.activityDate}>{entry.timestamp || ''}</Text>
                        <Text style={styles.activityText}>{formatActivityLine(entry)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.missionText}>No elemental points in this force.</Text>
        )}

        {/* Mech Information Section */}
        <Text style={styles.sectionHeader} break>
          █ MECH ROSTER
        </Text>
        {mechs.length > 0 ? (
          <View style={styles.rosterGrid}>
            {mechs.map((mech) => {
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
                <View key={mech.id} style={[styles.unitCard, styles.rosterItem]} wrap={false}>
                  <View style={styles.unitHeader}>
                    <Text style={styles.unitName}>{mech.name}</Text>
                    <Text style={getStatusBadgeStyle(mech.status)}>{mech.status}</Text>
                  </View>
                  <View style={styles.unitContentRow}>
                    <View style={styles.unitImageWrapper}>
                      {mech.image && (
                        <Image
                          src={mech.image}
                          style={{
                            maxWidth: 85,
                            maxHeight: 110,
                            objectFit: 'contain',
                            borderRadius: 4,
                            border: '0.75 solid #9CA3AF',
                          }}
                        />
                      )}
                    </View>
                    <View style={styles.unitStatsWrapper}>
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
                        <View key={idx} style={styles.activityRow}>
                          <Text style={styles.activityDate}>{entry.timestamp || ''}</Text>
                          <Text style={styles.activityText}>{formatActivityLine(entry)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
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
            const reward = getMissionObjectiveReward(mission);

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
                    {formatNumber(reward || 0)} WP | Total BV:{' '}
                    {formatNumber(totalBV || 0)}
                  </Text>
                </View>

                {mission.description && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Description:</Text>
                    <Text style={styles.missionText}>{mission.description}</Text>
                  </View>
                )}

                {Array.isArray(mission.objectives) && mission.objectives.length > 0 && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Objectives:</Text>
                    {mission.objectives.map((obj) => (
                      <Text key={obj.id} style={styles.missionText}>
                        {obj.achieved ? '[X] ' : '[ ] '}
                        {obj.title || 'Objective'}
                        {obj.wpReward > 0 && ` (+${formatNumber(obj.wpReward)} WP)`}
                      </Text>
                    ))}
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

        {/* Decorative hex pattern bottom-right */}
        <View
          style={{
            position: 'absolute',
            right: 40,
            bottom: 60,
            opacity: 0.2,
          }}
          fixed
        >
          <View style={styles.hexRow}>
            <View style={styles.hex} />
            <View style={styles.hex} />
            <View style={styles.hex} />
            <View style={styles.hex} />
          </View>
          <View style={[styles.hexRow, styles.hexRowOffset]}>
            <View style={styles.hex} />
            <View style={styles.hex} />
            <View style={styles.hex} />
          </View>
          <View style={styles.hexRow}>
            <View style={styles.hex} />
            <View style={styles.hex} />
            <View style={styles.hex} />
            <View style={styles.hex} />
          </View>
        </View>

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
      data-testid="export-pdf-button"
    >
      {isGenerating ? 'Generating PDF...' : 'Export PDF'}
    </Button>
  );
}
