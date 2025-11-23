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

// Safe number formatter for PDF (uses apostrophe as thousands separator)
const formatNumber = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '0';
  const n = Number(num);
  if (Number.isNaN(n)) return '0';
  return n
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};

// Layout & typography for the dossier-style PDF
const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 9,
    backgroundColor: '#FFFFFF',
  },
  frame: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 0.75,
    borderStyle: 'solid',
    borderColor: '#D1D5DB',
  },
  cornerBlock: {
    position: 'absolute',
    width: 34,
    height: 2,
    backgroundColor: '#111827',
  },
  hexWatermark: {
    position: 'absolute',
    right: 60,
    top: 120,
    opacity: 0.06,
  },
  hexRow: {
    flexDirection: 'row',
  },
  hex: {
    width: 11,
    height: 11,
    borderRadius: 2,
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: '#E5E7EB',
    margin: 1.5,
  },
  hexRowOffset: {
    marginLeft: 6,
  },
  // Cover page
  coverStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  coverStripLeft: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#6B7280',
  },
  coverStripRight: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#9CA3AF',
  },
  coverMain: {
    flex: 1,
    justifyContent: 'center',
  },
  coverForceImageWrapper: {
    alignItems: 'center',
    marginBottom: 18,
  },
  coverTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 10,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 18,
  },
  coverForceName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  coverForceDesc: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 18,
  },
  coverStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  coverStatBlock: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F9FAFB',
    borderLeftWidth: 2,
    borderLeftStyle: 'solid',
    borderLeftColor: '#4B5320',
    minWidth: 110,
  },
  coverStatLabel: {
    fontSize: 7,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  coverStatValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  // Common section styling
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionRule: {
    height: 1,
    backgroundColor: '#4B5320',
    marginBottom: 8,
  },
  sectionNote: {
    fontSize: 8,
    color: '#6B7280',
    marginBottom: 8,
  },
  // Order of battle tables
  table: {
    width: '100%',
    borderWidth: 0,
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#D1D5DB',
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomStyle: 'solid',
    borderBottomColor: '#E5E7EB',
    paddingVertical: 3,
  },
  tableCell: {
    paddingHorizontal: 4,
    fontSize: 8,
    color: '#111827',
  },
  tableHeaderCell: {
    paddingHorizontal: 4,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
  },
  colNarrow: {
    width: '10%',
  },
  colMedium: {
    width: '18%',
  },
  colWide: {
    width: '26%',
  },
  statusTag: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    backgroundColor: '#16A34A',
  },
  statusDamaged: { backgroundColor: '#F59E0B' },
  statusDisabled: { backgroundColor: '#9CA3AF' },
  statusDestroyed: { backgroundColor: '#DC2626' },
  statusRepair: { backgroundColor: '#3B82F6' },
  // Detail records
  recordBlock: {
    marginBottom: 10,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  recordName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  recordMeta: {
    fontSize: 8,
    color: '#6B7280',
  },
  recordSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  recordSummaryItem: {
    flexDirection: 'row',
    marginRight: 12,
    marginBottom: 2,
  },
  recordLabel: {
    fontSize: 8,
    color: '#6B7280',
    marginRight: 3,
  },
  recordValue: {
    fontSize: 8,
    color: '#111827',
    fontWeight: 'bold',
  },
  recordHistory: {
    fontSize: 8,
    color: '#374151',
    marginTop: 2,
    marginBottom: 2,
  },
  recordDivider: {
    height: 0.5,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
    marginBottom: 4,
  },
  // Activity log
  activityRow: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  activityDate: {
    width: '23%',
    fontSize: 8,
    color: '#6B7280',
  },
  activityText: {
    flex: 1,
    fontSize: 8,
    color: '#111827',
  },
  // Mission log
  missionEntry: {
    marginBottom: 8,
    paddingLeft: 6,
    borderLeftWidth: 1.5,
    borderLeftStyle: 'solid',
    borderLeftColor: '#9CA3AF',
  },
  missionHeaderLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  missionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  missionBadge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    backgroundColor: '#16A34A',
  },
  missionBadgeActive: { backgroundColor: '#3B82F6' },
  missionMetaLine: {
    fontSize: 8,
    color: '#4B5563',
    marginBottom: 2,
  },
  missionSubheading: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4B5563',
    marginTop: 2,
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  missionText: {
    fontSize: 8,
    color: '#111827',
  },
  missionListItem: {
    fontSize: 8,
    color: '#111827',
    marginLeft: 8,
  },
  // Warchest
  warchestBox: {
    marginTop: 4,
    marginBottom: 12,
    padding: 8,
    borderWidth: 0.75,
    borderStyle: 'solid',
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  warchestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  warchestHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
  },
  warchestTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#E5E7EB',
    paddingVertical: 2,
    marginBottom: 2,
  },
  warchestTableRow: {
    flexDirection: 'row',
    paddingVertical: 1,
    borderBottomWidth: 0.5,
    borderBottomStyle: 'solid',
    borderBottomColor: '#F3F4F6',
  },
  warchestCell: {
    fontSize: 8,
    color: '#111827',
    paddingRight: 4,
  },
  warchestColDate: { width: '18%' },
  warchestColType: { width: '14%' },
  warchestColUnit: { width: '23%' },
  warchestColDesc: { width: '25%' },
  warchestColCost: { width: '10%', textAlign: 'right' },
  warchestColGain: { width: '10%', textAlign: 'right' },
  warchestCostNeg: { color: '#B91C1C', fontWeight: 'bold' },
  warchestGainPos: { color: '#166534', fontWeight: 'bold' },
  warchestSummary: {
    marginTop: 3,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#E5E7EB',
    paddingTop: 2,
    fontSize: 8,
    color: '#111827',
  },
  // Footer
  pageNumber: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    fontSize: 9,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

