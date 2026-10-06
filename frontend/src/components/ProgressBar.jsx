export default function ProgressBar({
  currentStep,
  totalSteps,
}) {
  const percentage =
    (currentStep /
      totalSteps) *
    100;

  const stepLabels = [
    'Details',
    'Location',
    'Evidence',
    'Review',
  ];

  return (
    <div className="progress-section">
      <div className="progress-info">
        <span className="progress-info-label">
          Step {currentStep} of{' '}
          {totalSteps}
        </span>

        <span className="progress-info-percent">
          {Math.round(
            percentage
          )}
          %
        </span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={Math.round(
          percentage
        )}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="progress-fill"
          style={{
            width:
              `${percentage}%`,
          }}
        />
      </div>

      <ol className="progress-steps">
        {stepLabels
          .slice(0, totalSteps)
          .map((label, index) => {
            const stepNumber =
              index + 1;

            const state =
              stepNumber <
              currentStep
                ? 'completed'
                : stepNumber ===
                    currentStep
                  ? 'active'
                  : 'upcoming';

            return (
              <li
                key={label}
                className={`progress-step ${state}`}
              >
                <span className="progress-step-dot">
                  {state ===
                  'completed'
                    ? '✓'
                    : stepNumber}
                </span>

                <span className="progress-step-label">
                  {label}
                </span>
              </li>
            );
          })}
      </ol>
    </div>
  );
}