const mongoose = require('mongoose');
const HazardReport = require('../models/HazardReport');
const SensorReading = require('../models/SensorReading');
const VerificationLog = require('../models/VerificationLog');
const HazardWarning = require('../models/HazardWarning');
const NotificationDelivery = require('../models/NotificationDelivery');
const VALID_CHANNELS = [
  'PUSH',
  'SMS',
  'AUDIBLE',
];

const VALID_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

const SEVERITY_RANK = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function createHttpError(message, statusCode = 400) 
{
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function generateWarningCode() {
  const year = new Date().getUTCFullYear();
  const random = Math.floor(100000 + Math.random() * 900000); // Generates a random 6-digit number
  return `HW-${year}-${random}`;
}

async function
generateUniqueWarningCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generateWarningCode();
    const exists = await HazardWarning.exists({warningCode: candidate,});

    if (!exists) {
      return candidate;
    }
  }

  throw createHttpError('Could not generate a unique warning code.',500);
}

function validateTargetZone(targetZone) {
  if (
    !targetZone ||
    typeof targetZone !==
      'object'
  ) {
    throw createHttpError(
      'A valid target zone is required.'
    );
  }

  if (
    ![
      'DISTRICT',
      'RIVER_BASIN',
    ].includes(
      targetZone.type
    )
  ) {
    throw createHttpError(
      'Target zone type must be DISTRICT or RIVER_BASIN.'
    );
  }

  if (
    !targetZone.name ||
    !String(
      targetZone.name
    ).trim()
  ) {
    throw createHttpError(
      'Target zone name is required.'
    );
  }
}

function validateChannels(
  channels
) {
  if (
    !Array.isArray(
      channels
    ) ||
    channels.length === 0
  ) {
    throw createHttpError(
      'At least one notification channel is required.'
    );
  }

  const uniqueChannels =
    [
      ...new Set(
        channels
      ),
    ];

  const invalid =
    uniqueChannels.filter(
      (channel) =>
        !VALID_CHANNELS.includes(
          channel
        )
    );

  if (
    invalid.length > 0
  ) {
    throw createHttpError(
      `Unsupported notification channel: ${invalid.join(
        ', '
      )}`
    );
  }

  return uniqueChannels;
}

function validateSeverity(
  severity
) {
  if (
    !VALID_SEVERITIES.includes(
      severity
    )
  ) {
    throw createHttpError(
      'Severity must be LOW, MEDIUM, HIGH or CRITICAL.'
    );
  }
}

function toRadians(
  value
) {
  return (
    value *
    Math.PI /
    180
  );
}

function calculateDistanceKm(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const earthRadiusKm =
    6371;

  const dLat =
    toRadians(
      latitude2 -
        latitude1
    );

  const dLon =
    toRadians(
      longitude2 -
        longitude1
    );

  const lat1 =
    toRadians(
      latitude1
    );

  const lat2 =
    toRadians(
      latitude2
    );

  const a =
    Math.sin(
      dLat / 2
    ) ** 2 +
    Math.cos(
      lat1
    ) *
      Math.cos(
        lat2
      ) *
      Math.sin(
        dLon / 2
      ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a
      )
    );

  return (
    earthRadiusKm *
    c
  );
}

async function
createSensorReading(
  payload
) {
  const {
    sensorCode,
    sensorType,
    district,
    latitude,
    longitude,
    value,
    unit,
    recordedAt =
      new Date(),
  } = payload;

  if (
    !sensorCode ||
    !sensorType ||
    !district ||
    latitude ===
      undefined ||
    longitude ===
      undefined ||
    value ===
      undefined ||
    !unit
  ) {
    throw createHttpError(
      'sensorCode, sensorType, district, latitude, longitude, value and unit are required.'
    );
  }

  return SensorReading.create({
    sensorCode,
    sensorType,
    district,
    latitude,
    longitude,
    value,
    unit,
    recordedAt,
  });
}

