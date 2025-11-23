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

// --------- Helpers ---------

// Safe number formatter for PDF (uses apostrophe as thousands separator)
const formatNumber = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '0';
  const n = Number(num);
  if (Number.isNaN(n)) return '0';
  return n
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};

// Only allow PNG/JPG/JPEG images; ignore others
const getImageSrc = (url) => {
  if (!url || typeof url !== 'string') return null;
  const lower = url.toLowerCase();
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return url;
  return null;
};

// Sort activity logs by timestamp string ascending
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

// Count units by status (Operational / Damaged / Destroyed / other)
const countByStatus = (items = []) => {
  const result = {
    total: items.length,
    operational: 0,
    damaged: 0,
    destroyed: 0,
    other: 0,
  };

  items.forEach((item) => {
    const status = (item?.status || '').toLowerCase();
    if (status === 'operational') result.operational += 1;
    else if (status === 'damaged') result.damaged += 1;
    else if (status === 'destroyed') result.destroyed += 1;
    else result.other += 1;
  });

  return result;
};

// --------- Styles ---------

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#4B5563',
    marginBottom: 10,
  },
  forceName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  forceDescription: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 2,
  },
  sectionRule: {
    height: 1,
    backgroundColor: '#D1D5DB',
    marginBottom: 4,
  },
  sectionNote: {
    fontSize: 8,
    color: '#6B7280',
    marginBottom: 4,
  },
  // Overview stats
  statsRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 4,
  },
  statBlock: {
    flex: 1,
    padding: 6,
    marginRight: 6,
    backgroundColor: '#F9FAFB',
  },
  statLabel: {
    fontSize: 7,
    textTransform: 'uppercase',
    color: '#6B7280',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  // Tables
  table: {
    marginTop: 4,
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
  },
  tableCell: {
    fontSize: 8,
    color: '#111827',
  },
  flex3: { flex: 3 },
  flex2: { flex: 2 },
  flex1: { flex: 1 },
  flex05: { flexGrow: 0.5, flexShrink: 0.5, flexBasis: 0 },
  statusTag: {
    fontSize: 7,
    textTransform: 'uppercase',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    color: '#FFFFFF',
    backgroundColor: '#16A34A',
  },
  statusDamaged: { backgroundColor: '#F59E0B' },
  statusDestroyed: { backgroundColor: '#DC2626' },
  statusOther: { backgroundColor: '#6B7280' },
  // Image
  imageWrapper: {
    marginTop: 6,
    marginBottom: 6,
  },
  image: {
    maxWidth: 110,
    maxHeight: 110,
  },
  // Record blocks (pilots, mechs, elementals)
  recordBlock: {
    marginTop: 4,
    marginBottom: 4,
  },
  recordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  recordName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  recordMeta: {
    fontSize: 8,
    color: '#6B7280',
  },
  recordLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 1,
  },
  recordLabel: {
    fontSize: 8,
    color: '#6B7280',
    marginRight: 3,
  },
  recordValue: {
    fontSize: 8,
    color: '#111827',
    marginRight: 8,
  },
  recordHistory: {
    fontSize: 8,
    color: '#374151',
    marginTop: 2,
  },
  activityRow: {
    flexDirection: 'row',
    marginTop: 1,
  },
  activityDate: {
    fontSize: 8,
    color: '#6B7280',
    width: 80,
  },
  activityText: {
    fontSize: 8,
    color: '#111827',
    flex: 1,
  },
  // Mission log
  missionEntry: {
    marginTop: 4,
    marginBottom: 4,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#9CA3AF',
    borderLeftStyle: 'solid',
  },
  missionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  missionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  missionStatus: {
    fontSize: 7,
    textTransform: 'uppercase',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    color: '#FFFFFF',
    backgroundColor: '#16A34A',
  },
  missionStatusActive: { backgroundColor: '#3B82F6' },
  missionMeta: {
    fontSize: 8,
    color: '#4B5563',
    marginBottom: 1,
  },
  missionSubheading: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4B5563',
    marginTop: 2,
  },
  missionText: {
    fontSize: 8,
    color: '#111827',
  },
  // Ledger
  ledgerBox: {
    marginTop: 4,
    padding: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'solid',
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  ledgerHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
  },
  ledgerRow: {
    flexDirection: 'row',
    paddingVertical: 1,
  },
  ledgerCell: {
    fontSize: 8,
    color: '#111827',
  },
  ledgerDate: { width: 70 },
  ledgerType: { width: 60 },
  ledgerUnit: { width: 100 },
  ledgerDesc: { flex: 1 },
  ledgerCost: { width: 50, textAlign: 'right' },
  ledgerGain: { width: 50, textAlign: 'right' },
  ledgerCostNeg: { color: '#B91C1C', fontWeight: 'bold' },
  ledgerGainPos: { color: '#166534', fontWeight: 'bold' },
  ledgerSummary: {
    marginTop: 3,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderTopStyle: 'solid',
    paddingTop: 2,
    fontSize: 8,
    color: '#111827',
  },
  // Footer page number
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

