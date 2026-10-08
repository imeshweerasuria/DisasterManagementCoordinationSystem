const mongoose = require('mongoose');

const sensorReadingSchema =
  new mongoose.Schema(
    {
      sensorCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        index: true,
      },

      sensorType: {
        type: String,
        enum: [
          'WATER_LEVEL',
          'RAINFALL',
          'SOIL_MOISTURE',
          'SLOPE_MOVEMENT',
          'WIND_SPEED',
          'TEMPERATURE',
          'OTHER',
        ],
        required: true,
      },

      district: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
      },

      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
      },

      value: {
        type: Number,
        required: true,
      },

      unit: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
      },

      recordedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    'SensorReading',
    sensorReadingSchema
  );