const getStatusTagStyle = (status) => {
  if (status === 'Damaged') return [styles.statusTag, styles.statusDamaged];
  if (status === 'Repairing') return [styles.statusTag, styles.statusRepair];
  if (status === 'Disabled' || status === 'Unavailable') return [styles.statusTag, styles.statusDisabled];
  if (status === 'Destroyed') return [styles.statusTag, styles.statusDestroyed];
  return styles.statusTag;
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
  const missionLabel = entry?.mission ? ` [${entry.mission}]` : '';
  const hasCost = typeof entry?.cost === 'number' && !Number.isNaN(entry.cost);
  const costLabel = hasCost ? ` (${formatNumber(entry.cost)} WP)` : '';
  return `${entry?.action || ''}${missionLabel}${costLabel}`;
};

const PageChrome = ({ children }) => (
  <>
    <View style={styles.frame} fixed />
    <View style={[styles.cornerBlock, { top: 20, left: 20 }]} fixed />
    <View style={[styles.cornerBlock, { top: 20, right: 20 }]} fixed />
    <View style={[styles.cornerBlock, { bottom: 20, left: 20 }]} fixed />
    <View style={[styles.cornerBlock, { bottom: 20, right: 20 }]} fixed />

    {/* Neutral hex watermark */}
    <View style={styles.hexWatermark} fixed>
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
      <View style={[styles.hexRow, styles.hexRowOffset]}>
        <View style={styles.hex} />
        <View style={styles.hex} />
        <View style={styles.hex} />
      </View>
    </View>

    {children}

    <Text
      style={styles.pageNumber}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      fixed
    />
  </>
);

