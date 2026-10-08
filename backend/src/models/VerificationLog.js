const mongoose =
  require('mongoose');

const verificationLogSchema =
  new mongoose.Schema(
    {
      reportId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: 'HazardReport',
        required: true,
        index: true,
      },

      officerId: {
        type: String,
        required: true,
        trim: true,
      },

      decision: {
        type: String,
        enum: [
          'VERIFIED',
          'DISMISSED',
          'CONFLICTING',
        ],
        required: true,
      },

      remarks: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: '',
      },

      comparedSensorIds: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: 'SensorReading',
        },
      ],

      decidedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    'VerificationLog',
    verificationLogSchema
  );