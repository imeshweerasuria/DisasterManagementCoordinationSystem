const mongoose =
  require('mongoose');

const notificationDeliverySchema =
  new mongoose.Schema(
    {
      warningId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: 'HazardWarning',
        required: true,
        index: true,
      },

      channel: {
        type: String,
        enum: [
          'PUSH',
          'SMS',
          'AUDIBLE',
        ],
        required: true,
      },

      notificationType: {
        type: String,
        enum: [
          'WARNING',
          'ALL_CLEAR',
        ],
        default: 'WARNING',
      },

      message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
      },

      status: {
        type: String,
        enum: [
          'PENDING',
          'DELIVERED',
          'FAILED',
        ],
        default: 'PENDING',
        index: true,
      },

      attemptCount: {
        type: Number,
        default: 1,
        min: 1,
      },

      lastAttemptAt: {
        type: Date,
        default: Date.now,
      },

      deliveredAt: {
        type: Date,
        default: null,
      },

      failureReason: {
        type: String,
        default: null,
        maxlength: 300,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    'NotificationDelivery',
    notificationDeliverySchema
  );