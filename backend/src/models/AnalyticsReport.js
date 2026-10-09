const mongoose = require('mongoose');

const analyticsReportSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisasterEvent',
      required: true,
      index: true,
    },

    reportType: {
      type: String,
      required: true,
      enum: [
        'ALERT_REACH_AUDIT',
        'SHELTER_OCCUPANCY_TREND',
        'RESOURCE_USAGE_SUMMARY',
      ],
      index: true,
    },

    filters: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
      district: {
        type: String,
        default: null,
        trim: true,
      },
      hazardType: {
        type: String,
        default: null,
        trim: true,
      },
    },

    metrics: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },

    generatedBy: {
      type: String,
      required: true,
      trim: true,
      default: 'EXEC-001',
    },

    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

analyticsReportSchema.index({
  eventId: 1,
  reportType: 1,
  generatedAt: -1,
});

module.exports = mongoose.model(
  'AnalyticsReport',
  analyticsReportSchema
);