const mongoose = require('mongoose');

const reliefResourceSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisasterEvent',
      index: true,
    },
    organisationName: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReliefResource', reliefResourceSchema);
