import React, { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
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

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  } catch {
    return '';
  }
};

// Military-themed styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#FFFFFF',
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
  const otherActionsLog = force.otherActionsLog || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Force Information Header */}
        <View style={styles.coverSection}>
          <Text style={styles.forceTitle}>{force.name}</Text>
          <Text style={styles.forceSubtitle}>
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
          </View>
        </View>

        {/* Pilot Roster Section */}
        <Text style={styles.sectionHeader} break>
          █ PILOT ROSTER
        </Text>
        {pilots.length > 0 ? (
          pilots.map((pilot) => {
            const assignedMech = findMechForPilot(force, pilot);

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
                {pilot.history && (
                  <View style={styles.unitHistory}>
                    <Text>{pilot.history}</Text>
                  </View>
                )}
                {pilot.activityLog && pilot.activityLog.length > 0 && (
                  <View style={styles.missionSection}>
                    <Text style={styles.missionSectionTitle}>Activity Log:</Text>
                    {pilot.activityLog.map((entry, idx) => (
                      <Text key={idx} style={styles.missionText}>
                        {entry.inGameDate ? `${entry.inGameDate}` : formatDateTime(entry.timestamp)} – {entry.action}
                        {entry.mission ? ` [${entry.mission}]` : ''}
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
                  {elemental.activityLog.map((entry, idx) => (
                    <Text key={idx} style={styles.missionText}>
                      {formatDateTime(entry.timestamp)} – {entry.action}
                      {entry.mission ? ` [${entry.mission}]` : ''}
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
                    {mech.activityLog.map((entry, idx) => (
                      <Text key={idx} style={styles.missionText}>
                        {formatDateTime(entry.timestamp)} – {entry.action}
                        {entry.mission ? ` [${entry.mission}]` : ''}
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

            return (
              <View key={mission.id} style={styles.missionCard} wrap={false}>
                <View style={styles.missionHeader}>
                  <Text style={styles.missionName}>{mission.name || 'Unnamed Mission'}</Text>
                  <Text style={styles.missionMeta}>
                    Status: {statusLabel}
                    {mission.createdAt
                      ? ` | Created: ${formatDateTime(mission.createdAt)}`
                      : ''}
                    {mission.completedAt
                      ? ` | Completed: ${formatDateTime(mission.completedAt)}`
                      : ''}
                    {mission.updatedAt
                      ? ` | Updated: ${formatDateTime(mission.updatedAt)}`
                      : ''}
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

        {/* Other Actions History */}
        <Text style={styles.sectionHeader} break>
          █ OTHER ACTIONS HISTORY
        </Text>
        {otherActionsLog.length > 0 ? (
          otherActionsLog
            .slice()
            .sort((a, b) => {
              // oldest first
              const da = new Date(a.timestamp || 0).getTime();
              const db = new Date(b.timestamp || 0).getTime();
              return da - db;
            })
            .map((entry, idx) => (
              <View key={idx} style={styles.missionCard} wrap={false}>
                <Text style={styles.missionMeta}>{formatDateTime(entry.timestamp)}</Text>
                <Text style={styles.missionText}>{entry.description}</Text>
                <Text style={styles.missionMeta}>
                  Cost: -{formatNumber(entry.cost || 0)} WP
                </Text>
              </View>
            ))
        ) : (
          <Text style={styles.missionText}>No other downtime actions recorded.</Text>
        )}

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
