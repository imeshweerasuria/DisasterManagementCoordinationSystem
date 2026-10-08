const mongoose = require('mongoose');

const reliefDistributionSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisasterEvent',
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReliefResource',
      required: true,
    },
    resourceType: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    destinationType: {
      type: String,
      enum: ['SHELTER', 'AFFECTED_LOCATION'],
      required: true,
    },
    shelterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shelter',
      default: null,
    },
    destinationLabel: {
      type: String,
      required: true,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    allocatedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    shortfallQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    distributedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'ReliefDistribution',
  reliefDistributionSchema
);
