// Thin fetch wrappers for the BTForceManager backend API.
// All requests are prefixed with `${REACT_APP_BACKEND_URL}/api`.

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function request(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody.detail || JSON.stringify(errBody);
    } catch {
      detail = response.statusText;
    }
    const error = new Error(`${method} ${path} failed (${response.status}): ${detail}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

// Forces
export const listForces = () => request('GET', '/forces');
export const getForce = (id) => request('GET', `/forces/${id}`);
export const exportForce = (id) => request('GET', `/forces/${id}/export`);
export const createForce = (payload) => request('POST', '/forces', payload);
export const updateForce = (id, payload) => request('PUT', `/forces/${id}`, payload);
export const deleteForce = (id) => request('DELETE', `/forces/${id}`);

// Admin
export const getAdminHealth = () => request('GET', '/admin/health');

// Mechs
export const createMech = (forceId, payload) => request('POST', `/forces/${forceId}/mechs`, payload);
export const updateMech = (id, payload) => request('PUT', `/mechs/${id}`, payload);
export const deleteMech = (id) => request('DELETE', `/mechs/${id}`);

// Pilots
export const createPilot = (forceId, payload) => request('POST', `/forces/${forceId}/pilots`, payload);
export const updatePilot = (id, payload) => request('PUT', `/pilots/${id}`, payload);
export const deletePilot = (id) => request('DELETE', `/pilots/${id}`);
export const addPilotAchievement = (pilotId, achievementId, earnedAt) =>
  request('POST', `/pilots/${pilotId}/achievements`, { achievementId, earnedAt });

// Elementals
export const createElemental = (forceId, payload) => request('POST', `/forces/${forceId}/elementals`, payload);
export const updateElemental = (id, payload) => request('PUT', `/elementals/${id}`, payload);
export const deleteElemental = (id) => request('DELETE', `/elementals/${id}`);

// Missions
export const createMission = (forceId, payload) => request('POST', `/forces/${forceId}/missions`, payload);
export const updateMission = (id, payload) => request('PUT', `/missions/${id}`, payload);
export const deleteMission = (id) => request('DELETE', `/missions/${id}`);
export const addSpPurchase = (missionId, purchase) =>
  request('POST', `/missions/${missionId}/sp-purchases`, purchase);
export const deleteSpPurchase = (id) => request('DELETE', `/sp-purchases/${id}`);

// Snapshots
export const createSnapshot = (forceId, payload) => request('POST', `/forces/${forceId}/snapshots`, payload);
export const deleteSnapshot = (id) => request('DELETE', `/snapshots/${id}`);
export const createFullSnapshot = (forceId, payload) => request('POST', `/forces/${forceId}/full-snapshots`, payload);
export const deleteFullSnapshot = (id) => request('DELETE', `/full-snapshots/${id}`);

// Mech catalog
export const searchMechCatalog = (search) =>
  request('GET', `/mech-catalog?search=${encodeURIComponent(search)}`);
export const getMechCatalogImportStatus = () => request('GET', '/mech-catalog/import-status');

// Downtime
export const getDowntimeActionsConfig = async () => {
  const actions = await request('GET', '/downtime-actions');
  const grouped = { mechActions: [], elementalActions: [], pilotActions: [] };
  for (const action of actions) {
    const entry = { ...action, makesUnavailable: (action.flags || []).includes('makesUnavailable') };
    (grouped[action.category] ||= []).push(entry);
  }
  return grouped;
};
export const applyMechDowntime = (mechId, payload) => request('POST', `/mechs/${mechId}/downtime`, payload);
export const applyElementalDowntime = (elementalId, payload) =>
  request('POST', `/elementals/${elementalId}/downtime`, payload);
export const applyPilotDowntime = (pilotId, payload) => request('POST', `/pilots/${pilotId}/downtime`, payload);

// Achievements
export const listAchievementDefinitions = () => request('GET', '/achievement-definitions');
export const getPilotAchievements = (pilotId) => request('GET', `/pilots/${pilotId}/achievements`);

// Special abilities
export const listSpecialAbilities = () => request('GET', '/special-abilities');
export const getForceSpecialAbilities = (forceId) => request('GET', `/forces/${forceId}/special-abilities`);
export const setForceSpecialAbilities = (forceId, abilityIds) =>
  request('PUT', `/forces/${forceId}/special-abilities`, { abilityIds });

// SP choices
export const listSpChoices = () => request('GET', '/sp-choices');
