import { applyMechDowntimeAction } from './downtime';
import { UNIT_STATUS, DOWNTIME_ACTION_IDS } from './constants';

describe('applyMechDowntimeAction', () => {
  it('sets status to OPERATIONAL when repairing armor on a DAMAGED mech', () => {
    const force = {
      mechs: [
        { id: 'm1', status: UNIT_STATUS.DAMAGED, activityLog: [] }
      ],
      currentWarchest: 100
    };
    const action = {
      id: DOWNTIME_ACTION_IDS.REPAIR_ARMOR,
      name: 'Repair Armor',
      makesUnavailable: false
    };
    
    const result = applyMechDowntimeAction(force, {
      mechId: 'm1',
      action,
      cost: 10,
      timestamp: 'now',
      lastMissionName: 'mission'
    });
    
    expect(result.mechs[0].status).toBe(UNIT_STATUS.OPERATIONAL);
  });

  it('does not change status if mech is not DAMAGED', () => {
    const force = {
      mechs: [
        { id: 'm1', status: UNIT_STATUS.OPERATIONAL, activityLog: [] }
      ],
      currentWarchest: 100
    };
    const action = {
      id: DOWNTIME_ACTION_IDS.REPAIR_ARMOR,
      name: 'Repair Armor',
      makesUnavailable: false
    };
    
    const result = applyMechDowntimeAction(force, {
      mechId: 'm1',
      action,
      cost: 10,
      timestamp: 'now',
      lastMissionName: 'mission'
    });
    
    expect(result.mechs[0].status).toBe(UNIT_STATUS.OPERATIONAL);
  });

  it('does not change status if action is not REPAIR_ARMOR', () => {
    const force = {
      mechs: [
        { id: 'm1', status: UNIT_STATUS.DAMAGED, activityLog: [] }
      ],
      currentWarchest: 100
    };
    const action = {
      id: 'other-action',
      name: 'Other',
      makesUnavailable: false
    };
    
    const result = applyMechDowntimeAction(force, {
      mechId: 'm1',
      action,
      cost: 10,
      timestamp: 'now',
      lastMissionName: 'mission'
    });
    
    expect(result.mechs[0].status).toBe(UNIT_STATUS.DAMAGED);
  });
});
