
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  downloadReport,
  generateReport,
  getCompletedEvents,
  shareReport,
} from '../services/analyticsService';

import '../styles/AnalyticsReport.css';

const REPORT_TYPES = [
  {
    value: 'ALERT_REACH_AUDIT',
    label: 'Alert Reach Audit',
    description: 'Review alert deliveries, recipients, and failures.',
  },
  {
    value: 'SHELTER_OCCUPANCY_TREND',
    label: 'Shelter Occupancy Trend',
    description: 'Review shelter capacity and occupancy over time.',
  },
  {
    value: 'RESOURCE_USAGE_SUMMARY',
    label: 'Resource Usage Summary',
    description: 'Review distributed resources by type and district.',
  },
];

const RECIPIENTS = ['EXEC-001', 'DONOR-001', 'AGENCY-001'];

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

function renderMetrics(value, keyPrefix = 'metric') {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span>No records</span>;
    }

    const isObjectArray = value.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item)
    );

    if (isObjectArray) {
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
                <tr key={`${keyPrefix}-${index}`}>
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
          <li key={`${keyPrefix}-${index}`}>
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
            {renderMetrics(child, `${keyPrefix}-${key}`)}
          </section>
        ))}
      </div>
    );
  }

  return <span>{formatValue(value)}</span>;
}

