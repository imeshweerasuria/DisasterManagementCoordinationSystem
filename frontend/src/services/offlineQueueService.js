import {
  submitHazardReport,
} from './hazardReportService';

const STORAGE_KEY =
  'hazard_report_offline_queue';

export function getOfflineQueue() {
  try {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEY
      ) || '[]'
    );
  } catch {
    return [];
  }
}

export function saveOfflineReport(
  report
) {
  const queue =
    getOfflineQueue();

  const existingIndex =
    queue.findIndex(
      (item) =>
        item.clientSubmissionId ===
        report.clientSubmissionId
    );

  const queuedReport = {
    ...report,

    syncStatus:
      'PENDING_SYNC',

    queuedAt:
      new Date().toISOString(),
  };

  if (
    existingIndex >= 0
  ) {
    queue[
      existingIndex
    ] = queuedReport;
  } else {
    queue.push(
      queuedReport
    );
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(queue)
  );

  return queuedReport;
}

export function removeOfflineReport(
  clientSubmissionId
) {
  const updated =
    getOfflineQueue().filter(
      (item) =>
        item.clientSubmissionId !==
        clientSubmissionId
    );

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updated)
  );
}

export async function syncOfflineReports() {
  const queue =
    getOfflineQueue();

  const results = [];

  for (
    const report of queue
  ) {
    try {
      const serverReport = {
        ...report,
      };

      delete serverReport.syncStatus;
      delete serverReport.queuedAt;

      const response =
        await submitHazardReport(
          serverReport
        );

      removeOfflineReport(
        report.clientSubmissionId
      );

      results.push({
        clientSubmissionId:
          report.clientSubmissionId,

        success: true,

        response,
      });
    } catch (error) {
      results.push({
        clientSubmissionId:
          report.clientSubmissionId,

        success: false,

        message:
          error.response?.data
            ?.message ||
          error.message,
      });
    }
  }

  return results;
}