async function
getSensorEvidence({
  latitude,
  longitude,
  maxDistanceKm =
    50,
  maxAgeMinutes =
    180,
}) {
  const lat =
    Number(
      latitude
    );

  const lng =
    Number(
      longitude
    );

  const maxDistance =
    Number(
      maxDistanceKm
    );

  const maxAge =
    Number(
      maxAgeMinutes
    );

  if (
    Number.isNaN(lat) ||
    lat < -90 ||
    lat > 90 ||
    Number.isNaN(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    throw createHttpError(
      'Valid latitude and longitude are required.'
    );
  }

  if (
    Number.isNaN(
      maxDistance
    ) ||
    maxDistance <= 0 ||
    Number.isNaN(
      maxAge
    ) ||
    maxAge <= 0
  ) {
    throw createHttpError(
      'maxDistanceKm and maxAgeMinutes must be positive numbers.'
    );
  }

  const cutoff =
    new Date(
      Date.now() -
        maxAge *
          60 *
          1000
    );

  const readings =
    await SensorReading
      .find({
        recordedAt: {
          $gte:
            cutoff,
        },
      })
      .sort({
        recordedAt: -1,
      });

  return readings
    .map(
      (reading) => {
        const proximityKm =
          calculateDistanceKm(
            lat,
            lng,
            reading.latitude,
            reading.longitude
          );

        const ageMinutes =
          (
            Date.now() -
            new Date(
              reading.recordedAt
            ).getTime()
          ) /
          60000;

        return {
          ...reading.toObject(),

          proximityKm:
            Number(
              proximityKm
                .toFixed(2)
            ),

          ageMinutes:
            Number(
              ageMinutes
                .toFixed(1)
            ),
        };
      }
    )
    .filter(
      (reading) =>
        reading.proximityKm <=
        maxDistance
    );
}

async function
reviewReport(
  reportId,
  {
    decision,
    officerId,
    remarks = '',
    comparedSensorIds =
      [],
  }
) {
  if (
    !mongoose.Types.ObjectId
      .isValid(
        reportId
      )
  ) {
    throw createHttpError(
      'Invalid report ID.'
    );
  }

  if (
    ![
      'VERIFIED',
      'DISMISSED',
      'CONFLICTING',
    ].includes(
      decision
    )
  ) {
    throw createHttpError(
      'decision must be VERIFIED, DISMISSED or CONFLICTING.'
    );
  }

  if (
    !officerId ||
    !String(
      officerId
    ).trim()
  ) {
    throw createHttpError(
      'officerId is required.'
    );
  }

  const report =
    await HazardReport.findById(
      reportId
    );

  if (!report) {
    throw createHttpError(
      'Hazard report was not found.',
      404
    );
  }

  if (
    !Array.isArray(
      comparedSensorIds
    )
  ) {
    throw createHttpError(
      'comparedSensorIds must be an array.'
    );
  }

  if (
    decision ===
    'VERIFIED'
  ) {
    report.verificationStatus =
      'VERIFIED';

    report.dutyOfficerQueueStatus =
      'COMPLETED';
  }

  if (
    decision ===
    'DISMISSED'
  ) {
    report.verificationStatus =
      'DISMISSED';

    report.dutyOfficerQueueStatus =
      'COMPLETED';
  }

  if (
    decision ===
    'CONFLICTING'
  ) {
    report.verificationStatus =
      'UNVERIFIED';

    report.dutyOfficerQueueStatus =
      'UNDER_REVIEW';
  }

  await report.save();

  const verificationLog =
    await VerificationLog.create({
      reportId:
        report._id,

      officerId:
        String(
          officerId
        ).trim(),

      decision,

      remarks:
        String(
          remarks
        ).trim(),

      comparedSensorIds,
    });

  return {
    report,
    verificationLog,
  };
}

async function
getVerificationHistory(
  reportId
) {
  if (
    !mongoose.Types.ObjectId
      .isValid(
        reportId
      )
  ) {
    throw createHttpError(
      'Invalid report ID.'
    );
  }

  return VerificationLog
    .find({
      reportId,
    })
    .populate(
      'comparedSensorIds'
    )
    .sort({
      decidedAt: -1,
    });
}

async function createWarning(
  payload
) {
  const {
    sourceType,
    sourceReportId =
      null,
    sourceSensorIds =
      [],
    officerId,
    targetZone,
    severity,
    message,
    channels,
  } = payload;

  if (
    ![
      'REPORT',
      'SENSOR',
    ].includes(
      sourceType
    )
  ) {
    throw createHttpError(
      'sourceType must be REPORT or SENSOR.'
    );
  }

  if (
    !officerId ||
    !String(
      officerId
    ).trim()
  ) {
    throw createHttpError(
      'officerId is required.'
    );
  }

  validateTargetZone(
    targetZone
  );

  validateSeverity(
    severity
  );

  if (
    !message ||
    String(
      message
    ).trim().length < 10
  ) {
    throw createHttpError(
      'Warning message must contain at least 10 characters.'
    );
  }

  const cleanChannels =
    validateChannels(
      channels
    );

  if (
    sourceType ===
    'REPORT'
  ) {
    if (
      !sourceReportId
    ) {
      throw createHttpError(
        'sourceReportId is required for a report-based warning.'
      );
    }

    const report =
      await HazardReport.findById(
        sourceReportId
      );

    if (!report) {
      throw createHttpError(
        'Source hazard report was not found.',
        404
      );
    }

    if (
      report.verificationStatus !==
      'VERIFIED'
    ) {
      throw createHttpError(
        'The citizen report must be verified before it can be used for an official warning.',
        409
      );
    }

    const latestLog =
      await VerificationLog
        .findOne({
          reportId:
            report._id,
        })
        .sort({
          decidedAt: -1,
        });

    if (
      !latestLog ||
      latestLog.decision !==
        'VERIFIED'
    ) {
      throw createHttpError(
        'The latest verification decision must confirm the report before warning creation.',
        409
      );
    }
  }

  if (
    sourceType ===
    'SENSOR'
  ) {
    if (
      !Array.isArray(
        sourceSensorIds
      )
    ) {
      throw createHttpError(
        'sourceSensorIds must be an array.'
      );
    }

    if (
      sourceSensorIds.length >
      0
    ) {
      const validIds =
        sourceSensorIds.filter(
          (id) =>
            mongoose.Types
              .ObjectId
              .isValid(id)
        );

      if (
        validIds.length !==
        sourceSensorIds.length
      ) {
        throw createHttpError(
          'One or more sensor reading IDs are invalid.'
        );
      }

      const count =
        await SensorReading
          .countDocuments({
            _id: {
              $in:
                validIds,
            },
          });

      if (
        count !==
        validIds.length
      ) {
        throw createHttpError(
          'One or more sensor readings were not found.',
          404
        );
      }
    }
  }

  const warningCode =
    await generateUniqueWarningCode();

  return HazardWarning.create({
    warningCode,

    sourceType,

    sourceReportId:
      sourceType ===
      'REPORT'
        ? sourceReportId
        : null,

    sourceSensorIds:
      sourceType ===
      'SENSOR'
        ? sourceSensorIds
        : [],

    officerId:
      String(
        officerId
      ).trim(),

    targetZone: {
      type:
        targetZone.type,

      name:
        String(
          targetZone.name
        ).trim(),
    },

    severity,

    message:
      String(
        message
      ).trim(),

    channels:
      cleanChannels,

    lifecycleStatus:
      'DRAFT',

    districtOfficerNotification: {
      status:
        'PENDING',

      notifiedAt:
        null,
    },

    lifecycleHistory: [
      {
        action:
          'CREATED',

        fromStatus:
          null,

        toStatus:
          'DRAFT',

        previousSeverity:
          null,

        newSeverity:
          severity,

        message:
          String(
            message
          ).trim(),

        changedBy:
          String(
            officerId
          ).trim(),

        changedAt:
          new Date(),
      },
    ],
  });
}

async function
listWarnings() {
  return HazardWarning
    .find()
    .populate(
      'sourceReportId',
      'referenceId hazardType description verificationStatus dutyOfficerQueueStatus location media createdAt'
    )
    .populate(
      'sourceSensorIds',
      'sensorCode sensorType district latitude longitude value unit recordedAt'
    )
    .sort({
      createdAt: -1,
    });
}

async function
getWarningById(
  warningId
) {
  if (
    !mongoose.Types
      .ObjectId
      .isValid(
        warningId
      )
  ) {
    throw createHttpError(
      'Invalid warning ID.'
    );
  }

  const warning =
    await HazardWarning
      .findById(
        warningId
      )
      .populate(
        'sourceReportId'
      )
      .populate(
        'sourceSensorIds'
      );

  if (!warning) {
    throw createHttpError(
      'Warning was not found.',
      404
    );
  }

  return warning;
}

async function
persistDeliveryAttempt({
  warning,
  channel,
  notificationType,
  message,
  shouldFail =
    false,
}) {
  const now =
    new Date();

  return NotificationDelivery
    .create({
      warningId:
        warning._id,

      channel,

      notificationType,

      message,

      status:
        shouldFail
          ? 'FAILED'
          : 'DELIVERED',

      attemptCount: 1,

      lastAttemptAt:
        now,

      deliveredAt:
        shouldFail
          ? null
          : now,

      failureReason:
        shouldFail
          ? 'Simulated channel delivery failure.'
          : null,
    });
}

async function
sendToChannels({
  warning,
  notificationType =
    'WARNING',
  message,
  simulateFailedChannels =
    [],
}) {
  const failedSet =
    new Set(
      Array.isArray(
        simulateFailedChannels
      )
        ? simulateFailedChannels
        : []
    );

  return Promise.all(
    warning.channels.map(
      (channel) =>
        persistDeliveryAttempt({
          warning,

          channel,

          notificationType,

          message,

          shouldFail:
            failedSet.has(
              channel
            ),
        })
    )
  );
}

async function
broadcastWarning(
  warningId,
  {
    confirmed,
    officerId,
    simulateFailedChannels =
      [],
  }
) {
  if (
    confirmed !==
    true
  ) {
    throw createHttpError(
      'Explicit confirmation is required before broadcasting.'
    );
  }

  if (
    !officerId
  ) {
    throw createHttpError(
      'officerId is required.'
    );
  }

  const warning =
    await getWarningById(
      warningId
    );

  if (
    warning.lifecycleStatus !==
    'DRAFT'
  ) {
    throw createHttpError(
      'Only DRAFT warnings can be broadcast.',
      409
    );
  }

  validateTargetZone(
    warning.targetZone
  );

  validateSeverity(
    warning.severity
  );

  validateChannels(
    warning.channels
  );

  const fromStatus =
    warning.lifecycleStatus;

  warning.lifecycleStatus =
    'ACTIVE';

  warning.broadcastAt =
    new Date();

  warning
    .districtOfficerNotification =
    {
      status:
        'NOTIFIED',

      notifiedAt:
        new Date(),
    };

  warning.lifecycleHistory.push({
    action:
      'BROADCAST',

    fromStatus,

    toStatus:
      'ACTIVE',

    previousSeverity:
      warning.severity,

    newSeverity:
      warning.severity,

    message:
      warning.message,

    changedBy:
      officerId,

    changedAt:
      new Date(),
  });

  await warning.save();

  const deliveries =
    await sendToChannels({
      warning,

      notificationType:
        'WARNING',

      message:
        warning.message,

      simulateFailedChannels,
    });

  return {
    warning,
    deliveries,
  };
}

async function
changeLifecycle(
  warningId,
  {
    action,
    confirmed,
    officerId,
    newSeverity,
    message,
    simulateFailedChannels =
      [],
  }
) {
  if (
    ![
      'ESCALATE',
      'DE_ESCALATE',
      'CANCEL',
    ].includes(
      action
    )
  ) {
    throw createHttpError(
      'action must be ESCALATE, DE_ESCALATE or CANCEL.'
    );
  }

  if (
    !officerId
  ) {
    throw createHttpError(
      'officerId is required.'
    );
  }

  const warning =
    await getWarningById(
      warningId
    );

  if (
    warning.lifecycleStatus ===
    'DRAFT'
  ) {
    throw createHttpError(
      'A DRAFT warning must be broadcast before its lifecycle can change.',
      409
    );
  }

  if (
    warning.lifecycleStatus ===
    'CANCELLED'
  ) {
    throw createHttpError(
      'A cancelled warning cannot be changed.',
      409
    );
  }

  const fromStatus =
    warning.lifecycleStatus;

  const previousSeverity =
    warning.severity;

  let toStatus;
  let historyAction;
  let outgoingMessage;
  let notificationType =
    'WARNING';

  if (
    action ===
    'ESCALATE'
  ) {
    if (
      ![
        'ACTIVE',
        'DE_ESCALATED',
      ].includes(
        warning.lifecycleStatus
      )
    ) {
      throw createHttpError(
        'Only ACTIVE or DE_ESCALATED warnings can be escalated.',
        409
      );
    }

    validateSeverity(
      newSeverity
    );

    if (
      SEVERITY_RANK[
        newSeverity
      ] <=
      SEVERITY_RANK[
        warning.severity
      ]
    ) {
      throw createHttpError(
        'Escalation requires a higher severity level.'
      );
    }

    toStatus =
      'ESCALATED';

    historyAction =
      'ESCALATED';

    warning.severity =
      newSeverity;
  }

  if (
    action ===
    'DE_ESCALATE'
  ) {
    if (
      ![
        'ACTIVE',
        'ESCALATED',
      ].includes(
        warning.lifecycleStatus
      )
    ) {
      throw createHttpError(
        'Only ACTIVE or ESCALATED warnings can be de-escalated.',
        409
      );
    }

    validateSeverity(
      newSeverity
    );

    if (
      SEVERITY_RANK[
        newSeverity
      ] >=
      SEVERITY_RANK[
        warning.severity
      ]
    ) {
      throw createHttpError(
        'De-escalation requires a lower severity level.'
      );
    }

    toStatus =
      'DE_ESCALATED';

    historyAction =
      'DE_ESCALATED';

    warning.severity =
      newSeverity;
  }

  if (
    action ===
    'CANCEL'
  ) {
    if (
      confirmed !==
      true
    ) {
      throw createHttpError(
        'Explicit confirmation is required before cancellation.'
      );
    }

    toStatus =
      'CANCELLED';

    historyAction =
      'CANCELLED';

    notificationType =
      'ALL_CLEAR';

    warning.cancelledAt =
      new Date();
  }

  if (
    action ===
    'CANCEL'
  ) {
    outgoingMessage =
      message &&
      String(
        message
      ).trim().length >=
        10
        ? String(
            message
          ).trim()
        : `ALL CLEAR: The warning for ${warning.targetZone.name} has been cancelled.`;
  } else {
    outgoingMessage =
      message &&
      String(
        message
      ).trim().length >=
        10
        ? String(
            message
          ).trim()
        : warning.message;

    warning.message =
      outgoingMessage;
  }

  warning.lifecycleStatus =
    toStatus;

  warning.lifecycleHistory.push({
    action:
      historyAction,

    fromStatus,

    toStatus,

    previousSeverity,

    newSeverity:
      warning.severity,

    message:
      outgoingMessage,

    changedBy:
      officerId,

    changedAt:
      new Date(),
  });

  await warning.save();

  const deliveries =
    await sendToChannels({
      warning,

      notificationType,

      message:
        outgoingMessage,

      simulateFailedChannels,
    });

  return {
    warning,
    deliveries,
  };
}

async function
getDeliveries(
  warningId
) {
  await getWarningById(
    warningId
  );

  return NotificationDelivery
    .find({
      warningId,
    })
    .sort({
      createdAt: -1,
    });
}

async function
retryFailedDeliveries(
  warningId,
  {
    officerId,
  }
) {
  if (!officerId) {
    throw createHttpError(
      'officerId is required.'
    );
  }

  const warning =
    await getWarningById(
      warningId
    );

  const failedDeliveries =
    await NotificationDelivery
      .find({
        warningId,

        status:
          'FAILED',
      });

  const retried =
    [];

  for (
    const delivery of
    failedDeliveries
  ) {
    delivery.attemptCount +=
      1;

    delivery.lastAttemptAt =
      new Date();

    delivery.status =
      'DELIVERED';

    delivery.deliveredAt =
      new Date();

    delivery.failureReason =
      null;

    await delivery.save();

    retried.push(
      delivery
    );
  }

  return {
    warning,
    retried,
  };
}

module.exports = {
  createSensorReading,
  getSensorEvidence,
  reviewReport,
  getVerificationHistory,
  createWarning,
  listWarnings,
  getWarningById,
  broadcastWarning,
  changeLifecycle,
  getDeliveries,
  retryFailedDeliveries,
  calculateDistanceKm,
};