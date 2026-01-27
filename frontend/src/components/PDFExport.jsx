import React, { useState, useEffect } from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { Button } from './ui/button';
import {
  calculateMissionTotalBV,
  getAssignedMechs,
  getAssignedElementals,
  getMissionObjectiveReward,
} from '../lib/missions';
import { findPilotForMech, findMechForPilot, getMechAdjustedBV, getAdjustedBV } from '../lib/mechs';
// Note: getPilotDisplayName not imported - using PDF-specific version instead
import { buildLedgerEntries, summariseLedger } from '../lib/ledger';
import { getStatusBadgeVariant, UNIT_STATUS } from '../lib/constants';
import { computeCombatStats } from '../lib/achievements';

// Safe number formatter for PDF (uses apostrophe as thousands separator)
const formatNumber = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '0';
  const n = Number(num);
  if (Number.isNaN(n)) return '0';
  return n
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};

// CLASSIFIED DOCUMENT - High contrast black on white for printing
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Courier',
    fontSize: 9,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  // Document border
  pageBackground: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    border: '2 solid #000000',
  },
  pageCornerAccent: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#000000',
  },
  // Classification header
  classificationHeader: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1 solid #000000',
  },
  // Cover/Header Section
  coverSection: {
    marginBottom: 20,
    borderBottom: '2 solid #000000',
    paddingBottom: 16,
  },
  coverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  forceImageWrapper: {
    width: 80,
    marginRight: 16,
    border: '1 solid #000000',
    padding: 4,
  },
  forceTitleWrapper: {
    flex: 1,
  },
  forceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  forceSubtitle: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 8,
  },
  forceStatsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
    gap: 12,
  },
  forceStatBox: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    border: '1 solid #000000',
    minWidth: 100,
  },
  forceStatLabel: {
    fontSize: 7,
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  forceStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  // Section Headers
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '2 solid #000000',
    backgroundColor: '#EEEEEE',
    padding: 8,
  },
  // Roster grid
  rosterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  rosterItem: {
    width: '48%',
    marginBottom: 10,
  },
  // Unit Cards
  unitCard: {
    padding: 10,
    border: '1 solid #000000',
    backgroundColor: '#FFFFFF',
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: '1 solid #CCCCCC',
  },
  unitName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    maxWidth: '70%',
  },
  unitBadge: {
    fontSize: 7,
    color: '#FFFFFF',
    backgroundColor: '#16A34A',
    padding: '2 5',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  unitBadgeDamaged: {
    backgroundColor: '#F59E0B',
    color: '#000000',
  },
  unitBadgeDisabled: {
    backgroundColor: '#9CA3AF',
    color: '#000000',
  },
  unitBadgeDestroyed: {
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
  },
  unitBadgeKIA: {
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
  },
  unitBadgeRepairing: {
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
  },
  unitBadgeUnavailable: {
    backgroundColor: '#6B7280',
    color: '#FFFFFF',
  },
  unitContentRow: {
    flexDirection: 'row',
  },
  unitImageWrapper: {
    width: 70,
    alignItems: 'flex-start',
    marginRight: 8,
    border: '1 solid #CCCCCC',
    padding: 2,
  },
  unitStatsWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  unitStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  unitStatItem: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 3,
  },
  unitStatLabel: {
    fontSize: 8,
    color: '#666666',
    marginRight: 4,
    flexShrink: 0,
  },
  unitStatValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  unitHistory: {
    fontSize: 8,
    color: '#333333',
    marginTop: 6,
    padding: 6,
    backgroundColor: '#F5F5F5',
    border: '1 solid #CCCCCC',
  },
  // Mission Log
  missionCard: {
    marginBottom: 12,
    padding: 10,
    border: '1 solid #000000',
    backgroundColor: '#FFFFFF',
  },
  missionHeader: {
    marginBottom: 8,
    borderBottom: '1 solid #CCCCCC',
    paddingBottom: 6,
  },
  missionName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  missionMeta: {
    fontSize: 8,
    color: '#666666',
    marginBottom: 4,
  },
  missionSection: {
    marginTop: 8,
  },
  missionSectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  missionText: {
    fontSize: 8,
    color: '#333333',
    lineHeight: 1.5,
  },
  missionUnits: {
    fontSize: 8,
    color: '#333333',
    marginLeft: 12,
  },
  // Activity log
  activityRow: {
    flexDirection: 'row',
    marginBottom: 3,
    borderBottom: '0.5 solid #EEEEEE',
    paddingBottom: 2,
  },
  activityDate: {
    width: '22%',
    fontSize: 8,
    color: '#666666',
  },
  activityText: {
    flex: 1,
    fontSize: 8,
    color: '#333333',
  },
  // Decorative elements removed for cleaner print
  hexRow: {
    display: 'none',
  },
  hex: {
    display: 'none',
  },
  hexRowOffset: {
    display: 'none',
  },
  // Warchest accounting
  warchestSection: {
    marginTop: 12,
    marginBottom: 16,
    padding: 10,
    border: '1 solid #000000',
    backgroundColor: '#FFFFFF',
  },
  warchestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    borderBottom: '1 solid #CCCCCC',
    paddingBottom: 4,
  },
  warchestHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  warchestTableHeader: {
    flexDirection: 'row',
    borderBottom: '1 solid #000000',
    paddingBottom: 4,
    marginBottom: 4,
    backgroundColor: '#EEEEEE',
    padding: 4,
  },
  warchestTableHeaderCell: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  warchestTableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '0.5 solid #EEEEEE',
  },
  warchestCellDate: {
    width: '18%',
    fontSize: 8,
    color: '#333333',
  },
  warchestCellType: {
    width: '14%',
    fontSize: 8,
    color: '#333333',
  },
  warchestCellUnit: {
    width: '23%',
    fontSize: 8,
    color: '#333333',
  },
  warchestCellDesc: {
    width: '25%',
    fontSize: 8,
    color: '#333333',
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
    color: '#DC2626',
    fontWeight: 'bold',
  },
  warchestGainPositive: {
    color: '#16A34A',
    fontWeight: 'bold',
  },
  warchestSummaryRow: {
    marginTop: 6,
    borderTop: '1 solid #000000',
    paddingTop: 4,
  },
  warchestSummaryText: {
    fontSize: 8,
    color: '#000000',
  },
  // Snapshot status
  snapshotRow: {
    marginTop: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  snapshotStatusTable: {
    flexDirection: 'column',
    flexGrow: 1,
  },
  snapshotStatusHeaderRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  snapshotStatusHeaderLabel: {
    width: 20,
    fontSize: 7,
    color: '#666666',
  },
  snapshotStatusHeaderCell: {
    width: 28,
    fontSize: 7,
    textAlign: 'center',
    color: '#666666',
  },
  snapshotStatusRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  snapshotStatusRowLabel: {
    width: 20,
    fontSize: 7,
    fontWeight: 'bold',
    color: '#333333',
  },
  snapshotStatusCell: {
    width: 28,
    alignItems: 'center',
    textAlign: 'center',
  },
  snapshotStatusValue: {
    fontSize: 7,
    fontWeight: 'bold',
  },
  snapshotMetaCol: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  snapshotMetaText: {
    fontSize: 8,
    color: '#333333',
  },
  // Footer
  pageFooter: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1 solid #000000',
    paddingTop: 6,
  },
  pageFooterText: {
    fontSize: 7,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 25,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#333333',
  },
});

