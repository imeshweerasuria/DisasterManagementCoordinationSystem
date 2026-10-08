import {
  useEffect,
  useState,
} from 'react';

import {
  broadcastWarning,
  createWarning,
  getPendingReports,
  getSensorEvidence,
  getVerificationHistory,
  getWarningDeliveries,
  getWarnings,
  reviewHazardReport,
  retryFailedDeliveries,
  updateWarningLifecycle,
} from '../services/hazardWarningService';

import '../styles/WarningManagement.css';

const OFFICER_ID =
  'DUTY-OFFICER-001';

const severityLevels = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

function apiError(
  error
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error.message ||
    'Something went wrong.'
  );
}

function formatDate(
  value
) {
  if (!value) {
    return '—';
  }

  return new Date(
    value
  ).toLocaleString();
}

export default function
WarningManagementPage() {
  const [
    reports,
    setReports,
  ] =
    useState([]);

  const [
    selectedReport,
    setSelectedReport,
  ] =
    useState(null);

  const [
    reportSensors,
    setReportSensors,
  ] =
    useState([]);

  const [
    verificationLogs,
    setVerificationLogs,
  ] =
    useState([]);

  const [
    warnings,
    setWarnings,
  ] =
    useState([]);

  const [
    selectedWarning,
    setSelectedWarning,
  ] =
    useState(null);

  const [
    deliveries,
    setDeliveries,
  ] =
    useState([]);

  const [
    sourceType,
    setSourceType,
  ] =
    useState(
      'SENSOR'
    );

  const [
    selectedSensorIds,
    setSelectedSensorIds,
  ] =
    useState([]);

  const [
    manualSensors,
    setManualSensors,
  ] =
    useState([]);

  const [
    latitude,
    setLatitude,
  ] =
    useState(
      '6.9271'
    );

  const [
    longitude,
    setLongitude,
  ] =
    useState(
      '79.8612'
    );

  const [
    targetType,
    setTargetType,
  ] =
    useState(
      'DISTRICT'
    );

  const [
    targetName,
    setTargetName,
  ] =
    useState('');

  const [
    severity,
    setSeverity,
  ] =
    useState(
      'HIGH'
    );

  const [
    warningMessage,
    setWarningMessage,
  ] =
    useState('');

  const [
    channels,
    setChannels,
  ] =
    useState({
      PUSH: true,
      SMS: true,
      AUDIBLE: true,
    });

  const [
    remarks,
    setRemarks,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    success,
    setSuccess,
  ] =
    useState('');

  async function
  refreshReports() {
    const data =
      await getPendingReports();

    setReports(
      data
    );
  }

  async function
  refreshWarnings() {
    const data =
      await getWarnings();

    setWarnings(
      data
    );

    if (
      selectedWarning
    ) {
      const updated =
        data.find(
          (warning) =>
            warning._id ===
            selectedWarning._id
        );

      if (updated) {
        setSelectedWarning(
          updated
        );
      }
    }
  }

  useEffect(() => {
    async function load() {
      try {
        await Promise.all([
          refreshReports(),
          refreshWarnings(),
        ]);
      } catch (
        loadError
      ) {
        setError(
          apiError(
            loadError
          )
        );
      }
    }

    load();
  }, []);

  async function
  chooseReport(
    report
  ) {
    setSelectedReport(
      report
    );

    setSourceType(
      'REPORT'
    );

    setSelectedSensorIds(
      []
    );

    setRemarks('');
    setReportSensors([]);
    setVerificationLogs([]);

    try {
      const [
        sensors,
        logs,
      ] =
        await Promise.all([
          getSensorEvidence({
            latitude:
              report.location
                .latitude,

            longitude:
              report.location
                .longitude,

            maxDistanceKm:
              50,

            maxAgeMinutes:
              180,
          }),

          getVerificationHistory(
            report._id
          ),
        ]);

      setReportSensors(
        sensors
      );

      setVerificationLogs(
        logs
      );
    } catch (
      chooseError
    ) {
      setError(
        apiError(
          chooseError
        )
      );
    }
  }

  function
  toggleReportSensor(
    id
  ) {
    setSelectedSensorIds(
      (current) =>
        current.includes(id)
          ? current.filter(
              (item) =>
                item !== id
            )
          : [
              ...current,
              id,
            ]
    );
  }

  async function
  reviewReport(
    decision
  ) {
    if (
      !selectedReport
    ) {
      return;
    }

    const labels = {
      VERIFIED:
        'verify',
      DISMISSED:
        'dismiss',
      CONFLICTING:
        'flag as conflicting',
    };

    const confirmed =
      window.confirm(
        `Confirm you want to ${labels[decision]} this citizen report?`
      );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await reviewHazardReport(
        selectedReport._id,
        {
          decision,

          officerId:
            OFFICER_ID,

          remarks,

          comparedSensorIds:
            selectedSensorIds,
        }
      );

      setSuccess(
        `Report review recorded as ${decision}.`
      );

      const logs =
        await getVerificationHistory(
          selectedReport._id
        );

      setVerificationLogs(
        logs
      );

      await refreshReports();

      if (
        decision ===
        'VERIFIED'
      ) {
        setSourceType(
          'REPORT'
        );
      } else {
        setSelectedReport(
          null
        );
      }
    } catch (
      reviewError
    ) {
      setError(
        apiError(
          reviewError
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function
  findManualSensors() {
    setLoading(true);
    setError('');

    try {
      const data =
        await getSensorEvidence({
          latitude,
          longitude,
          maxDistanceKm:
            50,
          maxAgeMinutes:
            180,
        });

      setManualSensors(
        data
      );
    } catch (
      sensorError
    ) {
      setError(
        apiError(
          sensorError
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function
  toggleChannel(
    channel
  ) {
    setChannels(
      (current) => ({
        ...current,

        [channel]:
          !current[
            channel
          ],
      })
    );
  }

  async function
  createDraft(
    event
  ) {
    event.preventDefault();

    const selectedChannels =
      Object.entries(
        channels
      )
        .filter(
          ([, enabled]) =>
            enabled
        )
        .map(
          ([channel]) =>
            channel
        );

    const payload = {
      sourceType,

      officerId:
        OFFICER_ID,

      targetZone: {
        type:
          targetType,

        name:
          targetName,
      },

      severity,

      message:
        warningMessage,

      channels:
        selectedChannels,
    };

    if (
      sourceType ===
      'REPORT'
    ) {
      if (
        !selectedReport
      ) {
        setError(
          'Select and verify a citizen report first.'
        );

        return;
      }

      payload.sourceReportId =
        selectedReport._id;
    } else {
      payload.sourceSensorIds =
        selectedSensorIds;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const created =
        await createWarning(
          payload
        );

      setSuccess(
        `Draft warning ${created.warningCode} created.`
      );

      setTargetName('');
      setWarningMessage('');
      setSelectedSensorIds(
        []
      );

      await refreshWarnings();
    } catch (
      createError
    ) {
      setError(
        apiError(
          createError
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function
  selectWarning(
    warning
  ) {
    setSelectedWarning(
      warning
    );

    try {
      const data =
        await getWarningDeliveries(
          warning._id
        );

      setDeliveries(
        data
      );
    } catch (
      deliveryError
    ) {
      setError(
        apiError(
          deliveryError
        )
      );
    }
  }

  async function
  handleBroadcast() {
    if (
      !selectedWarning
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `CONFIRM OFFICIAL BROADCAST\n\nTarget: ${selectedWarning.targetZone.name}\nSeverity: ${selectedWarning.severity}\nMessage: ${selectedWarning.message}\nChannels: ${selectedWarning.channels.join(', ')}`
      );

    if (!confirmed) {
      return;
    }

    try {
      await broadcastWarning(
        selectedWarning._id,
        {
          confirmed:
            true,

          officerId:
            OFFICER_ID,
        }
      );

      setSuccess(
        'Warning broadcast and delivery results recorded.'
      );

      await refreshWarnings();

      const data =
        await getWarningDeliveries(
          selectedWarning._id
        );

      setDeliveries(
        data
      );
    } catch (
      broadcastError
    ) {
      setError(
        apiError(
          broadcastError
        )
      );
    }
  }

  async function
  changeLifecycle(
    action
  ) {
    if (
      !selectedWarning
    ) {
      return;
    }

    const payload = {
      action,
      officerId:
        OFFICER_ID,
    };

    if (
      action ===
        'ESCALATE' ||
      action ===
        'DE_ESCALATE'
    ) {
      const newSeverity =
        window.prompt(
          action ===
            'ESCALATE'
            ? 'Enter a HIGHER severity: LOW, MEDIUM, HIGH or CRITICAL'
            : 'Enter a LOWER severity: LOW, MEDIUM, HIGH or CRITICAL'
        );

      if (!newSeverity) {
        return;
      }

      const normalized =
        newSeverity
          .trim()
          .toUpperCase();

      if (
        !severityLevels.includes(
          normalized
        )
      ) {
        setError(
          'Invalid severity.'
        );

        return;
      }

      const newMessage =
        window.prompt(
          'Enter the updated warning message:',
          selectedWarning.message
        );

      if (
        !newMessage
      ) {
        return;
      }

      payload.newSeverity =
        normalized;

      payload.message =
        newMessage;
    }

    if (
      action ===
      'CANCEL'
    ) {
      const confirmed =
        window.confirm(
          `Cancel ${selectedWarning.warningCode}?\n\nAn ALL CLEAR notification will be sent on all selected channels and the warning history will be retained.`
        );

      if (!confirmed) {
        return;
      }

      payload.confirmed =
        true;
    }

    try {
      await updateWarningLifecycle(
        selectedWarning._id,
        payload
      );

      setSuccess(
        `${action} completed successfully.`
      );

      await refreshWarnings();

      const data =
        await getWarningDeliveries(
          selectedWarning._id
        );

      setDeliveries(
        data
      );
    } catch (
      lifecycleError
    ) {
      setError(
        apiError(
          lifecycleError
        )
      );
    }
  }

  async function
  retryFailed() {
    if (
      !selectedWarning
    ) {
      return;
    }

    try {
      const result =
        await retryFailedDeliveries(
          selectedWarning._id
        );

      setSuccess(
        `${result.retried.length} failed channel(s) retried.`
      );

      const data =
        await getWarningDeliveries(
          selectedWarning._id
        );

      setDeliveries(
        data
      );
    } catch (
      retryError
    ) {
      setError(
        apiError(
          retryError
        )
      );
    }
  }

  return (
    <main className="warning-page">
      <header className="warning-header">
        <div>
          <span>
            DMC Duty Officer Console
          </span>

          <h1>
            Manage &amp;
            Escalate Hazard
            Warning
          </h1>

          <p>
            Review citizen
            evidence, compare
            recent sensor data,
            issue official
            warnings and manage
            their lifecycle.
          </p>
        </div>
      </header>

      {error && (
        <div className="warning-error">
          {error}
        </div>
      )}

      {success && (
        <div className="warning-success">
          {success}
        </div>
      )}

      <section className="warning-card">
        <h2>
          1. Pending Citizen
          Reports
        </h2>

        {reports.length ===
          0 && (
          <p className="empty-state">
            No pending citizen
            reports.
          </p>
        )}

        <div className="report-grid">
          {reports.map(
            (report) => (
              <button
                type="button"
                key={
                  report._id
                }
                className="report-card"
                onClick={() =>
                  chooseReport(
                    report
                  )
                }
              >
                <strong>
                  {
                    report.referenceId
                  }
                </strong>

                <span>
                  {
                    report.hazardType
                  }
                </span>

                <small>
                  {
                    report.description
                  }
                </small>
              </button>
            )
          )}
        </div>
      </section>

      {selectedReport && (
        <section className="warning-card">
          <h2>
            2. Review Report
            Evidence
          </h2>

          <div className="evidence-grid">
            <div>
              <h3>
                Citizen evidence
              </h3>

              <p>
                <strong>
                  Reference:
                </strong>{' '}
                {
                  selectedReport.referenceId
                }
              </p>

              <p>
                <strong>
                  Hazard:
                </strong>{' '}
                {
                  selectedReport.hazardType
                }
              </p>

              <p>
                {
                  selectedReport.description
                }
              </p>

              <p>
                GPS:{' '}
                {
                  selectedReport.location
                    .latitude
                }
                ,{' '}
                {
                  selectedReport.location
                    .longitude
                }
              </p>

              {selectedReport.media
                ?.map(
                  (
                    media
                  ) => (
                    <div
                      key={
                        media.fileName
                      }
                      className="media-item"
                    >
                      {
                        media.mimeType
                          ?.startsWith(
                            'image/'
                          ) &&
                        media.dataUrl && (
                          <img
                            src={
                              media.dataUrl
                            }
                            alt={
                              media.fileName
                            }
                          />
                        )
                      }

                      <span>
                        {
                          media.fileName
                        }
                      </span>
                    </div>
                  )
                )}
            </div>

            <div>
              <h3>
                Nearby recent
                sensors
              </h3>

              {reportSensors.length ===
                0 && (
                <p>
                  No relevant
                  recent sensor
                  readings found.
                </p>
              )}

              {reportSensors.map(
                (sensor) => (
                  <label
                    className="sensor-row"
                    key={
                      sensor._id
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        selectedSensorIds.includes(
                          sensor._id
                        )
                      }
                      onChange={() =>
                        toggleReportSensor(
                          sensor._id
                        )
                      }
                    />

                    <span>
                      <strong>
                        {
                          sensor.sensorCode
                        }
                      </strong>

                      <small>
                        {
                          sensor.value
                        }{' '}
                        {
                          sensor.unit
                        }{' '}
                        ·{' '}
                        {
                          sensor.proximityKm
                        }{' '}
                        km ·{' '}
                        {
                          sensor.ageMinutes
                        }{' '}
                        min old
                      </small>
                    </span>
                  </label>
                )
              )}
            </div>
          </div>

          <label className="remarks-field">
            Officer remarks

            <textarea
              rows="4"
              value={
                remarks
              }
              onChange={(
                event
              ) =>
                setRemarks(
                  event.target
                    .value
                )
              }
            />
          </label>

          <div className="warning-actions">
            <button
              type="button"
              onClick={() =>
                reviewReport(
                  'VERIFIED'
                )
              }
            >
              Verify
            </button>

            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                reviewReport(
                  'CONFLICTING'
                )
              }
            >
              Flag Sensor
              Conflict
            </button>

            <button
              type="button"
              className="danger-action"
              onClick={() =>
                reviewReport(
                  'DISMISSED'
                )
              }
            >
              Dismiss
            </button>
          </div>

          {verificationLogs.length >
            0 && (
            <>
              <h3>
                Verification
                history
              </h3>

              {verificationLogs.map(
                (log) => (
                  <div
                    className="history-row"
                    key={
                      log._id
                    }
                  >
                    <strong>
                      {
                        log.decision
                      }
                    </strong>

                    <span>
                      {
                        log.remarks ||
                        'No remarks'
                      }
                    </span>

                    <small>
                      {formatDate(
                        log.decidedAt
                      )}
                    </small>
                  </div>
                )
              )}
            </>
          )}
        </section>
      )}

      <section className="warning-card">
        <h2>
          3. Sensor-only
          Evidence
        </h2>

        <p>
          A warning may be
          initiated without a
          citizen report.
        </p>

        <div className="coordinate-row">
          <input
            type="number"
            step="any"
            value={
              latitude
            }
            onChange={(
              event
            ) =>
              setLatitude(
                event.target
                  .value
              )
            }
          />

          <input
            type="number"
            step="any"
            value={
              longitude
            }
            onChange={(
              event
            ) =>
              setLongitude(
                event.target
                  .value
              )
            }
          />

          <button
            type="button"
            onClick={
              findManualSensors
            }
          >
            Find Sensors
          </button>
        </div>

        {manualSensors.map(
          (sensor) => (
            <label
              className="sensor-row"
              key={
                sensor._id
              }
            >
              <input
                type="checkbox"
                checked={
                  selectedSensorIds.includes(
                    sensor._id
                  )
                }
                onChange={() =>
                  toggleReportSensor(
                    sensor._id
                  )
                }
              />

              <span>
                <strong>
                  {
                    sensor.sensorCode
                  }
                </strong>

                <small>
                  {
                    sensor.proximityKm
                  }{' '}
                  km away ·{' '}
                  {
                    sensor.ageMinutes
                  }{' '}
                  min old
                </small>
              </span>
            </label>
          )
        )}
      </section>

      <section className="warning-card">
        <h2>
          4. Prepare Warning
        </h2>

        <form
          className="warning-form"
          onSubmit={
            createDraft
          }
        >
          <label>
            Warning source

            <select
              value={
                sourceType
              }
              onChange={(
                event
              ) =>
                setSourceType(
                  event.target
                    .value
                )
              }
            >
              <option value="SENSOR">
                Sensor evidence
                only
              </option>

              <option value="REPORT">
                Verified citizen
                report
              </option>
            </select>
          </label>

          <label>
            Target zone type

            <select
              value={
                targetType
              }
              onChange={(
                event
              ) =>
                setTargetType(
                  event.target
                    .value
                )
              }
            >
              <option value="DISTRICT">
                District
              </option>

              <option value="RIVER_BASIN">
                River Basin
              </option>
            </select>
          </label>

          <label>
            Target zone name

            <input
              value={
                targetName
              }
              onChange={(
                event
              ) =>
                setTargetName(
                  event.target
                    .value
                )
              }
              required
            />
          </label>

          <label>
            Severity

            <select
              value={
                severity
              }
              onChange={(
                event
              ) =>
                setSeverity(
                  event.target
                    .value
                )
              }
            >
              {severityLevels.map(
                (level) => (
                  <option
                    key={
                      level
                    }
                    value={
                      level
                    }
                  >
                    {
                      level
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Warning message

            <textarea
              rows="5"
              minLength="10"
              value={
                warningMessage
              }
              onChange={(
                event
              ) =>
                setWarningMessage(
                  event.target
                    .value
                )
              }
              required
            />
          </label>

          <fieldset>
            <legend>
              Notification
              channels
            </legend>

            {[
              'PUSH',
              'SMS',
              'AUDIBLE',
            ].map(
              (channel) => (
                <label
                  key={
                    channel
                  }
                >
                  <input
                    type="checkbox"
                    checked={
                      channels[
                        channel
                      ]
                    }
                    onChange={() =>
                      toggleChannel(
                        channel
                      )
                    }
                  />

                  {
                    channel
                  }
                </label>
              )
            )}
          </fieldset>

          <button
            disabled={
              loading
            }
          >
            Create Draft
          </button>
        </form>
      </section>

      <section className="warning-card">
        <h2>
          5. Warning
          Lifecycle
        </h2>

        <div className="warning-layout">
          <div className="warning-list">
            {warnings.map(
              (warning) => (
                <button
                  type="button"
                  key={
                    warning._id
                  }
                  onClick={() =>
                    selectWarning(
                      warning
                    )
                  }
                >
                  <strong>
                    {
                      warning.warningCode
                    }
                  </strong>

                  <span>
                    {
                      warning.targetZone
                        .name
                    }
                  </span>

                  <small>
                    {
                      warning.severity
                    }{' '}
                    ·{' '}
                    {
                      warning.lifecycleStatus
                    }
                  </small>
                </button>
              )
            )}
          </div>

          {selectedWarning && (
            <div className="warning-detail">
              <h3>
                {
                  selectedWarning.warningCode
                }
              </h3>

              <p>
                Target:{' '}
                <strong>
                  {
                    selectedWarning.targetZone
                      .name
                  }
                </strong>
              </p>

              <p>
                Severity:{' '}
                <strong>
                  {
                    selectedWarning.severity
                  }
                </strong>
              </p>

              <p>
                Status:{' '}
                <strong>
                  {
                    selectedWarning.lifecycleStatus
                  }
                </strong>
              </p>

              <p>
                {
                  selectedWarning.message
                }
              </p>

              <p>
                District Officer:
                {' '}
                {
                  selectedWarning
                    .districtOfficerNotification
                    ?.status
                }
              </p>

              <div className="warning-actions">
                {selectedWarning.lifecycleStatus ===
                  'DRAFT' && (
                  <button
                    type="button"
                    onClick={
                      handleBroadcast
                    }
                  >
                    Confirm &
                    Broadcast
                  </button>
                )}

                {[
                  'ACTIVE',
                  'DE_ESCALATED',
                ].includes(
                  selectedWarning.lifecycleStatus
                ) && (
                  <button
                    type="button"
                    onClick={() =>
                      changeLifecycle(
                        'ESCALATE'
                      )
                    }
                  >
                    Escalate
                  </button>
                )}

                {[
                  'ACTIVE',
                  'ESCALATED',
                ].includes(
                  selectedWarning.lifecycleStatus
                ) && (
                  <button
                    type="button"
                    onClick={() =>
                      changeLifecycle(
                        'DE_ESCALATE'
                      )
                    }
                  >
                    De-escalate
                  </button>
                )}

                {![
                  'DRAFT',
                  'CANCELLED',
                ].includes(
                  selectedWarning.lifecycleStatus
                ) && (
                  <button
                    type="button"
                    className="danger-action"
                    onClick={() =>
                      changeLifecycle(
                        'CANCEL'
                      )
                    }
                  >
                    Cancel &
                    Send All
                    Clear
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-action"
                  onClick={
                    retryFailed
                  }
                >
                  Retry Failed
                  Channels
                </button>
              </div>

              <h4>
                Delivery results
              </h4>

              {deliveries.map(
                (delivery) => (
                  <div
                    className="delivery-row"
                    key={
                      delivery._id
                    }
                  >
                    <span>
                      {
                        delivery.channel
                      }
                    </span>

                    <span>
                      {
                        delivery.notificationType
                      }
                    </span>

                    <strong>
                      {
                        delivery.status
                      }
                    </strong>

                    <span>
                      Attempts:{' '}
                      {
                        delivery.attemptCount
                      }
                    </span>
                  </div>
                )
              )}

              <h4>
                Lifecycle history
              </h4>

              {selectedWarning
                .lifecycleHistory
                ?.slice()
                .reverse()
                .map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      className="history-row"
                      key={`${item.action}-${index}`}
                    >
                      <strong>
                        {
                          item.action
                        }
                      </strong>

                      <span>
                        {
                          item.fromStatus ||
                          '—'
                        }{' '}
                        →{' '}
                        {
                          item.toStatus
                        }
                      </span>

                      <span>
                        {
                          item.previousSeverity ||
                          '—'
                        }{' '}
                        →{' '}
                        {
                          item.newSeverity ||
                          '—'
                        }
                      </span>

                      <small>
                        {formatDate(
                          item.changedAt
                        )}
                      </small>
                    </div>
                  )
                )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}