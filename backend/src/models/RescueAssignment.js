const mongoose = require('mongoose');

const rescueAssignmentSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisasterEvent',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RescueTeam',
      required: true,
      index: true,
    },
    previousAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RescueAssignment',
      default: null,
    },
    incidentDescription: {
      type: String,
      required: true,
      trim: true,
    },
    affectedLocation: {
      label: {
        type: String,
        required: true,
      },
      latitude: {
        type: Number,
        min: -90,
        max: 90,
        default: null,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
        default: null,
      },
    },
    status: {
      type: String,
      enum: [
        'EN_ROUTE',
        'ON_SCENE',
        'COMPLETED',
        'REASSIGNED',
        'STATUS_UNKNOWN',
      ],
      default: 'EN_ROUTE',
      index: true,
    },
    lastUpdateTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'RescueAssignment',
  rescueAssignmentSchema
);