const STATUS_ORDER = [
  UNIT_STATUS.OPERATIONAL,
  UNIT_STATUS.DAMAGED,
  UNIT_STATUS.DISABLED,
  UNIT_STATUS.REPAIRING,
  UNIT_STATUS.UNAVAILABLE,
  UNIT_STATUS.DESTROYED,
];

const STATUS_LABELS = {
  [UNIT_STATUS.OPERATIONAL]: 'OP',
  [UNIT_STATUS.DAMAGED]: 'DMG',
  [UNIT_STATUS.DISABLED]: 'DSBL',
  [UNIT_STATUS.REPAIRING]: 'REP',
  [UNIT_STATUS.UNAVAILABLE]: 'UNAV',
  [UNIT_STATUS.DESTROYED]: 'DEST',
};

const buildStatusCountsForSnapshot = (snap, key) => {
  const unitsSummary = snap.units && snap.units[key];
  if (unitsSummary && unitsSummary.byStatus) {
    return unitsSummary.byStatus;
  }

  const counts = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  return counts;
};

const formatStatusDistributionLine = (byStatus) =>
  STATUS_ORDER.map((status) => `${STATUS_LABELS[status]}: ${byStatus[status] || 0}`).join(' / ');

// Map UI badge variants to PDF badge styles so status visuals are centralised.
const VARIANT_TO_STYLE = {
  operational: styles.unitBadge,
  damaged: [styles.unitBadge, styles.unitBadgeDamaged],
  disabled: [styles.unitBadge, styles.unitBadgeDisabled],
  destroyed: [styles.unitBadge, styles.unitBadgeDestroyed],
  repairing: [styles.unitBadge, styles.unitBadgeRepairing],
  unavailable: [styles.unitBadge, styles.unitBadgeUnavailable],
  kia: [styles.unitBadge, styles.unitBadgeKIA],
};

