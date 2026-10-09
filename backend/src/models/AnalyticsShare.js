const mongoose = require('mongoose');

const shareAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'SHARED',
        'VIEWED',
        'REVOKED',
        'UNAUTHORIZED_ACCESS',
      ],
    },

    actorId: {
      type: String,
      required: true,
      trim: true,
    },

    details: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },

    occurredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const analyticsShareSchema = new mongoose.Schema(
  {
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnalyticsReport',
      required: true,
      index: true,
    },

    recipientId: {
      type: String,
      required: true,
      trim: true,
      enum: ['EXEC-001', 'DONOR-001', 'AGENCY-001'],
      index: true,
    },

    permission: {
      type: String,
      required: true,
      enum: ['READ_ONLY'],
      default: 'READ_ONLY',
    },

    sharedBy: {
      type: String,
      required: true,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sharedAt: {
      type: Date,
      default: Date.now,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    auditHistory: {
      type: [shareAuditSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

analyticsShareSchema.index({
  reportId: 1,
  recipientId: 1,
});

module.exports = mongoose.model(
  'AnalyticsShare',
  analyticsShareSchema
);