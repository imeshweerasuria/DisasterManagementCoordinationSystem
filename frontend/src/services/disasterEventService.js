import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

const eventApi =
  axios.create({
    baseURL: `${API_URL}/disaster-events`,
  });

export async function listDisasterEvents(
  status = 'ACTIVE'
) {
  const response =
    await eventApi.get(
      '/',
      {
        params: {
          status,
        },
      }
    );

  return response.data;
}

export async function createDisasterEvent(
  payload
) {
  const response =
    await eventApi.post(
      '/',
      payload
    );

  return response.data;
}
