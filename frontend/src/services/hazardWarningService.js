import axios from 'axios';

const API_BASE_URL =
  import.meta.env
    .VITE_API_URL ||
  'http://localhost:5000/api';

const warningApi =
  axios.create({
    baseURL:
      `${API_BASE_URL}/hazard-warnings`,
  });

export async function
getPendingReports() {
  const response =
    await axios.get(
      `${API_BASE_URL}/hazard-reports/pending`
    );

  return (
    response.data.data ||
    []
  );
}

export async function
getWarnings() {
  const response =
    await warningApi.get(
      '/'
    );

  return response
    .data
    .warnings;
}

export async function
createWarning(
  payload
) {
  const response =
    await warningApi.post(
      '/',
      payload
    );

  return response
    .data
    .warning;
}

export async function
getSensorEvidence(
  params
) {
  const response =
    await warningApi.get(
      '/sensors/evidence',
      {
        params,
      }
    );

  return response
    .data
    .readings;
}

export async function
reviewHazardReport(
  reportId,
  payload
) {
  const response =
    await warningApi.patch(
      `/reports/${reportId}/review`,
      payload
    );

  return response.data;
}

export async function
getVerificationHistory(
  reportId
) {
  const response =
    await warningApi.get(
      `/reports/${reportId}/verification-history`
    );

  return response
    .data
    .logs;
}

export async function
broadcastWarning(
  warningId,
  payload
) {
  const response =
    await warningApi.post(
      `/${warningId}/broadcast`,
      payload
    );

  return response.data;
}

export async function
updateWarningLifecycle(
  warningId,
  payload
) {
  const response =
    await warningApi.post(
      `/${warningId}/lifecycle`,
      payload
    );

  return response.data;
}

export async function
getWarningDeliveries(
  warningId
) {
  const response =
    await warningApi.get(
      `/${warningId}/deliveries`
    );

  return response
    .data
    .deliveries;
}

export async function
retryFailedDeliveries(
  warningId
) {
  const response =
    await warningApi.post(
      `/${warningId}/retry-failed`,
      {
        officerId:
          'DUTY-OFFICER-001',
      }
    );

  return response.data;
}