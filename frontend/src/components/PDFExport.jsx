import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';

// Safe number formatter for PDF
const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
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
    return styles.unitBadge;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Force Information Header */}
        <View style={styles.coverSection}>
          <Text style={styles.forceTitle}>{force.name}</Text>
          <Text style={styles.forceSubtitle}>{force.description || 'Elite mercenary unit'}</Text>
          
          <View style={styles.forceStatsRow}>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Warchest</Text>
              <Text style={styles.forceStatValue}>{formatNumber(force.warchest)} WP</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Starting Warchest</Text>
              <Text style={styles.forceStatValue}>{formatNumber(force.startingWarchest)} WP</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Mechs</Text>
              <Text style={styles.forceStatValue}>{force.mechs?.length || 0}</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Pilots</Text>
              <Text style={styles.forceStatValue}>{force.pilots?.length || 0}</Text>
            </View>
          </View>
          <View style={styles.forceStatsRow}>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Elementals</Text>
              <Text style={styles.forceStatValue}>{force.elementals?.length || 0}</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>Missions</Text>
              <Text style={styles.forceStatValue}>{force.missions?.length || 0}</Text>
            </View>
            <View style={styles.forceStatBox}>
              <Text style={styles.forceStatLabel}>WP Multiplier</Text>
              <Text style={styles.forceStatValue}>{force.wpMultiplier || 1.0}x</Text>
            </View>
          </View>
        </View>

        {/* Pilot Roster Section */}
        <Text style={styles.sectionHeader} break>█ PILOT ROSTER</Text>
        {force.pilots && force.pilots.length > 0 ? (
          force.pilots.map((pilot, index) => (
            <View key={pilot.id} style={styles.unitCard} wrap={false}>
              <View style={styles.unitHeader}>
                <Text style={styles.unitName}>{pilot.name}</Text>
                <Text style={styles.unitBadge}>
                  {pilot.injuries === 6 ? 'KIA' : `Injuries: ${pilot.injuries}/6`}
                </Text>
              </View>
              <View style={styles.unitStatsGrid}>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Gunnery:</Text>
                  <Text style={styles.unitStatValue}>{pilot.gunnery}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Piloting:</Text>
                  <Text style={styles.unitStatValue}>{pilot.piloting}</Text>
                </View>
              </View>
              {pilot.history && (
                <View style={styles.unitHistory}>
                  <Text>{pilot.history}</Text>
                </View>
              )}
              {pilot.activityLog && pilot.activityLog.length > 0 && (
                <View style={styles.missionSection}>
                  <Text style={styles.missionSectionTitle}>Recent Activity:</Text>
                  <Text style={styles.missionText}>
                    {pilot.activityLog[pilot.activityLog.length - 1].action}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.missionText}>No pilots assigned to this force.</Text>
        )}

        {/* Elemental Roster Section */}
        <Text style={styles.sectionHeader} break>█ ELEMENTAL ROSTER</Text>
        {force.elementals && force.elementals.length > 0 ? (
          force.elementals.map((elemental, index) => (
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
                  <Text style={styles.unitStatValue}>{elemental.gunnery}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Antimech:</Text>
                  <Text style={styles.unitStatValue}>{elemental.antimech}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>BV:</Text>
                  <Text style={styles.unitStatValue}>{formatNumber(elemental.bv)}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Suits Destroyed:</Text>
                  <Text style={styles.unitStatValue}>{elemental.suitsDestroyed}/4</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Suits Damaged:</Text>
                  <Text style={styles.unitStatValue}>{elemental.suitsDamaged}/5</Text>
                </View>
              </View>
              {elemental.history && (
                <View style={styles.unitHistory}>
                  <Text>{elemental.history}</Text>
                </View>
              )}
              {elemental.activityLog && elemental.activityLog.length > 0 && (
                <View style={styles.missionSection}>
                  <Text style={styles.missionSectionTitle}>Recent Activity:</Text>
                  <Text style={styles.missionText}>
                    {elemental.activityLog[elemental.activityLog.length - 1].action}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.missionText}>No elemental points assigned to this force.</Text>
        )}

        {/* Mech Information Section */}
        <Text style={styles.sectionHeader} break>█ MECH INFORMATION</Text>
        {force.mechs && force.mechs.length > 0 ? (
          force.mechs.map((mech, index) => (
            <View key={mech.id} style={styles.unitCard} wrap={false}>
              <View style={styles.unitHeader}>
                <Text style={styles.unitName}>{mech.name}</Text>
                <Text style={getStatusBadgeStyle(mech.status)}>{mech.status}</Text>
              </View>
              <View style={styles.unitStatsGrid}>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Pilot:</Text>
                  <Text style={styles.unitStatValue}>{mech.pilot || 'Unassigned'}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>BV:</Text>
                  <Text style={styles.unitStatValue}>{formatNumber(mech.bv)}</Text>
                </View>
                <View style={styles.unitStatItem}>
                  <Text style={styles.unitStatLabel}>Weight:</Text>
                  <Text style={styles.unitStatValue}>{mech.weight}t</Text>
                </View>
              </View>
              {mech.history && (
                <View style={styles.unitHistory}>
                  <Text>{mech.history}</Text>
                </View>
              )}
              {mech.activityLog && mech.activityLog.length > 0 && (
                <View style={styles.missionSection}>
                  <Text style={styles.missionSectionTitle}>Recent Activity:</Text>
                  <Text style={styles.missionText}>
                    {mech.activityLog[mech.activityLog.length - 1].action}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.missionText}>No mechs assigned to this force.</Text>
        )}

        {/* Mission Log Section */}
        <Text style={styles.sectionHeader} break>█ MISSION LOG</Text>
        {force.missions && force.missions.length > 0 ? (
          force.missions.map((mission, index) => (
            <View key={mission.id} style={styles.missionCard} wrap={false}>
              <View style={styles.missionHeader}>
                <Text style={styles.missionName}>{mission.name}</Text>
                <Text style={styles.missionMeta}>
                  Cost: {formatNumber(mission.cost)} WP | Gained: {formatNumber(mission.gained)} WP | Total BV: {formatNumber(mission.totalBV || 0)}
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
              
              {mission.assignedMechs && mission.assignedMechs.length > 0 && (
                <View style={styles.missionSection}>
                  <Text style={styles.missionSectionTitle}>Assigned Mechs:</Text>
                  <Text style={styles.missionUnits}>{mission.assignedMechs.join(', ')}</Text>
                </View>
              )}
              
              {mission.assignedElementals && mission.assignedElementals.length > 0 && (
                <View style={styles.missionSection}>
                  <Text style={styles.missionSectionTitle}>Assigned Elementals:</Text>
                  <Text style={styles.missionUnits}>{mission.assignedElementals.join(', ')}</Text>
                </View>
              )}
              
              {mission.recap && (
                <View style={styles.missionSection}>
                  <Text style={styles.missionSectionTitle}>After Action Report:</Text>
                  <Text style={styles.missionText}>{mission.recap}</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.missionText}>No missions recorded for this force.</Text>
        )}

        {/* Page Number */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `${pageNumber} / ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default function PDFExport({ force }) {
  if (!force) return null;

  const fileName = `${force.name.replace(/\s+/g, '_')}_Force_Report.pdf`;

  return (
    <PDFDownloadLink
      document={<ForcePDF force={force} />}
      fileName={fileName}
      className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-md text-sm font-medium transition-colors"
    >
      {({ loading }) => (loading ? 'Generating PDF...' : 'Export PDF')}
    </PDFDownloadLink>
  );
}
