import axios from 'axios';

const API_URL =
  import.meta.env
    .VITE_API_URL ||
  'http://localhost:5000/api';

export async function submitHazardReport(
  report
) {
  const response =
    await axios.post(
      `${API_URL}/hazard-reports`,
      report
    );

  return response.data;
}

export async function getPendingHazardReports() {
  const response =
    await axios.get(
      `${API_URL}/hazard-reports/pending`
    );

  return response.data;
}

export async function submitSmsHazardReport(
  smsData
) {
  const response =
    await axios.post(
      `${API_URL}/hazard-reports/sms`,
      smsData
    );

  return response.data;
}