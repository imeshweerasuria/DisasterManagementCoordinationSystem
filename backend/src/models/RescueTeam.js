const mongoose = require('mongoose');

const rescueTeamSchema = new mongoose.Schema(
  {
    teamCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisasterEvent',
      index: true,
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
    teamType: {
      type: String,
      enum: ['GENERAL', 'MEDICAL'],
      default: 'GENERAL',
    },
    currentStatus: {
      type: String,
      enum: ['AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'UNAVAILABLE'],
      default: 'AVAILABLE',
      index: true,
    },
    lastKnownLocation: {
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
      label: {
        type: String,
        default: '',
      },
    },
    lastUpdateTime: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RescueTeam', rescueTeamSchema);