function AnalyticsReportPage() {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [reportType, setReportType] = useState(REPORT_TYPES[0].value);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [district, setDistrict] = useState('');
  const [hazardType, setHazardType] = useState('');
  const [report, setReport] = useState(null);

  const [recipientId, setRecipientId] = useState(RECIPIENTS[0]);
  const [sharedBy, setSharedBy] = useState('EXEC-001');

  const [loadingEvents, setLoadingEvents] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState('');
  const [sharing, setSharing] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      setLoadingEvents(true);

      try {
        const result = await getCompletedEvents();

        if (!active) return;

        setEvents(Array.isArray(result.data) ? result.data : []);
      } catch (err) {
        if (active) {
          setError(err.message || 'Could not load completed events.');
        }
      } finally {
        if (active) {
          setLoadingEvents(false);
        }
      }
    }

    loadEvents();

    return () => {
      active = false;
    };
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === eventId),
    [events, eventId]
  );

  const eventStart = selectedEvent?.startDate
    ? String(selectedEvent.startDate).slice(0, 10)
    : '';

  const eventEnd = selectedEvent?.endDate
    ? String(selectedEvent.endDate).slice(0, 10)
    : '';

  function handleEventChange(nextEventId) {
    setEventId(nextEventId);
    setReport(null);
    setMessage('');
    setError('');

    const event = events.find((item) => item._id === nextEventId);

    setStartDate(
      event?.startDate ? String(event.startDate).slice(0, 10) : ''
    );

    setEndDate(
      event?.endDate ? String(event.endDate).slice(0, 10) : ''
    );

    setDistrict('');
    setHazardType(event?.hazardType || '');
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!eventId) {
      setError('Select a completed disaster event first.');
      return;
    }

    if (!startDate || !endDate) {
      setError('Select both a start date and an end date.');
      return;
    }

    if (startDate > endDate) {
      setError('The start date must not be after the end date.');
      return;
    }

    if (
      (eventStart && startDate < eventStart) ||
      (eventEnd && endDate > eventEnd)
    ) {
      setError(
        'The date range must fall within the selected event dates.'
      );
      return;
    }

    setGenerating(true);

    try {
      const result = await generateReport({
        eventId,
        reportType,
        startDate,
        endDate,
        ...(district.trim() ? { district: district.trim() } : {}),
        ...(hazardType ? { hazardType } : {}),
        generatedBy: 'EXEC-001',
      });

      setReport(result.data);
      setMessage('Report generated and saved successfully.');
    } catch (err) {
      setError(err.message || 'Could not generate the report.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(format) {
    if (!report?._id) return;

    setError('');
    setMessage('');
    setExporting(format);

    try {
      await downloadReport(report._id, format);
      setMessage(`${format.toUpperCase()} export completed.`);
    } catch (err) {
      setError(
        err.message ||
          `Could not export the ${format.toUpperCase()} report.`
      );
    } finally {
      setExporting('');
    }
  }

  async function handleShare(event) {
    event.preventDefault();

    if (!report?._id) return;

    setError('');
    setMessage('');
    setSharing(true);

    try {
      await shareReport(report._id, recipientId, sharedBy);

      setMessage(`Read-only access granted to ${recipientId}.`);
    } catch (err) {
      setError(err.message || 'Could not share the report.');
    } finally {
      setSharing(false);
    }
  }

  function handleViewSharedReport() {
    if (!report?._id) {
      setError('Generate a report before opening the shared report viewer.');
      return;
    }

    const params = new URLSearchParams({
      recipientId,
      reportId: report._id,
    });

    navigate(`/shared-report?${params.toString()}`);
  }

  return (
    <main className="analytics-page">
      <header className="analytics-header">
        <div>
          <p className="analytics-eyebrow">
            DISASTER MANAGEMENT SYSTEM
          </p>

          <h1>Disaster Analytics</h1>

          <p>
            Generate event-specific reports to support operational
            decisions and relief coordination.
          </p>
        </div>

        <span className="analytics-header-icon" aria-hidden="true">
          ◫
        </span>
      </header>

      {error && (
        <div className="analytics-alert analytics-alert-error" role="alert">
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
            <h2>Configure your report</h2>
            <p>Select a completed event and a valid reporting period.</p>
          </div>
        </div>

        <form onSubmit={handleGenerate}>
          <div className="analytics-form-grid">
            <label className="analytics-field analytics-field-full">
              Completed disaster event

              <select
                value={eventId}
                onChange={(event) => handleEventChange(event.target.value)}
                disabled={loadingEvents}
                required
              >
                <option value="">
                  {loadingEvents
                    ? 'Loading completed events...'
                    : 'Select an event'}
                </option>

                {events.map((item) => (
                  <option value={item._id} key={item._id}>
                    {item.eventCode ? `${item.eventCode} — ` : ''}
                    {item.name}
                    {item.district ? ` (${item.district})` : ''}
                  </option>
                ))}
              </select>

              {!loadingEvents && events.length === 0 && (
                <small>
                  No completed events are available. Complete an event
                  before generating a report.
                </small>
              )}
            </label>

            <label className="analytics-field">
              Report type

              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value)}
              >
                {REPORT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <small>
                {
                  REPORT_TYPES.find((type) => type.value === reportType)
                    ?.description
                }
              </small>
            </label>

            <label className="analytics-field">
              District (optional)

              <input
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                placeholder="e.g. Galle"
              />
            </label>

            <label className="analytics-field">
              Start date

              <input
                type="date"
                value={startDate}
                min={eventStart || undefined}
                max={eventEnd || undefined}
                onChange={(event) => setStartDate(event.target.value)}
                required
                disabled={!eventId}
              />
            </label>

            <label className="analytics-field">
              End date

              <input
                type="date"
                value={endDate}
                min={startDate || eventStart || undefined}
                max={eventEnd || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                required
                disabled={!eventId}
              />
            </label>

            {selectedEvent?.hazardType && (
              <div className="analytics-event-info analytics-field-full">
                <span>Event hazard</span>
                <strong>{formatLabel(selectedEvent.hazardType)}</strong>
              </div>
            )}
          </div>

          <button
            className="analytics-button analytics-button-primary"
            type="submit"
            disabled={generating || loadingEvents || !events.length}
          >
            {generating ? 'Generating report...' : 'Generate report'}
          </button>
        </form>
      </section>

      {report && (
        <section className="analytics-panel analytics-report-panel">
          <div className="analytics-section-heading">
            <span className="analytics-step">02</span>

            <div>
              <h2>Report results</h2>
              <p>
                {REPORT_TYPES.find(
                  (type) => type.value === report.reportType
                )?.label || formatLabel(report.reportType)}
              </p>
            </div>

            <span className="analytics-saved-badge">Saved</span>
          </div>

          <div className="analytics-report-meta">
            <div>
              <span>Report ID</span>
              <strong>{report._id}</strong>
            </div>

            <div>
              <span>Generated at</span>
              <strong>
                {report.generatedAt
                  ? new Date(report.generatedAt).toLocaleString()
                  : '—'}
              </strong>
            </div>

            <div>
              <span>Reporting period</span>
              <strong>
                {String(report.filters?.startDate || startDate).slice(0, 10)}
                {' – '}
                {String(report.filters?.endDate || endDate).slice(0, 10)}
              </strong>
            </div>
          </div>

          <div className="analytics-metrics-container analytics-summary-grid">
            {renderMetrics(report.metrics)}
          </div>

          <div className="analytics-export-actions">
            <button
              className="analytics-button analytics-button-secondary"
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => handleDownload('pdf')}
            >
              {exporting === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}
            </button>

            <button
              className="analytics-button analytics-button-secondary"
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => handleDownload('csv')}
            >
              {exporting === 'csv' ? 'Preparing CSV...' : 'Download CSV'}
            </button>
          </div>

          <div className="analytics-share-section">
            <div className="analytics-section-heading">
              <span className="analytics-step">03</span>

              <div>
                <h2>Share report</h2>
                <p>Grant a demo recipient read-only access.</p>
              </div>
            </div>

            <form className="analytics-share-form" onSubmit={handleShare}>
              <label className="analytics-field">
                Recipient

                <select
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                >
                  {RECIPIENTS.map((recipient) => (
                    <option value={recipient} key={recipient}>
                      {recipient}
                    </option>
                  ))}
                </select>
              </label>

              <label className="analytics-field">
                Shared by

                <select
                  value={sharedBy}
                  onChange={(event) => setSharedBy(event.target.value)}
                >
                  {RECIPIENTS.map((recipient) => (
                    <option value={recipient} key={recipient}>
                      {recipient}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="analytics-button analytics-button-primary"
                type="submit"
                disabled={sharing}
              >
                {sharing ? 'Sharing...' : 'Share read-only'}
              </button>

              <button
                className="analytics-button analytics-button-secondary"
                type="button"
                onClick={handleViewSharedReport}
              >
                View Shared Report
              </button>
            </form>

            <p className="analytics-disclaimer">
              Demo authorization only: these recipient IDs are not real
              user authentication. The shared report viewer checks the
              backend sharing permission.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

export default AnalyticsReportPage;
