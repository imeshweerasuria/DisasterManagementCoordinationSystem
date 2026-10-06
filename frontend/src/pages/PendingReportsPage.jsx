import {
  useEffect,
  useState,
} from 'react';

import {
  getPendingHazardReports,
} from '../services/hazardReportService';

export default function PendingReportsPage() {
  const [
    reports,
    setReports,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      setLoading(true);

      const result =
        await getPendingHazardReports();

      setReports(
        result.data
      );
    } catch {
      setError(
        'Unable to load reports.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth:
          '1100px',
        margin:
          '0 auto',
        padding:
          '32px',
      }}
    >
      <h1>
        Duty Officer Queue
      </h1>

      <p>
        Unverified citizen
        hazard reports.
      </p>

      {loading && (
        <p>
          Loading...
        </p>
      )}

      {error && (
        <p>
          {error}
        </p>
      )}

      {!loading &&
        reports.length ===
          0 && (
          <p>
            No pending
            reports.
          </p>
        )}

      <div
        style={{
          display:
            'grid',
          gap: '16px',
        }}
      >
        {reports.map(
          (
            report
          ) => (
            <div
              key={
                report._id
              }
              style={{
                background:
                  '#ffffff',

                padding:
                  '20px',

                borderRadius:
                  '14px',

                border:
                  '1px solid #ddd',
              }}
            >
              <h3>
                {
                  report.referenceId
                }
              </h3>

              <p>
                <strong>
                  Hazard:
                </strong>{' '}
                {
                  report.hazardType
                }
              </p>

              <p>
                <strong>
                  Severity:
                </strong>{' '}
                {
                  report.severity
                }
              </p>

              <p>
                {
                  report.description
                }
              </p>

              <p>
                Status:{' '}
                <strong>
                  {
                    report.verificationStatus
                  }
                </strong>
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}