const mongoose = require('mongoose');

const disasterEventSchema = new mongoose.Schema(
  {
    eventCode: {
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
    district: {
      type: String,
      required: true,
      trim: true,
    },
    hazardType: {
      type: String,
      required: true,
      enum: ['FLOODING', 'LANDSLIDE', 'BLOCKED_ROAD', 'CYCLONE', 'OTHER'],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DisasterEvent', disasterEventSchema);
