import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

const emergencyApi =
  axios.create({
    baseURL: `${API_URL}/emergency-response`,
  });

export async function getEmergencyDashboard(
  eventId,
  inactivityMinutes = 30
) {
  const response =
    await emergencyApi.get(
      '/dashboard',
      {
        params: {
          eventId,
          inactivityMinutes,
        },
      }
    );

  return response.data;
}

export async function createShelter(
  payload
) {
  const response =
    await emergencyApi.post(
      '/shelters',
      payload
    );

  return response.data;
}

export async function updateShelterOccupancy(
  shelterId,
  occupancy
) {
  const response =
    await emergencyApi.patch(
      `/shelters/${shelterId}/occupancy`,
      {
        occupancy,
      }
    );

  return response.data;
}

export async function createRescueTeam(
  payload
) {
  const response =
    await emergencyApi.post(
      '/rescue-teams',
      payload
    );

  return response.data;
}

export async function dispatchRescueTeam(
  payload
) {
  const response =
    await emergencyApi.post(
      '/assignments',
      payload
    );

  return response.data;
}

export async function updateAssignmentStatus(
  assignmentId,
  payload
) {
  const response =
    await emergencyApi.patch(
      `/assignments/${assignmentId}/status`,
      payload
    );

  return response.data;
}

export async function reassignRescueTeam(
  assignmentId,
  newTeamId
) {
  const response =
    await emergencyApi.post(
      `/assignments/${assignmentId}/reassign`,
      {
        newTeamId,
      }
    );

  return response.data;
}

export async function registerReliefResource(
  payload
) {
  const response =
    await emergencyApi.post(
      '/resources',
      payload
    );

  return response.data;
}

export async function allocateReliefResource(
  payload
) {
  const response =
    await emergencyApi.post(
      '/distributions',
      payload
    );

  return response.data;
}

export async function requestMedicalEvacuation(
  payload
) {
  const response =
    await emergencyApi.post(
      '/medical-evacuation',
      payload
    );

  return response.data;
}