const getStatusTagStyle = (status) => {
  const base = styles.statusTag;
  const lower = (status || '').toLowerCase();
  if (lower === 'damaged') return [base, styles.statusDamaged];
  if (lower === 'destroyed') return [base, styles.statusDestroyed];
  if (!lower || lower === 'operational') return base;
  return [base, styles.statusOther];
};

// --------- PDF Content ---------

const ForcePDF = ({ force }) => {
  const mechs = Array.isArray(force.mechs) ? force.mechs : [];
  const pilots = Array.isArray(force.pilots) ? force.pilots : [];
  const elementals = Array.isArray(force.elementals) ? force.elementals : [];
  const missions = Array.isArray(force.missions) ? force.missions : [];

  const currentWarchest =
    typeof force.currentWarchest === 'number'
      ? force.currentWarchest
      : typeof force.warchest === 'number'
        ? force.warchest
        : 0;

  const startingWarchest = typeof force.startingWarchest === 'number' ? force.startingWarchest : 0;
  const currentDateLabel = force.currentDate || '';

  // Pairings for order of battle
  const usedPilotIds = new Set();
  const mechPilotPairs = [];
  const unassignedMechs = [];

  mechs.forEach((mech) => {
    const pilot = findPilotForMech(force, mech);
    if (pilot) {
      mechPilotPairs.push({ mech, pilot });
      if (pilot.id != null) usedPilotIds.add(pilot.id);
    } else {
      unassignedMechs.push(mech);
    }
  });

  const unassignedPilots = pilots.filter((p) => !usedPilotIds.has(p.id));

  // Status summaries
  const mechStats = countByStatus(mechs);
  const elementalStats = countByStatus(elementals);

  // Ledger data (shared with web app)
  const ledgerEntries = buildLedgerEntries(force);
  const { totalSpent, totalGained } = summariseLedger(
    ledgerEntries,
    currentWarchest,
    startingWarchest,
  );

  const forceImageSrc = getImageSrc(force.image);

  return (
    <Document>
      {/* COVER / FORCE OVERVIEW PAGE */}
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.headerTitle}>Battletech Force Dossier</Text>
          <Text style={styles.headerSubtitle}>Classic BattleTech Warchest Campaign / Force Overview</Text>

          <Text style={styles.forceName}>{force.name}</Text>
          {force.description ? (
            <Text style={styles.forceDescription}>{force.description}</Text>
          ) : null}

          {forceImageSrc && (
            <View style={styles.imageWrapper}>
              <Image style={styles.image} src={forceImageSrc} />
            </View>
          )}

          {/* Key stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Current Warchest</Text>
              <Text style={styles.statValue}>{formatNumber(currentWarchest)} WP</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Starting Warchest</Text>
              <Text style={styles.statValue}>{formatNumber(startingWarchest)} WP</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Order of Battle</Text>
              <Text style={styles.statValue}>
                {mechs.length} Mechs, {elementals.length} Elemental units, {pilots.length} Pilots
              </Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Missions & Date</Text>
              <Text style={styles.statValue}>
                {missions.length} Missions · Date {currentDateLabel || '—'}
              </Text>
            </View>
          </View>

          {/* High-level OOB summary */}
          <Text style={styles.sectionTitle}>Order of Battle Summary</Text>
          <View style={styles.sectionRule} />

          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.flex2]}>Element Type</Text>
              <Text style={[styles.tableHeaderCell, styles.flex1]}>Total</Text>
              <Text style={[styles.tableHeaderCell, styles.flex1]}>Operational</Text>
              <Text style={[styles.tableHeaderCell, styles.flex1]}>Damaged</Text>
              <Text style={[styles.tableHeaderCell, styles.flex1]}>Destroyed</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.flex2]}>BattleMechs</Text>
              <Text style={[styles.tableCell, styles.flex1]}>{mechStats.total}</Text>
              <Text style={[styles.tableCell, styles.flex1]}>{mechStats.operational}</Text>
              <Text style={[styles.tableCell, styles.flex1]}>{mechStats.damaged}</Text>
              <Text style={[styles.tableCell, styles.flex1]}>{mechStats.destroyed}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.flex2]}>Elemental Units</Text>
              <Text style={[styles.tableCell, styles.flex1]}>{elementalStats.total}</Text>
              <Text style={[styles.tableCell, styles.flex1]}>{elementalStats.operational}</Text>
              <Text style={[styles.tableCell, styles.flex1]}>{elementalStats.damaged}</Text>
              <Text style={[styles.tableCell, styles.flex1]}>{elementalStats.destroyed}</Text>
            </View>
          </View>

          {/* Page number */}
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </View>
      </Page>

      {/* MAIN CONTENT PAGE(S) – OOB, detailed rosters, missions, ledger */}
      <Page size="A4" style={styles.page}>
        {/* ORDER OF BATTLE */}
        <Text style={styles.sectionTitle}>Order of Battle</Text>
        <View style={styles.sectionRule} />
        <Text style={styles.sectionNote}>
          Battle-ready elements, including mech–pilot pairings and Elemental units. Elementals are treated as
          full combat forces.
        </Text>

        {/* Mech + pilot pairs */}
        {mechPilotPairs.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.flex3]}>Mech</Text>
              <Text style={[styles.tableHeaderCell, styles.flex2]}>Pilot</Text>
              <Text style={[styles.tableHeaderCell, styles.flex1]}>G / P</Text>
              <Text style={[styles.tableHeaderCell, styles.flex1]}>Injuries</Text>
              <Text style={[styles.tableHeaderCell, styles.flex1]}>BV</Text>
              <Text style={[styles.tableHeaderCell, styles.flex1]}>Status</Text>
            </View>
            {mechPilotPairs.map(({ mech, pilot }) => (
              <View key={`${mech.id}-${pilot.id || 'np'}`} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, styles.flex3]}>
                  {mech.name} ({mech.weight || 0}t)
                </Text>
                <Text style={[styles.tableCell, styles.flex2]}>{pilot.name}</Text>
                <Text style={[styles.tableCell, styles.flex1]}>
                  G:{pilot.gunnery || 0} / P:{pilot.piloting || 0}
                </Text>
                <Text style={[styles.tableCell, styles.flex1]}>
                  {pilot.injuries === 6 ? 'KIA' : `${pilot.injuries || 0}/6`}
                </Text>
                <Text style={[styles.tableCell, styles.flex1]}>{formatNumber(mech.bv || 0)}</Text>
                <Text style={[styles.tableCell, styles.flex1, getStatusTagStyle(mech.status)]}>{mech.status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Unassigned mechs */}
        {unassignedMechs.length > 0 && (
          <>
            <Text style={styles.sectionNote}>Unassigned Mechs</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.flex3]}>Mech</Text>
                <Text style={[styles.tableHeaderCell, styles.flex1]}>Weight</Text>
                <Text style={[styles.tableHeaderCell, styles.flex1]}>BV</Text>
                <Text style={[styles.tableHeaderCell, styles.flex1]}>Status</Text>
              </View>
              {unassignedMechs.map((mech) => (
                <View key={mech.id} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, styles.flex3]}>{mech.name}</Text>
                  <Text style={[styles.tableCell, styles.flex1]}>{mech.weight || 0}t</Text>
                  <Text style={[styles.tableCell, styles.flex1]}>{formatNumber(mech.bv || 0)}</Text>
                  <Text style={[styles.tableCell, styles.flex1, getStatusTagStyle(mech.status)]}>{mech.status}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Unassigned pilots */}
        {unassignedPilots.length > 0 && (
          <>
            <Text style={styles.sectionNote}>Unassigned Pilots</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.flex3]}>Pilot</Text>
                <Text style={[styles.tableHeaderCell, styles.flex1]}>G / P</Text>
                <Text style={[styles.tableHeaderCell, styles.flex1]}>Injuries</Text>
              </View>
              {unassignedPilots.map((pilot) => (
                <View key={pilot.id} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, styles.flex3]}>{pilot.name}</Text>
                  <Text style={[styles.tableCell, styles.flex1]}>
                    G:{pilot.gunnery || 0} / P:{pilot.piloting || 0}
                  </Text>
                  <Text style={[styles.tableCell, styles.flex1]}>
                    {pilot.injuries === 6 ? 'KIA' : `${pilot.injuries || 0}/6`}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Elemental combat units */}
        {elementals.length > 0 && (
          <>
            <Text style={styles.sectionNote}>Elemental Units</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.flex3]}>Unit</Text>
                <Text style={[styles.tableHeaderCell, styles.flex2]}>Commander</Text>
                <Text style={[styles.tableHeaderCell, styles.flex1]}>G / Anti</Text>
                <Text style={[styles.tableHeaderCell, styles.flex2]}>Casualties</Text>
                <Text style={[styles.tableHeaderCell, styles.flex1]}>BV</Text>
                <Text style={[styles.tableHeaderCell, styles.flex1]}>Status</Text>
              </View>
              {elementals.map((e) => (
                <View key={e.id} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, styles.flex3]}>{e.name}</Text>
                  <Text style={[styles.tableCell, styles.flex2]}>{e.commander || '—'}</Text>
                  <Text style={[styles.tableCell, styles.flex1]}>
                    G:{e.gunnery || 0} / A:{e.antimech || 0}
                  </Text>
                  <Text style={[styles.tableCell, styles.flex2]}>
                    {e.suitsDestroyed || 0}/5 destroyed, {e.suitsDamaged || 0}/5 damaged
                  </Text>
                  <Text style={[styles.tableCell, styles.flex1]}>{formatNumber(e.bv || 0)}</Text>
                  <Text style={[styles.tableCell, styles.flex1, getStatusTagStyle(e.status)]}>{e.status}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* PILOT DETAILS */}
        <Text style={styles.sectionTitle} break>
          Pilot Roster
        </Text>
        <View style={styles.sectionRule} />
        {pilots.length === 0 && <Text style={styles.sectionNote}>No pilots recorded for this force.</Text>}
        {pilots.map((pilot) => {
          const assignedMech = findMechForPilot(force, pilot);
          const pilotImageSrc = getImageSrc(pilot.image);
          const injuryLabel = pilot.injuries === 6 ? 'KIA' : `${pilot.injuries || 0}/6 injuries`;

          return (
            <View key={pilot.id} style={styles.recordBlock} wrap={false}>
              <View style={styles.recordHeaderRow}>
                <Text style={styles.recordName}>{pilot.name}</Text>
                <Text style={styles.recordMeta}>{injuryLabel}</Text>
              </View>
              {pilotImageSrc && (
                <View style={styles.imageWrapper}>
                  <Image style={styles.image} src={pilotImageSrc} />
                </View>
              )}
              <View style={styles.recordLine}>
                <Text style={styles.recordLabel}>Gunnery</Text>
                <Text style={styles.recordValue}>{pilot.gunnery || 0}</Text>

                <Text style={styles.recordLabel}>Piloting</Text>
                <Text style={styles.recordValue}>{pilot.piloting || 0}</Text>

                {assignedMech && (
                  <>
                    <Text style={styles.recordLabel}>Assigned Mech</Text>
                    <Text style={styles.recordValue}>{assignedMech.name}</Text>
                  </>
                )}
              </View>
              {pilot.history && <Text style={styles.recordHistory}>{pilot.history}</Text>}
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
            </View>
          );
        })}

        {/* ELEMENTAL DETAILS */}
        <Text style={styles.sectionTitle} break>
          Elemental Roster
        </Text>
        <View style={styles.sectionRule} />
        {elementals.length === 0 && (
          <Text style={styles.sectionNote}>No Elemental units recorded for this force.</Text>
        )}
        {elementals.map((e) => {
          const elemImageSrc = getImageSrc(e.image);
          return (
            <View key={e.id} style={styles.recordBlock} wrap={false}>
              <View style={styles.recordHeaderRow}>
                <Text style={styles.recordName}>{e.name}</Text>
                <Text style={styles.recordMeta}>{e.status || 'Unknown'}</Text>
              </View>
              {elemImageSrc && (
                <View style={styles.imageWrapper}>
                  <Image style={styles.image} src={elemImageSrc} />
                </View>
              )}
              <View style={styles.recordLine}>
                <Text style={styles.recordLabel}>Commander</Text>
                <Text style={styles.recordValue}>{e.commander || 'Unassigned'}</Text>

                <Text style={styles.recordLabel}>Gunnery</Text>
                <Text style={styles.recordValue}>{e.gunnery || 0}</Text>

                <Text style={styles.recordLabel}>Antimech</Text>
                <Text style={styles.recordValue}>{e.antimech || 0}</Text>

                <Text style={styles.recordLabel}>BV</Text>
                <Text style={styles.recordValue}>{formatNumber(e.bv || 0)}</Text>
              </View>
              <View style={styles.recordLine}>
                <Text style={styles.recordLabel}>Casualties</Text>
                <Text style={styles.recordValue}>
                  {e.suitsDestroyed || 0}/5 destroyed, {e.suitsDamaged || 0}/5 damaged
                </Text>
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
            </View>
          );
        })}

        {/* MECH DETAILS */}
        <Text style={styles.sectionTitle} break>
          Mech Roster
        </Text>
        <View style={styles.sectionRule} />
        {mechs.length === 0 && <Text style={styles.sectionNote}>No Mechs recorded for this force.</Text>}
        {mechs.map((mech) => {
          const pilot = findPilotForMech(force, mech);
          const mechImageSrc = getImageSrc(mech.image);

          let pilotLabel = 'Missing Pilot';
          if (pilot) {
            if (pilot.injuries === 6) pilotLabel = `${pilot.name} – KIA`;
            else pilotLabel = `${pilot.name} – G:${pilot.gunnery || 0} / P:${pilot.piloting || 0}`;
          }

          return (
            <View key={mech.id} style={styles.recordBlock} wrap={false}>
              <View style={styles.recordHeaderRow}>
                <Text style={styles.recordName}>{mech.name}</Text>
                <Text style={styles.recordMeta}>{mech.status || 'Unknown'}</Text>
              </View>
              {mechImageSrc && (
                <View style={styles.imageWrapper}>
                  <Image style={styles.image} src={mechImageSrc} />
                </View>
              )}
              <View style={styles.recordLine}>
                <Text style={styles.recordLabel}>Pilot</Text>
                <Text style={styles.recordValue}>{pilotLabel}</Text>

                <Text style={styles.recordLabel}>BV</Text>
                <Text style={styles.recordValue}>{formatNumber(mech.bv || 0)}</Text>

                <Text style={styles.recordLabel}>Weight</Text>
                <Text style={styles.recordValue}>{mech.weight || 0}t</Text>
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
            </View>
          );
        })}

        {/* MISSION LOG */}
        <Text style={styles.sectionTitle} break>
          Mission Log
        </Text>
        <View style={styles.sectionRule} />
        {missions.length === 0 && (
          <Text style={styles.sectionNote}>No missions recorded for this force.</Text>
        )}
        {missions.map((mission) => {
          const assignedMechIds = mission.assignedMechs || [];
          const assignedElementalIds = mission.assignedElementals || [];
          const assignedMechObjects = getAssignedMechs(force, assignedMechIds);
          const assignedElementalObjects = getAssignedElementals(force, assignedElementalIds);
          const totalBV = calculateMissionTotalBV(force, assignedMechIds, assignedElementalIds);

          const statusLabel = mission.completed ? 'COMPLETED' : 'ACTIVE';
          const missionDate = mission.createdAt || '';
          const reward = getMissionObjectiveReward(mission) || 0;

          const statusStyles = [styles.missionStatus];
          if (!mission.completed) statusStyles.push(styles.missionStatusActive);

          return (
            <View key={mission.id} style={styles.missionEntry} wrap={false}>
              <View style={styles.missionHeaderRow}>
                <Text style={styles.missionTitle}>{mission.name || 'Unnamed Mission'}</Text>
                <Text style={statusStyles}>{statusLabel}</Text>
              </View>
              <Text style={styles.missionMeta}>
                {missionDate ? `Date: ${missionDate} | ` : ''}
                Cost: {formatNumber(mission.cost || 0)} WP | Gained: {formatNumber(reward)} WP | Total BV:{' '}
                {formatNumber(totalBV || 0)}
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
                    <Text key={obj.id} style={styles.missionText}>
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
                    <Text key={m.id} style={styles.missionText}>
                      • {m.name} ({formatNumber(m.bv || 0)} BV, {m.status || 'Unknown'})
                    </Text>
                  ))}
                </View>
              )}

              {assignedElementalObjects.length > 0 && (
                <View>
                  <Text style={styles.missionSubheading}>Assigned Elementals</Text>
                  {assignedElementalObjects.map((e) => (
                    <Text key={e.id} style={styles.missionText}>
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
        })}

        {/* WARCHEST LEDGER – uses same mechanics as web app via helpers */}
        <Text style={styles.sectionTitle} break>
          Warchest Ledger
        </Text>
        <View style={styles.sectionRule} />
        <View style={styles.ledgerBox}>
          <View style={styles.ledgerHeaderRow}>
            <Text style={styles.ledgerHeaderText}>Financial Ledger</Text>
            <Text style={styles.ledgerHeaderText}>
              Starting: {formatNumber(startingWarchest)} WP · Current: {formatNumber(currentWarchest)} WP
            </Text>
          </View>

          {ledgerEntries.length === 0 && (
            <Text style={styles.sectionNote}>No warchest-affecting actions recorded.</Text>
          )}

          {ledgerEntries.map((entry, idx) => {
            const costStyles = [styles.ledgerCell, styles.ledgerCost];
            if (entry.cost < 0) costStyles.push(styles.ledgerCostNeg);

            const gainStyles = [styles.ledgerCell, styles.ledgerGain];
            if (entry.gain > 0) gainStyles.push(styles.ledgerGainPos);

            return (
              <View key={idx} style={styles.ledgerRow} wrap={false}>
                <Text style={[styles.ledgerCell, styles.ledgerDate]}>{entry.timestamp}</Text>
                <Text style={[styles.ledgerCell, styles.ledgerType]}>{entry.sourceType}</Text>
                <Text style={[styles.ledgerCell, styles.ledgerUnit]}>{entry.unitName}</Text>
                <Text style={[styles.ledgerCell, styles.ledgerDesc]}>{entry.description}</Text>
                <Text style={costStyles}>
                  {entry.cost < 0 ? `-${formatNumber(Math.abs(entry.cost))}` : ''}
                </Text>
                <Text style={gainStyles}>
                  {entry.gain > 0 ? `+${formatNumber(entry.gain)}` : ''}
                </Text>
              </View>
            );
          })}

          {ledgerEntries.length > 0 && (
            <Text style={styles.ledgerSummary}>
              Total Spent: -{formatNumber(Math.abs(totalSpent))} WP · Total Gained: +
              {formatNumber(totalGained)} WP · Net: {formatNumber(totalGained + totalSpent)} WP · Current Warchest:{' '}
              {formatNumber(currentWarchest)} WP
            </Text>
          )}
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

// --------- Export Button Wrapper ---------

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