const getStatusBadgeStyle = (status) => {
  const variant = getStatusBadgeVariant(status);
  const style = VARIANT_TO_STYLE[variant];
  return style || styles.unitBadge;
};

const ForcePDF = ({ force, achievementDefs = [] }) => {
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

  // PDF-specific pilot name formatter (uses [Dezgra] text instead of emoji)
  const getPilotDisplayNamePDF = (pilot) => {
    if (!pilot) return '';
    return `${pilot.name || ''}${pilot.dezgra ? ' [Dezgra]' : ''}`.trim();
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
  const snapshots = force.snapshots || [];

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
        <View style={[styles.pageCornerAccent, { top: 20, left: 20 }]} fixed />
        <View style={[styles.pageCornerAccent, { top: 20, right: 20 }]} fixed />
        <View style={[styles.pageCornerAccent, { bottom: 20, left: 20 }]} fixed />
        <View style={[styles.pageCornerAccent, { bottom: 20, right: 20 }]} fixed />

        {/* Classification Header */}
        <Text style={styles.classificationHeader} fixed>
          CONFIDENTIAL // FORCE STATUS REPORT
        </Text>

        {/* Force Information Header */}
        <View style={styles.coverSection}>
          <View style={styles.coverHeaderRow}>
            <View style={styles.forceImageWrapper}>
              {force.image && (
                <Image
                  src={force.image}
                  style={{
                    maxWidth: 70,
                    maxHeight: 70,
                    objectFit: 'contain',
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

        {/* Special Abilities (if present) */}
        {force.specialAbilities && force.specialAbilities.length > 0 && (
          <View style={{ marginTop: 10, marginBottom: 10 }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 4, color: '#4B5320' }}>
              SPECIAL ABILITIES
            </Text>
            <View style={{ border: '0.75 solid #D1D5DB', padding: 6, backgroundColor: '#F9FAFB' }}>
              {force.specialAbilities.map((ability, index) => (
                <View key={index} style={{ flexDirection: 'row', marginBottom: 2 }}>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#111827', width: '30%' }}>
                    {ability.title}:
                  </Text>
                  <Text style={{ fontSize: 8, color: '#4B5563', flex: 1 }}>
                    {ability.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Campaign Notes (first page, if present) */}
        {force.notes && force.notes.trim().length > 0 && (
          <View>
            <Text style={styles.sectionHeader}>
              █ CAMPAIGN NOTES
            </Text>
            <Text style={styles.missionText}>{force.notes}</Text>
          </View>
        )}

        {/* Snapshots summary (first page, after notes) */}
        {snapshots.length > 0 && (
          <View>
            <Text style={styles.sectionHeader} break>
              █ CAMPAIGN SNAPSHOTS
            </Text>
            {snapshots.map((snap) => {
              const mechStatus = buildStatusCountsForSnapshot(snap, 'mechs');
              const elementalStatus = buildStatusCountsForSnapshot(snap, 'elementals');

              return (
                <View key={snap.id} style={{ marginBottom: 8, borderBottom: '0.5 solid #CCCCCC', paddingBottom: 4 }}>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#000000' }}>
                    {snap.createdAt} – {snap.label} ({
                      snap.type === 'pre-mission'
                        ? 'Pre-Mission'
                        : snap.type === 'post-mission'
                          ? 'Post-Mission'
                          : 'Post-Downtime'
                    })
                  </Text>

                  <View style={styles.snapshotRow}>
                    <View style={styles.snapshotStatusTable}>
                      <View style={styles.snapshotStatusHeaderRow}>
                        <Text style={styles.snapshotStatusHeaderLabel} />
                        {STATUS_ORDER.map((status) => (
                          <Text key={status} style={styles.snapshotStatusHeaderCell}>{STATUS_LABELS[status]}</Text>
                        ))}
                      </View>

                      <View style={styles.snapshotStatusRow}>
                        <Text style={styles.snapshotStatusRowLabel}>M:</Text>
                        {STATUS_ORDER.map((status) => (
                          <Text
                            key={status}
                            style={[
                              styles.snapshotStatusCell,
                              styles.snapshotStatusValue,
                              status === UNIT_STATUS.OPERATIONAL
                                ? { color: '#16A34A' }
                                : status === UNIT_STATUS.DAMAGED
                                  ? { color: '#F59E0B' }
                                  : status === UNIT_STATUS.REPAIRING
                                    ? { color: '#3B82F6' }
                                    : status === UNIT_STATUS.DESTROYED
                                      ? { color: '#B91C1C' }
                                      : { color: '#DC2626' },
                            ]}
                          >
                            {mechStatus[status] || 0}
                          </Text>
                        ))}
                      </View>

                      <View style={styles.snapshotStatusRow}>
                        <Text style={styles.snapshotStatusRowLabel}>E:</Text>
                        {STATUS_ORDER.map((status) => (
                          <Text
                            key={status}
                            style={[
                              styles.snapshotStatusCell,
                              styles.snapshotStatusValue,
                              status === UNIT_STATUS.OPERATIONAL
                                ? { color: '#16A34A' }
                                : status === UNIT_STATUS.DAMAGED
                                  ? { color: '#F59E0B' }
                                  : status === UNIT_STATUS.REPAIRING
                                    ? { color: '#3B82F6' }
                                    : status === UNIT_STATUS.DESTROYED
                                      ? { color: '#B91C1C' }
                                      : { color: '#DC2626' },
                            ]}
                          >
                            {elementalStatus[status] || 0}
                          </Text>
                        ))}
                      </View>
                    </View>

                    <View style={styles.snapshotMetaCol}>
                      <Text style={styles.snapshotMetaText}>
                        Missions completed: {snap.missionsCompleted}
                      </Text>
                      <Text style={styles.snapshotMetaText}>
                        Warchest: {formatNumber(snap.currentWarchest)} WP
                      </Text>
                      <Text style={styles.snapshotMetaText}>
                        Net Δ WP:{' '}
                        {snap.netWarchestChange >= 0 ? '+' : ''}
                        {formatNumber(snap.netWarchestChange)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
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
                    <Text style={styles.unitName}>{getPilotDisplayNamePDF(pilot)}</Text>
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
                        <View style={{ flexDirection: 'row', marginBottom: 3, width: '100%' }}>
                          <Text style={styles.unitStatLabel}>G/P:</Text>
                          <Text style={styles.unitStatValue}>{pilot.gunnery || 0}/{pilot.piloting || 0}</Text>
                        </View>
                        {assignedMech && (
                          <View style={{ flexDirection: 'row', marginBottom: 3, width: '100%' }}>
                            <Text style={styles.unitStatLabel}>Mech:</Text>
                            <Text style={[styles.unitStatValue, { maxWidth: 90 }]} numberOfLines={1}>{assignedMech.name}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Combat Record Section */}
                  {(() => {
                    const stats = computeCombatStats(pilot.combatRecord);
                    const kills = pilot.combatRecord?.kills || [];
                    const achievements = pilot.achievements || [];
                    if (stats.killCount > 0 || stats.assists > 0 || achievements.length > 0) {
                      return (
                        <View style={styles.missionSection}>
                          <Text style={styles.missionSectionTitle}>Combat Record:</Text>
                          <Text style={styles.missionText}>
                            Kills: {stats.killCount} | Assists: {stats.assists} | Missions: {stats.missionsCompleted} | Total Tonnage: {formatNumber(stats.totalTonnageDestroyed)}t
                          </Text>
                          
                          {/* Kill List Table */}
                          {kills.length > 0 && (
                            <View style={{ marginTop: 4, borderWidth: 0.5, borderColor: '#D1D5DB' }}>
                              <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                                <Text style={{ width: '40%', fontSize: 7, fontWeight: 'bold', padding: 2 }}>Mech</Text>
                                <Text style={{ width: '15%', fontSize: 7, fontWeight: 'bold', padding: 2, textAlign: 'center' }}>Tons</Text>
                                <Text style={{ width: '45%', fontSize: 7, fontWeight: 'bold', padding: 2 }}>Mission</Text>
                              </View>
                              {kills.map((kill, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', borderBottomWidth: idx < kills.length - 1 ? 0.5 : 0, borderBottomColor: '#E5E7EB' }}>
                                  <Text style={{ width: '40%', fontSize: 7, padding: 2 }}>{kill.mechModel}</Text>
                                  <Text style={{ width: '15%', fontSize: 7, padding: 2, textAlign: 'center' }}>{kill.tonnage}t</Text>
                                  <Text style={{ width: '45%', fontSize: 7, padding: 2, color: '#6B7280' }}>{kill.mission}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                          
                          {/* Achievements Table (no icons - PDF doesn't support emoji) */}
                          {achievements.length > 0 && (
                            <View style={{ marginTop: 4, borderWidth: 0.5, borderColor: '#D1D5DB' }}>
                              <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                                <Text style={{ width: '35%', fontSize: 7, fontWeight: 'bold', padding: 2 }}>Achievement</Text>
                                <Text style={{ width: '65%', fontSize: 7, fontWeight: 'bold', padding: 2 }}>Description</Text>
                              </View>
                              {achievements.map((achId) => {
                                const achDef = achievementDefs.find(a => a.id === achId) || { name: achId, description: '' };
                                return (
                                  <View key={achId} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' }}>
                                    <Text style={{ width: '35%', fontSize: 7, padding: 2, fontWeight: 'bold' }}>{achDef.name}</Text>
                                    <Text style={{ width: '65%', fontSize: 7, padding: 2, color: '#6B7280' }}>{achDef.description}</Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    }
                    return null;
                  })()}

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
                  pilotDisplay = `${getPilotDisplayNamePDF(pilot)} - KIA`;
                } else {
                  pilotDisplay = `${getPilotDisplayNamePDF(pilot)} - G:${pilot.gunnery || 0} / P:${
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
                          <Text style={styles.unitStatValue}>{formatNumber(getMechAdjustedBV(force, mech))}</Text>
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
            const totalTonnage = mission.totalTonnage || 0;

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
                    {formatNumber(reward || 0)} WP | Tonnage: {formatNumber(totalTonnage)}t | Total BV:{' '}
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

                {/* SP Purchases in PDF */}
                {Array.isArray(mission.spPurchases) && mission.spPurchases.length > 0 && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>
                      Support Point Purchases (Budget: {formatNumber(mission.spBudget || 0)} SP):
                    </Text>
                    {mission.spPurchases.map((purchase) => (
                      <Text key={purchase.id} style={styles.missionUnits}>
                        • {purchase.name} ({formatNumber(purchase.cost)} SP)
                      </Text>
                    ))}
                  </View>
                )}

                {/* OpFor Roster in PDF */}
                {Array.isArray(mission.opForUnits) && mission.opForUnits.length > 0 && (() => {
                  const getOpForAdjustedBV = (unit) => {
                    const baseBv = unit.baseBv ?? unit.bv ?? 0;
                    return getAdjustedBV(baseBv, unit.gunnery ?? 4, unit.piloting ?? 5);
                  };
                  const totalBV = mission.opForUnits.reduce((sum, u) => sum + getOpForAdjustedBV(u), 0);
                  const totalTonnage = mission.opForUnits.reduce((sum, u) => sum + (u.tonnage || 0), 0);
                  
                  return (
                    <View style={styles.missionSection}>
                      <Text style={styles.missionSectionTitle}>
                        Opposing Force ({totalTonnage}t, {formatNumber(totalBV)} BV):
                      </Text>
                      {mission.opForUnits.map((unit) => (
                        <Text key={unit.id} style={styles.missionUnits}>
                          • {unit.name} ({unit.tonnage}t, {unit.gunnery ?? 4}/{unit.piloting ?? 5}, {formatNumber(getOpForAdjustedBV(unit))} BV)
                        </Text>
                      ))}
                    </View>
                  );
                })()}

                {assignedMechObjects.length > 0 && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Assigned Mechs:</Text>
                    {assignedMechObjects.map((m) => {
                      const pilot = findPilotForMech(force, m);
                      return (
                        <Text key={m.id} style={styles.missionUnits}>
                          • {m.name}{pilot && pilot.dezgra ? ' [Dezgra]' : ''} ({formatNumber(getMechAdjustedBV(force, m))} BV, {m.weight || 0}t, {m.status || 'Unknown'})
                        </Text>
                      );
                    })}
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
  const [achievementDefs, setAchievementDefs] = useState([]);

  // Load achievement definitions
  useEffect(() => {
    fetch('./data/achievements.json')
      .then((res) => res.json())
      .then((data) => setAchievementDefs(data.achievements || []))
      .catch(() => setAchievementDefs([]));
  }, []);

  if (!force) return null;

  const handleGeneratePDF = async () => {
    try {
      setIsGenerating(true);
      const safeName = force.name ? force.name.replace(/\s+/g, '_') : 'force';
      const fileName = `${safeName}_Force_Report.pdf`;

      const blob = await pdf(<ForcePDF force={force} achievementDefs={achievementDefs} />).toBlob();

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
