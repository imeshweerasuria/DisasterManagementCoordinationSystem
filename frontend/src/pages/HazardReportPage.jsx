import {
  useEffect,
  useState,
} from 'react';

import ProgressBar
  from '../components/ProgressBar';

import {
  submitHazardReport,
} from '../services/hazardReportService';

import {
  saveOfflineReport,
  syncOfflineReports,
} from '../services/offlineQueueService';

import '../styles/HazardReport.css';

const initialForm = {
  citizenId:
    'DEMO-CITIZEN-001',

  citizenPhone:
    '0771234567',

  hazardType:
    '',

  description:
    '',

  severity:
    'MEDIUM',

  location: {
    latitude:
      '',

    longitude:
      '',

    address:
      '',

    source:
      'GPS',
  },

  media: [],
};

export default function HazardReportPage() {
  const [
    step,
    setStep,
  ] =
    useState(1);

  const [
    form,
    setForm,
  ] =
    useState(initialForm);

  const [
    errors,
    setErrors,
  ] =
    useState({});

  const [
    isLoadingLocation,
    setIsLoadingLocation,
  ] =
    useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  const [
    submissionResult,
    setSubmissionResult,
  ] =
    useState(null);

  const [
    online,
    setOnline,
  ] =
    useState(
      navigator.onLine
    );

  useEffect(() => {
    const handleOnline =
      async () => {
        setOnline(true);

        await syncOfflineReports();
      };

    const handleOffline =
      () => {
        setOnline(false);
      };

    window.addEventListener(
      'online',
      handleOnline
    );

    window.addEventListener(
      'offline',
      handleOffline
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline
      );

      window.removeEventListener(
        'offline',
        handleOffline
      );
    };
  }, []);

  function updateField(
    field,
    value
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [field]:
          value,
      })
    );
  }

  function updateLocation(
    field,
    value
  ) {
    setForm(
      (previous) => ({
        ...previous,

        location: {
          ...previous.location,

          [field]:
            value,
        },
      })
    );
  }

  function validateStepOne() {
    const newErrors = {};

    if (
      !form.hazardType
    ) {
      newErrors.hazardType =
        'Please select a hazard type.';
    }

    if (
      form.description
        .trim()
        .length < 10
    ) {
      newErrors.description =
        'Please enter at least 10 characters.';
    }

    setErrors(
      newErrors
    );

    return (
      Object.keys(
        newErrors
      ).length === 0
    );
  }

  function validateLocationStep() {
    const newErrors = {};

    const latitude =
      Number(
        form.location
          .latitude
      );

    const longitude =
      Number(
        form.location
          .longitude
      );

    if (
      form.location
        .latitude === '' ||
      Number.isNaN(
        latitude
      ) ||
      latitude < -90 ||
      latitude > 90
    ) {
      newErrors.latitude =
        'Enter a valid latitude.';
    }

    if (
      form.location
        .longitude === '' ||
      Number.isNaN(
        longitude
      ) ||
      longitude < -180 ||
      longitude > 180
    ) {
      newErrors.longitude =
        'Enter a valid longitude.';
    }

    setErrors(
      newErrors
    );

    return (
      Object.keys(
        newErrors
      ).length === 0
    );
  }

  function nextFromDetails() {
    if (
      validateStepOne()
    ) {
      setErrors({});
      setStep(2);
    }
  }

  function nextFromLocation() {
    if (
      validateLocationStep()
    ) {
      setErrors({});
      setStep(3);
    }
  }

  function detectLocation() {
    if (
      !navigator
        .geolocation
    ) {
      setErrors({
        location:
          'Geolocation is not supported. Please enter the location manually.',
      });

      return;
    }

    setIsLoadingLocation(
      true
    );

    navigator.geolocation
      .getCurrentPosition(
        (position) => {
          setForm(
            (previous) => ({
              ...previous,

              location: {
                ...previous.location,

                latitude:
                  position
                    .coords
                    .latitude
                    .toFixed(
                      6
                    ),

                longitude:
                  position
                    .coords
                    .longitude
                    .toFixed(
                      6
                    ),

                source:
                  'GPS',
              },
            })
          );

          setErrors({});
          setIsLoadingLocation(
            false
          );
        },

        () => {
          setErrors({
            location:
              'GPS location could not be detected. Please enter it manually.',
          });

          setForm(
            (previous) => ({
              ...previous,

              location: {
                ...previous.location,

                source:
                  'MANUAL',
              },
            })
          );

          setIsLoadingLocation(
            false
          );
        }
      );
  }

  async function handleMedia(
    event
  ) {
    const files =
      Array.from(
        event.target.files
      );

    if (
      files.length === 0
    ) {
      return;
    }

    if (
      form.media.length +
        files.length >
      3
    ) {
      setErrors({
        media:
          'Maximum 3 attachments allowed.',
      });

      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'video/mp4',
    ];

    const maxSize =
      2 *
      1024 *
      1024;

    const processed = [];

    for (
      const file of files
    ) {
      if (
        !allowedTypes.includes(
          file.type
        )
      ) {
        setErrors({
          media:
            'Only JPG, PNG and MP4 files are supported.',
        });

        return;
      }

      if (
        file.size >
        maxSize
      ) {
        setErrors({
          media:
            'Each file must be 2 MB or smaller.',
        });

        return;
      }

      const dataUrl =
        await fileToDataUrl(
          file
        );

      processed.push({
        fileName:
          file.name,

        mimeType:
          file.type,

        size:
          file.size,

        dataUrl,
      });
    }

    setForm(
      (previous) => ({
        ...previous,

        media: [
          ...previous.media,
          ...processed,
        ],
      })
    );

    setErrors({});
  }

  function removeMedia(
    index
  ) {
    setForm(
      (previous) => ({
        ...previous,

        media:
          previous.media.filter(
            (
              _,
              mediaIndex
            ) =>
              mediaIndex !==
              index
          ),
      })
    );
  }

  async function handleSubmit() {
    setIsSubmitting(
      true
    );

    const report = {
      ...form,

      clientSubmissionId:
        crypto.randomUUID(),

      location: {
        ...form.location,

        latitude:
          Number(
            form.location
              .latitude
          ),

        longitude:
          Number(
            form.location
              .longitude
          ),
      },
    };

    try {
      if (
        !navigator.onLine
      ) {
        saveOfflineReport(
          report
        );

        setSubmissionResult({
          type:
            'PENDING_SYNC',

          referenceId:
            report.clientSubmissionId,

          message:
            'No internet connection. Your report has been safely stored and will sync automatically.',
        });

        setStep(5);

        return;
      }

      const result =
        await submitHazardReport(
          report
        );

      setSubmissionResult({
        type:
          'SENT',

        referenceId:
          result.data
            .referenceId,

        message:
          result.message,

        verificationStatus:
          result.data
            .verificationStatus,
      });

      setStep(5);
    } catch (error) {
      saveOfflineReport(
        report
      );

      setSubmissionResult({
        type:
          'SYNC_FAILED',

        referenceId:
          report.clientSubmissionId,

        message:
          'Submission could not reach the server. The report was stored for retry.',
      });

      setStep(5);
    } finally {
      setIsSubmitting(
        false
      );
    }
  }

  function resetReport() {
    setForm(
      initialForm
    );

    setErrors({});
    setSubmissionResult(
      null
    );

    setStep(1);
  }

  return (
    <div className="report-page">
      <div className="mobile-shell">
        <header className="report-header">
          <div>
            <p className="eyebrow">
              DMC Citizen
              Reporting
            </p>

            <h1>
              Report a Hazard
            </h1>
          </div>

          <span
            className={
              online
                ? 'network-status online'
                : 'network-status offline'
            }
          >
            {online
              ? 'Online'
              : 'Offline'}
          </span>
        </header>

        {!online && (
          <div
            className="offline-banner"
            role="status"
            aria-live="polite"
          >
            <span className="offline-banner-icon">
              !
            </span>

            <div className="offline-banner-text">
              <strong>
                You are offline
              </strong>

              <span>
                Reports will be saved
                locally as Pending Sync
                and sent automatically
                when connectivity returns.
              </span>
            </div>
          </div>
        )}

        {step <= 4 && (
          <ProgressBar
            currentStep={
              step
            }
            totalSteps={
              4
            }
          />
        )}

        {step === 1 && (
          <section className="step-card">
            <div className="step-heading">
              <span className="step-heading-badge">
                Step 1
              </span>

              <h2>
                Report details
              </h2>
            </div>

            <p className="muted">
              Tell us what is
              happening. Clear
              details help responders
              act faster.
            </p>

            <label htmlFor="hazardType">
              Hazard type *
            </label>

            <select
              id="hazardType"
              value={
                form.hazardType
              }
              onChange={(
                event
              ) =>
                updateField(
                  'hazardType',
                  event.target
                    .value
                )
              }
            >
              <option value="">
                Select hazard
              </option>

              <option value="FLOODING">
                Flooding /
                Rising Water
              </option>

              <option value="LANDSLIDE">
                Landslide /
                Slope Crack
              </option>

              <option value="BLOCKED_ROAD">
                Blocked Road
              </option>
            </select>

            {errors.hazardType && (
              <p className="error">
                {
                  errors.hazardType
                }
              </p>
            )}

            <label htmlFor="description">
              Description *
            </label>

            <textarea
              id="description"
              rows="5"
              maxLength="1000"
              placeholder="Describe what you can see..."
              value={
                form.description
              }
              onChange={(
                event
              ) =>
                updateField(
                  'description',
                  event.target
                    .value
                )
              }
            />

            <div className="character-count">
              {
                form.description
                  .length
              }
              /1000
            </div>

            {errors.description && (
              <p className="error">
                {
                  errors.description
                }
              </p>
            )}

            <label>
              Severity
            </label>

            <div
              className="severity-row"
              role="group"
              aria-label="Severity"
            >
              {[
                'LOW',
                'MEDIUM',
                'HIGH',
              ].map(
                (
                  severity
                ) => (
                  <button
                    type="button"
                    key={
                      severity
                    }
                    data-severity={
                      severity
                    }
                    aria-pressed={
                      form.severity ===
                      severity
                    }
                    className={
                      form.severity ===
                      severity
                        ? 'severity-button active'
                        : 'severity-button'
                    }
                    onClick={() =>
                      updateField(
                        'severity',
                        severity
                      )
                    }
                  >
                    {
                      severity
                    }
                  </button>
                )
              )}
            </div>

            <button
              className="primary-button"
              onClick={
                nextFromDetails
              }
            >
              Continue
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="step-card">
            <div className="step-heading">
              <span className="step-heading-badge">
                Step 2
              </span>

              <h2>
                Confirm location
              </h2>
            </div>

            <p className="muted">
              Use your current GPS
              position or enter the
              location manually.
            </p>

            <button
              className="secondary-button"
              onClick={
                detectLocation
              }
              disabled={
                isLoadingLocation
              }
            >
              {isLoadingLocation
                ? 'Detecting...'
                : 'Use Current GPS Location'}
            </button>

            {errors.location && (
              <p className="error">
                {
                  errors.location
                }
              </p>
            )}

            <label htmlFor="latitude">
              Latitude *
            </label>

            <input
              id="latitude"
              type="number"
              step="any"
              value={
                form.location
                  .latitude
              }
              onChange={(
                event
              ) => {
                updateLocation(
                  'latitude',
                  event.target
                    .value
                );

                updateLocation(
                  'source',
                  'MANUAL'
                );
              }}
            />

            {errors.latitude && (
              <p className="error">
                {
                  errors.latitude
                }
              </p>
            )}

            <label htmlFor="longitude">
              Longitude *
            </label>

            <input
              id="longitude"
              type="number"
              step="any"
              value={
                form.location
                  .longitude
              }
              onChange={(
                event
              ) => {
                updateLocation(
                  'longitude',
                  event.target
                    .value
                );

                updateLocation(
                  'source',
                  'MANUAL'
                );
              }}
            />

            {errors.longitude && (
              <p className="error">
                {
                  errors.longitude
                }
              </p>
            )}

            <label htmlFor="address">
              Location /
              landmark
            </label>

            <input
              id="address"
              type="text"
              placeholder="Example: Kelani Bridge, Kelaniya"
              value={
                form.location
                  .address
              }
              onChange={(
                event
              ) =>
                updateLocation(
                  'address',
                  event.target
                    .value
                )
              }
            />

            <div className="info-box">
              Location source:{' '}
              <strong>
                {
                  form
                    .location
                    .source
                }
              </strong>
            </div>

            <div className="button-row">
              <button
                className="secondary-button"
                onClick={() =>
                  setStep(1)
                }
              >
                Back
              </button>

              <button
                className="primary-button"
                onClick={
                  nextFromLocation
                }
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="step-card">
            <div className="step-heading">
              <span className="step-heading-badge">
                Step 3
              </span>

              <h2>
                Evidence
              </h2>
            </div>

            <p className="muted">
              Evidence is optional.
              You may upload up to
              three JPG, PNG or MP4
              files, each up to 2 MB.
            </p>

            <label className="upload-box">
              <span>
                + Add photo or
                video
              </span>

              <small>
                JPG, PNG or MP4 —
                maximum 2 MB each
              </small>

              <input
                hidden
                multiple
                type="file"
                accept=".jpg,.jpeg,.png,.mp4"
                onChange={
                  handleMedia
                }
              />
            </label>

            {errors.media && (
              <p className="error">
                {
                  errors.media
                }
              </p>
            )}

            <div className="media-list">
              {form.media.map(
                (
                  item,
                  index
                ) => (
                  <div
                    className="media-item"
                    key={`${item.fileName}-${index}`}
                  >
                    <div>
                      <strong>
                        {
                          item.fileName
                        }
                      </strong>

                      <p>
                        {(
                          item.size /
                          1024
                        ).toFixed(
                          1
                        )}{' '}
                        KB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeMedia(
                          index
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="button-row">
              <button
                className="secondary-button"
                onClick={() =>
                  setStep(2)
                }
              >
                Back
              </button>

              <button
                className="primary-button"
                onClick={() =>
                  setStep(4)
                }
              >
                Review
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="step-card">
            <div className="step-heading">
              <span className="step-heading-badge">
                Step 4
              </span>

              <h2>
                Review report
              </h2>
            </div>

            <p className="muted">
              Please confirm the
              information before
              submitting.
            </p>

            <div className="review-card">
              <ReviewItem
                label="Hazard"
                value={
                  form.hazardType
                }
              />

              <ReviewItem
                label="Severity"
                value={
                  form.severity
                }
              />

              <ReviewItem
                label="Description"
                value={
                  form.description
                }
              />

              <ReviewItem
                label="Location"
                value={`${form.location.latitude}, ${form.location.longitude}`}
              />

              <ReviewItem
                label="Landmark"
                value={
                  form.location
                    .address ||
                  'Not provided'
                }
              />

              <ReviewItem
                label="Location source"
                value={
                  form.location
                    .source
                }
              />

              <ReviewItem
                label="Evidence"
                value={`${form.media.length} attachment(s)`}
              />
            </div>

            {!online && (
              <div className="warning-box">
                You are offline.
                The report will be
                stored as Pending
                Sync and automatically
                retried later.
              </div>
            )}

            <div className="button-row">
              <button
                className="secondary-button"
                onClick={() =>
                  setStep(3)
                }
              >
                Back
              </button>

              <button
                className="primary-button"
                disabled={
                  isSubmitting
                }
                onClick={
                  handleSubmit
                }
              >
                {isSubmitting
                  ? 'Submitting...'
                  : online
                    ? 'Submit Report'
                    : 'Save for Sync'}
              </button>
            </div>
          </section>
        )}

        {step === 5 &&
          submissionResult && (
            <section
              className={
                submissionResult.type ===
                'SENT'
                  ? 'step-card confirmation-card'
                  : 'step-card confirmation-card pending'
              }
            >
              <div className="success-icon">
                {submissionResult.type ===
                'SENT'
                  ? '✓'
                  : '↻'}
              </div>

              <h2>
                {submissionResult.type ===
                'SENT'
                  ? 'Report Submitted'
                  : 'Report Saved'}
              </h2>

              <p>
                {
                  submissionResult.message
                }
              </p>

              <div className="reference-box">
                <span>
                  Reference
                </span>

                <strong>
                  {
                    submissionResult.referenceId
                  }
                </strong>
              </div>

              <div className="status-grid">
                <div>
                  <span>
                    Verification
                  </span>

                  <strong>
                    {submissionResult.verificationStatus ||
                      'UNVERIFIED'}
                  </strong>
                </div>

                <div>
                  <span>
                    Sync status
                  </span>

                  <strong>
                    {
                      submissionResult.type
                    }
                  </strong>
                </div>
              </div>

              <button
                className="primary-button"
                onClick={
                  resetReport
                }
              >
                Submit Another
                Report
              </button>
            </section>
          )}
      </div>
    </div>
  );
}

function ReviewItem({
  label,
  value,
}) {
  return (
    <div className="review-item">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function fileToDataUrl(
  file
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onload =
        () =>
          resolve(
            reader.result
          );

      reader.onerror =
        reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}