const ForcePDF = ({ force }) => {
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

  // Build mech–pilot pairings and unassigned units for Order of Battle
  const usedPilotIds = new Set();
  const pairedCombatElements = [];
  const unassignedMechs = [];

  mechs.forEach((mech) => {
    const pilot = findPilotForMech(force, mech);
    if (pilot) {
      pairedCombatElements.push({ mech, pilot });
      if (pilot.id != null) usedPilotIds.add(pilot.id);
    } else {
      unassignedMechs.push(mech);
    }
  });

  const unassignedPilots = pilots.filter((pilot) => !usedPilotIds.has(pilot.id));

  // Ledger
  const ledgerEntries = buildLedgerEntries(force);
  const { totalSpent, totalGained } = summariseLedger(
    ledgerEntries,
    currentWarchest,
    startingWarchest,
  );

  return (
    <Document>
      {/* COVER PAGE – no other content */}
      <Page size="A4" style={styles.page}>
        <PageChrome>
          <View style={styles.coverStrip}>
            <Text style={styles.coverStripLeft}>Battletech Force Dossier</Text>
            <Text style={styles.coverStripRight}>Field Operations // Command Copy</Text>
          </View>

          <View style={styles.coverMain}>
            <View style={styles.coverForceImageWrapper}>
              {force.image && (
                <Image
                  src={force.image}
                  style={{
                    maxWidth: 130,
                    maxHeight: 130,
                    objectFit: 'contain',
                    borderRadius: 6,
                    borderWidth: 0.75,
                    borderStyle: 'solid',
                    borderColor: '#D1D5DB',
                  }}
                />
              )}
            </View>

            <Text style={styles.coverTitle}>BATTLETECH FORCE DOSSIER</Text>
            <Text style={styles.coverSubtitle}>Classic BattleTech Mech &amp; Personnel Operational Report</Text>

            <Text style={styles.coverForceName}>{force.name}</Text>
            <Text style={styles.coverForceDesc}>
              {force.description || 'Comprehensive status report and operational history for this combat force.'}
            </Text>

            <View style={styles.coverStatsRow}>
              <View style={styles.coverStatBlock}>
                <Text style={styles.coverStatLabel}>Current Warchest</Text>
                <Text style={styles.coverStatValue}>{formatNumber(currentWarchest)} WP</Text>
              </View>
              <View style={styles.coverStatBlock}>
                <Text style={styles.coverStatLabel}>Starting Warchest</Text>
                <Text style={styles.coverStatValue}>{formatNumber(startingWarchest)} WP</Text>
              </View>
              <View style={styles.coverStatBlock}>
                <Text style={styles.coverStatLabel}>Combat Elements</Text>
                <Text style={styles.coverStatValue}>
                  {mechs.length} Mechs / {elementals.length} Elementals
                </Text>
              </View>
              <View style={styles.coverStatBlock}>
                <Text style={styles.coverStatLabel}>In-Universe Date</Text>
                <Text style={styles.coverStatValue}>{currentDateLabel || '—'}</Text>
              </View>
            </View>
          </View>
        </PageChrome>
      </Page>

      {/* ORDER OF BATTLE – Mech/Pilot pairs, unassigneds, elementals */}
      <Page size="A4" style={styles.page}>
        <PageChrome>
          <Text style={styles.sectionTitle}>Order of Battle</Text>
          <View style={styles.sectionRule} />
          <Text style={styles.sectionNote}>
            Battle-ready elements including mech–pilot pairings and Elemental points. This view is focused on
            combat-relevant data only.
          </Text>

          {/* Mech + Pilot table */}
          {pairedCombatElements.length > 0 && (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.colWide]}>Mech</Text>
                <Text style={[styles.tableHeaderCell, styles.colMedium]}>Pilot</Text>
                <Text style={[styles.tableHeaderCell, styles.colMedium]}>Skill (G / P)</Text>
                <Text style={[styles.tableHeaderCell, styles.colMedium]}>Injuries</Text>
                <Text style={[styles.tableHeaderCell, styles.colNarrow]}>BV</Text>
                <Text style={[styles.tableHeaderCell, styles.colNarrow]}>Status</Text>
              </View>
              {pairedCombatElements.map(({ mech, pilot }) => (
                <View key={`${mech.id}-${pilot.id || 'np'}`} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.colWide]}>
                    {mech.name} ({mech.weight || 0}t)
                  </Text>
                  <Text style={[styles.tableCell, styles.colMedium]}>{pilot.name}</Text>
                  <Text style={[styles.tableCell, styles.colMedium]}>
                    G:{pilot.gunnery || 0} / P:{pilot.piloting || 0}
                  </Text>
                  <Text style={[styles.tableCell, styles.colMedium]}>
                    {pilot.injuries === 6 ? 'KIA' : `${pilot.injuries || 0}/6`}
                  </Text>
                  <Text style={[styles.tableCell, styles.colNarrow]}>{formatNumber(mech.bv || 0)}</Text>
                  <Text style={[styles.tableCell, styles.colNarrow, getStatusTagStyle(mech.status)]}>
                    {mech.status}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Unassigned mechs */}
          {unassignedMechs.length > 0 && (
            <>
              <Text style={[styles.sectionNote, { marginTop: 4 }]}>Unassigned Mechs</Text>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.colWide]}>Mech</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>Weight</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>BV</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>Pilot</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNarrow]}>Status</Text>
                </View>
                {unassignedMechs.map((mech) => (
                  <View key={mech.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colWide]}>{mech.name}</Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>{mech.weight || 0}t</Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>{formatNumber(mech.bv || 0)}</Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>Unassigned</Text>
                    <Text style={[styles.tableCell, styles.colNarrow, getStatusTagStyle(mech.status)]}>
                      {mech.status}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Unassigned pilots */}
          {unassignedPilots.length > 0 && (
            <>
              <Text style={[styles.sectionNote, { marginTop: 4 }]}>Unassigned Pilots</Text>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.colWide]}>Pilot</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>Skill (G / P)</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>Injuries</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>Assigned Mech</Text>
                </View>
                {unassignedPilots.map((pilot) => (
                  <View key={pilot.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colWide]}>{pilot.name}</Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>
                      G:{pilot.gunnery || 0} / P:{pilot.piloting || 0}
                    </Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>
                      {pilot.injuries === 6 ? 'KIA' : `${pilot.injuries || 0}/6`}
                    </Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>—</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Elementals as full combat units */}
          {elementals.length > 0 && (
            <>
              <Text style={[styles.sectionNote, { marginTop: 4 }]}>Elemental Points</Text>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.colWide]}>Unit</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>Commander</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>Gunnery / Antimech</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMedium]}>Casualties</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNarrow]}>BV</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNarrow]}>Status</Text>
                </View>
                {elementals.map((e) => (
                  <View key={e.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colWide]}>{e.name}</Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>{e.commander || '—'}</Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>
                      G:{e.gunnery || 0} / A:{e.antimech || 0}
                    </Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>
                      {e.suitsDestroyed || 0}/5 destroyed, {e.suitsDamaged || 0}/5 damaged
                    </Text>
                    <Text style={[styles.tableCell, styles.colNarrow]}>{formatNumber(e.bv || 0)}</Text>
                    <Text style={[styles.tableCell, styles.colNarrow, getStatusTagStyle(e.status)]}>
                      {e.status}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </PageChrome>
      </Page>

      {/* DETAIL PAGES – pilots, elementals, mechs, missions, ledger (logs fully retained) */}
      <Page size="A4" style={styles.page}>
        <PageChrome>
          {/* Pilot details */}
          <Text style={styles.sectionTitle} break>
            Pilot Roster
          </Text>
          <View style={styles.sectionRule} />
          {pilots.length > 0 ? (
            pilots.map((pilot) => {
              const assignedMech = findMechForPilot(force, pilot);
              const injuryLabel =
                pilot.injuries === 6 ? 'KIA' : `${pilot.injuries || 0}/6 injuries`;

              return (
                <View key={pilot.id} style={styles.recordBlock}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordName}>{pilot.name}</Text>
                    <Text style={styles.recordMeta}>{injuryLabel}</Text>
                  </View>
                  <View style={styles.recordSummaryRow}>
                    <View style={styles.recordSummaryItem}>
                      <Text style={styles.recordLabel}>Gunnery</Text>
                      <Text style={styles.recordValue}>{pilot.gunnery || 0}</Text>
                    </View>
                    <View style={styles.recordSummaryItem}>
                      <Text style={styles.recordLabel}>Piloting</Text>
                      <Text style={styles.recordValue}>{pilot.piloting || 0}</Text>
                    </View>
                    {assignedMech && (
                      <View style={styles.recordSummaryItem}>
                        <Text style={styles.recordLabel}>Assigned Mech</Text>
                        <Text style={styles.recordValue}>{assignedMech.name}</Text>
                      </View>
                    )}
                  </View>

                  {pilot.history && (
                    <Text style={styles.recordHistory}>{pilot.history}</Text>
                  )}

                  {pilot.activityLog && pilot.activityLog.length > 0 && (
                    <View>
                      <Text style={styles.missionSubheading}>Activity Log</Text>
                      {sortActivityLog(pilot.activityLog).map((entry, idx) => (
                        <View key={idx} style={styles.activityRow}>
                          <Text style={styles.activityDate}>{entry.timestamp || ''}</Text>
                          <Text style={styles.activityText}>{formatActivityLine(entry)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.recordDivider} />
                </View>
              );
            })
          ) : (
            <Text style={styles.sectionNote}>No pilots recorded for this force.</Text>
          )}

          {/* Elemental details */}
          <Text style={styles.sectionTitle} break>
            Elemental Roster
          </Text>
          <View style={styles.sectionRule} />
          {elementals.length > 0 ? (
            elementals.map((e) => (
              <View key={e.id} style={styles.recordBlock}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordName}>{e.name}</Text>
                  <Text style={styles.recordMeta}>{e.status}</Text>
                </View>
                <View style={styles.recordSummaryRow}>
                  <View style={styles.recordSummaryItem}>
                    <Text style={styles.recordLabel}>Commander</Text>
                    <Text style={styles.recordValue}>{e.commander || 'Unassigned'}</Text>
                  </View>
                  <View style={styles.recordSummaryItem}>
                    <Text style={styles.recordLabel}>Gunnery</Text>
                    <Text style={styles.recordValue}>{e.gunnery || 0}</Text>
                  </View>
                  <View style={styles.recordSummaryItem}>
                    <Text style={styles.recordLabel}>Antimech</Text>
                    <Text style={styles.recordValue}>{e.antimech || 0}</Text>
                  </View>
                  <View style={styles.recordSummaryItem}>
                    <Text style={styles.recordLabel}>BV</Text>
                    <Text style={styles.recordValue}>{formatNumber(e.bv || 0)}</Text>
                  </View>
                  <View style={styles.recordSummaryItem}>
                    <Text style={styles.recordLabel}>Casualties</Text>
                    <Text style={styles.recordValue}>
                      {e.suitsDestroyed || 0}/5 destroyed, {e.suitsDamaged || 0}/5 damaged
                    </Text>
                  </View>
                </View>

                {e.history && <Text style={styles.recordHistory}>{e.history}</Text>}

                {e.activityLog && e.activityLog.length > 0 && (
                  <View>
                    <Text style={styles.missionSubheading}>Activity Log</Text>
                    {sortActivityLog(e.activityLog).map((entry, idx) => (
                      <View key={idx} style={styles.activityRow}>
                        <Text style={styles.activityDate}>{entry.timestamp || ''}</Text>
                        <Text style={styles.activityText}>{formatActivityLine(entry)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.recordDivider} />
              </View>
            ))
          ) : (
            <Text style={styles.sectionNote}>No Elemental units recorded for this force.</Text>
          )}

          {/* Mech details */}
          <Text style={styles.sectionTitle} break>
            Mech Roster
          </Text>
          <View style={styles.sectionRule} />
          {mechs.length > 0 ? (
            mechs.map((mech) => {
              const pilot = findPilotForMech(force, mech);
              let pilotLabel = 'Missing Pilot';
              if (pilot) {
                if (pilot.injuries === 6) {
                  pilotLabel = `${pilot.name} – KIA`;
                } else {
                  pilotLabel = `${pilot.name} – G:${pilot.gunnery || 0} / P:${pilot.piloting || 0}`;
                }
              }

              return (
                <View key={mech.id} style={styles.recordBlock}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordName}>{mech.name}</Text>
                    <Text style={styles.recordMeta}>{mech.status}</Text>
                  </View>
                  <View style={styles.recordSummaryRow}>
                    <View style={styles.recordSummaryItem}>
                      <Text style={styles.recordLabel}>Pilot</Text>
                      <Text style={styles.recordValue}>{pilotLabel}</Text>
                    </View>
                    <View style={styles.recordSummaryItem}>
                      <Text style={styles.recordLabel}>BV</Text>
                      <Text style={styles.recordValue}>{formatNumber(mech.bv || 0)}</Text>
                    </View>
                    <View style={styles.recordSummaryItem}>
                      <Text style={styles.recordLabel}>Weight</Text>
                      <Text style={styles.recordValue}>{mech.weight || 0}t</Text>
                    </View>
                  </View>

                  {mech.history && <Text style={styles.recordHistory}>{mech.history}</Text>}

                  {mech.activityLog && mech.activityLog.length > 0 && (
                    <View>
                      <Text style={styles.missionSubheading}>Activity Log</Text>
                      {sortActivityLog(mech.activityLog).map((entry, idx) => (
                        <View key={idx} style={styles.activityRow}>
                          <Text style={styles.activityDate}>{entry.timestamp || ''}</Text>
                          <Text style={styles.activityText}>{formatActivityLine(entry)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.recordDivider} />
                </View>
              );
            })
          ) : (
            <Text style={styles.sectionNote}>No mechs recorded for this force.</Text>
          )}

          {/* Mission log */}
          <Text style={styles.sectionTitle} break>
            Mission Log
          </Text>
          <View style={styles.sectionRule} />
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
                <View key={mission.id} style={styles.missionEntry}>
                  <View style={styles.missionHeaderLine}>
                    <Text style={styles.missionTitle}>{mission.name || 'Unnamed Mission'}</Text>
                    <Text
                      style={[
                        styles.missionBadge,
                        !mission.completed && styles.missionBadgeActive,
                      ]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                  <Text style={styles.missionMetaLine}>
                    {missionDate && `Date: ${missionDate}  | `}
                    Cost: {formatNumber(mission.cost || 0)} WP  |  Gained: {formatNumber(reward || 0)} WP  |  Total BV: {formatNumber(totalBV || 0)}
                  </Text>

                  {mission.description && (
                    <View>
                      <Text style={styles.missionSubheading}>Description</Text>
                      <Text style={styles.missionText}>{mission.description}</Text>
                    </View>
                  )}

                  {Array.isArray(mission.objectives) && mission.objectives.length > 0 && (
                    <View>
                      <Text style={styles.missionSubheading}>Objectives</Text>
                      {mission.objectives.map((obj) => (
                        <Text key={obj.id} style={styles.missionListItem}>
                          {obj.achieved ? '[X]' : '[ ]'} {obj.title || 'Objective'}
                          {obj.wpReward > 0 && ` (+${formatNumber(obj.wpReward)} WP)`}
                        </Text>
                      ))}
                    </View>
                  )}

                  {assignedMechObjects.length > 0 && (
                    <View>
                      <Text style={styles.missionSubheading}>Assigned Mechs</Text>
                      {assignedMechObjects.map((m) => (
                        <Text key={m.id} style={styles.missionListItem}>
                          • {m.name} ({formatNumber(m.bv || 0)} BV, {m.status || 'Unknown'})
                        </Text>
                      ))}
                    </View>
                  )}

                  {assignedElementalObjects.length > 0 && (
                    <View>
                      <Text style={styles.missionSubheading}>Assigned Elementals</Text>
                      {assignedElementalObjects.map((e) => (
                        <Text key={e.id} style={styles.missionListItem}>
                          • {e.name} ({formatNumber(e.bv || 0)} BV, {e.status || 'Unknown'})
                        </Text>
                      ))}
                    </View>
                  )}

                  {mission.recap && (
                    <View>
                      <Text style={styles.missionSubheading}>After Action Report</Text>
                      <Text style={styles.missionText}>{mission.recap}</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.sectionNote}>No missions recorded for this force.</Text>
          )}

          {/* Warchest accounting */}
          <Text style={styles.sectionTitle} break>
            Warchest Accounting
          </Text>
          <View style={styles.sectionRule} />
          <View style={styles.warchestBox}>
            <View style={styles.warchestHeaderRow}>
              <Text style={styles.warchestHeaderText}>Financial Ledger</Text>
              <Text style={styles.warchestHeaderText}>
                Starting: {formatNumber(startingWarchest)} WP | Current: {formatNumber(currentWarchest)} WP
              </Text>
            </View>

            {ledgerEntries.length > 0 ? (
              <>
                <View style={styles.warchestTableHeader}>
                  <Text style={[styles.warchestCell, styles.warchestColDate]}>Date</Text>
                  <Text style={[styles.warchestCell, styles.warchestColType]}>Type</Text>
                  <Text style={[styles.warchestCell, styles.warchestColUnit]}>Unit/Mission</Text>
                  <Text style={[styles.warchestCell, styles.warchestColDesc]}>Description</Text>
                  <Text style={[styles.warchestCell, styles.warchestColCost]}>Cost</Text>
                  <Text style={[styles.warchestCell, styles.warchestColGain]}>Gain</Text>
                </View>

                {ledgerEntries.map((entry, idx) => (
                  <View key={idx} style={styles.warchestTableRow}>
                    <Text style={[styles.warchestCell, styles.warchestColDate]}>{entry.timestamp}</Text>
                    <Text style={[styles.warchestCell, styles.warchestColType]}>{entry.sourceType}</Text>
                    <Text style={[styles.warchestCell, styles.warchestColUnit]}>{entry.unitName}</Text>
                    <Text style={[styles.warchestCell, styles.warchestColDesc]}>{entry.description}</Text>
                    <Text
                      style={[
                        styles.warchestCell,
                        styles.warchestColCost,
                        entry.cost < 0 ? styles.warchestCostNeg : null,
                      ]}
                    >
                      {entry.cost < 0 ? `-${formatNumber(Math.abs(entry.cost))}` : ''}
                    </Text>
                    <Text
                      style={[
                        styles.warchestCell,
                        styles.warchestColGain,
                        entry.gain > 0 ? styles.warchestGainPos : null,
                      ]}
                    >
                      {entry.gain > 0 ? `+${formatNumber(entry.gain)}` : ''}
                    </Text>
                  </View>
                ))}

                <Text style={styles.warchestSummary}>
                  Total Spent: -{formatNumber(Math.abs(totalSpent))} WP | Total Gained: +
                  {formatNumber(totalGained)} WP | Net: {formatNumber(totalGained + totalSpent)} WP | Current
                  Warchest: {formatNumber(currentWarchest)} WP
                </Text>
              </>
            ) : (
              <Text style={styles.sectionNote}>No warchest-affecting actions recorded.</Text>
            )}
          </View>
        </PageChrome>
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
      const fileName = `${safeName}_Force_Dossier.pdf`;

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
