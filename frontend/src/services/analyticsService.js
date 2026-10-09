
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/analytics${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let message = 'Analytics request failed.';

    if (contentType.includes('application/json')) {
      const result = await response.json();
      message = result.message || result.error || message;
    } else {
      message = (await response.text()) || message;
    }

    throw new Error(message);
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response;
}

export const getCompletedEvents = () => request('/events');

export const generateReport = (filters) =>
  request('/reports', {
    method: 'POST',
    body: JSON.stringify(filters),
  });

export const getReport = (reportId) =>
  request(`/reports/${reportId}`);

export const shareReport = (reportId, recipientId, sharedBy) =>
  request(`/reports/${reportId}/share`, {
    method: 'POST',
    body: JSON.stringify({ recipientId, sharedBy }),
  });

export const revokeReportShare = (reportId, recipientId, revokedBy) =>
  request(`/reports/${reportId}/share/${recipientId}`, {
    method: 'DELETE',
    body: JSON.stringify({ revokedBy }),
  });

export const getSharedReport = (recipientId, reportId) =>
  request(`/shared/${recipientId}/${reportId}`);

export async function downloadReport(reportId, format) {
  if (!['pdf', 'csv'].includes(format)) {
    throw new Error('Unsupported report format.');
  }

  const response = await request(
    `/reports/${reportId}/export/${format}`
  );

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `analytics-report-${reportId}.${format}`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
