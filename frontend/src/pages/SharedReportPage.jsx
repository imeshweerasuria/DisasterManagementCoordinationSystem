
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSharedReport } from '../services/analyticsService';
import '../styles/AnalyticsReport.css';

function formatLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value)
  ) {
    return new Date(value).toLocaleString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function MetricContent({ value, itemKey = 'metric' }) {
  if (value === null || value === undefined) {
    return <span>—</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span>No records</span>;
    }

    const objectArray = value.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item)
    );

    if (objectArray) {
      const columns = [
        ...new Set(value.flatMap((item) => Object.keys(item))),
      ];

      return (
        <div className="analytics-table-wrapper">
          <table className="analytics-data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">
                    {formatLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {value.map((item, index) => (
                <tr key={`${itemKey}-${index}`}>
                  {columns.map((column) => (
                    <td key={column}>
                      {formatValue(item[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <ul className="analytics-simple-list">
        {value.map((item, index) => (
          <li key={`${itemKey}-${index}`}>
            {typeof item === 'object'
              ? JSON.stringify(item)
              : formatValue(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="analytics-metrics-container">
        {Object.entries(value).map(([key, child]) => (
          <section className="analytics-metric-group" key={key}>
            <h3>{formatLabel(key)}</h3>
            <MetricContent
              value={child}
              itemKey={`${itemKey}-${key}`}
            />
          </section>
        ))}
      </div>
    );
  }

  return <span>{formatValue(value)}</span>;
}

function SharedReportPage() {
  const [searchParams] = useSearchParams();

  const [recipientId, setRecipientId] = useState(
    searchParams.get('recipientId') || 'DONOR-001'
  );

  const [reportId, setReportId] = useState(
    searchParams.get('reportId') || ''
  );

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSharedReport = useCallback(
    async (recipientValue, reportValue) => {
      const recipient = recipientValue.trim();
      const id = reportValue.trim();

      setError('');
      setMessage('');
      setReport(null);

      if (!recipient || !id) {
        setError('Enter both the recipient ID and report ID.');
        return;
      }

      setLoading(true);

      try {
        const result = await getSharedReport(recipient, id);

        if (!result?.success || !result?.data) {
          throw new Error(
            'The shared report could not be retrieved.'
          );
        }

        if (result.permission !== 'READ_ONLY') {
          throw new Error(
            'The report was not granted read-only access.'
          );
        }

        setReport(result.data);
        setMessage(
          'Shared report loaded with read-only permission.'
        );
      } catch (err) {
        setError(
          err.message ||
            'Unable to open this report. Check the recipient ID, report ID, and sharing permission.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Automatically load the report when both IDs are provided in the URL.
  useEffect(() => {
    const urlRecipient = searchParams.get('recipientId') || '';
    const urlReport = searchParams.get('reportId') || '';

    if (urlRecipient && urlReport) {
      setRecipientId(urlRecipient);
      setReportId(urlReport);
      loadSharedReport(urlRecipient, urlReport);
    }
  }, [searchParams, loadSharedReport]);

  function handleViewReport(event) {
    event.preventDefault();
    loadSharedReport(recipientId, reportId);
  }

  const event = report?.eventId;
  const filters = report?.filters || {};

  return (
    <main className="analytics-page">
      <header className="analytics-header">
        <div>
          <p className="analytics-eyebrow">
            DISASTER MANAGEMENT SYSTEM
          </p>

          <h1>Shared Disaster Report</h1>

          <p>
            View a disaster analytics report shared with a recipient.
            Reports opened here are read-only.
          </p>
        </div>

        <span className="analytics-header-icon" aria-hidden="true">
          ◫
        </span>
      </header>

      <div style={{ marginBottom: '1rem' }}>
        <Link to="/analytics">← Back to Disaster Analytics</Link>
      </div>

      {error && (
        <div
          className="analytics-alert analytics-alert-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="analytics-alert analytics-alert-success"
          role="status"
        >
          {message}
        </div>
      )}

      <section className="analytics-panel">
        <div className="analytics-section-heading">
          <span className="analytics-step">01</span>

          <div>
            <h2>Open a shared report</h2>
            <p>
              Enter the recipient ID and the ID of a report shared with them.
            </p>
          </div>
        </div>

        <form onSubmit={handleViewReport}>
          <div className="analytics-form-grid">
            <label className="analytics-field">
              Recipient ID

              <input
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                placeholder="e.g. DONOR-001"
                required
              />
            </label>

            <label className="analytics-field">
              Report ID

              <input
                value={reportId}
                onChange={(event) => setReportId(event.target.value)}
                placeholder="Paste the shared report ID"
                required
              />
            </label>
          </div>

          <button
            className="analytics-button analytics-button-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Loading report...' : 'View shared report'}
          </button>
        </form>

        <p className="analytics-disclaimer">
          Demo mode: recipient IDs are not verified user identities.
          Access depends on the backend sharing permission check.
          This is not a substitute for authenticated recipient accounts.
        </p>
      </section>

      {report && (
        <section className="analytics-panel analytics-report-panel">
          <div className="analytics-section-heading">
            <span className="analytics-step">02</span>

            <div>
              <h2>Report results</h2>
              <p>{formatLabel(report.reportType)}</p>
            </div>

            <span className="analytics-saved-badge">READ ONLY</span>
          </div>

          <div className="analytics-report-meta">
            <div>
              <span>Report ID</span>
              <strong>{report._id}</strong>
            </div>

            <div>
              <span>Event</span>
              <strong>{event?.name || '—'}</strong>
            </div>

            <div>
              <span>Event code</span>
              <strong>{event?.eventCode || '—'}</strong>
            </div>

            <div>
              <span>District</span>
              <strong>{event?.district || filters.district || '—'}</strong>
            </div>

            <div>
              <span>Reporting period</span>
              <strong>
                {filters.startDate
                  ? new Date(filters.startDate).toLocaleDateString()
                  : '—'}
                {' – '}
                {filters.endDate
                  ? new Date(filters.endDate).toLocaleDateString()
                  : '—'}
              </strong>
            </div>

            <div>
              <span>Generated at</span>
              <strong>
                {report.generatedAt
                  ? new Date(report.generatedAt).toLocaleString()
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="analytics-metrics-container analytics-summary-grid">
            <MetricContent value={report.metrics} />
          </div>

          <p className="analytics-disclaimer">
            Permission: READ_ONLY. This page has no controls to edit the
            saved report. The backend must enforce access permissions.
          </p>
        </section>
      )}
    </main>
  );
}

export default SharedReportPage;
