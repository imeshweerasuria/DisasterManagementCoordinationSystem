const mongoose = require('mongoose');

const targetZoneSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['DISTRICT', 'RIVER_BASIN'],
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
  },
  {
    _id: false,
  }
);

const lifecycleHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'CREATED',
        'BROADCAST',
        'ESCALATED',
        'DE_ESCALATED',
        'CANCELLED',
      ],
      required: true,
    },

    fromStatus: {
      type: String,
      default: null,
    },

    toStatus: {
      type: String,
      required: true,
    },

    previousSeverity: {
      type: String,
      default: null,
    },

    newSeverity: {
      type: String,
      default: null,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    changedBy: {
      type: String,
      required: true,
      trim: true,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const hazardWarningSchema = new mongoose.Schema(
  {
    warningCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Links this warning to the disaster event it belongs to.
    // Null supports existing warnings that have not been linked yet.
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisasterEvent',
      default: null,
      index: true,
    },

    sourceType: {
      type: String,
      enum: ['REPORT', 'SENSOR'],
      required: true,
    },

    sourceReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HazardReport',
      default: null,
    },

    sourceSensorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SensorReading',
      },
    ],

    officerId: {
      type: String,
      required: true,
      trim: true,
    },

    targetZone: {
      type: targetZoneSchema,
      required: true,
    },

    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },

    channels: [
      {
        type: String,
        enum: ['PUSH', 'SMS', 'AUDIBLE'],
      },
    ],

    lifecycleStatus: {
      type: String,
      enum: [
        'DRAFT',
        'ACTIVE',
        'ESCALATED',
        'DE_ESCALATED',
        'CANCELLED',
      ],
      default: 'DRAFT',
      index: true,
    },

    broadcastAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    districtOfficerNotification: {
      status: {
        type: String,
        enum: ['PENDING', 'NOTIFIED', 'FAILED'],
        default: 'PENDING',
      },

      notifiedAt: {
        type: Date,
        default: null,
      },
    },

    lifecycleHistory: {
      type: [lifecycleHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'HazardWarning',
  hazardWarningSchema
);