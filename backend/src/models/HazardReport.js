const mongoose = require('mongoose');

const mediaSchema =
  new mongoose.Schema(
    {
      fileName: {
        type: String,
        trim: true,
      },

      mimeType: {
        type: String,
        trim: true,
      },

      size: {
        type: Number,
      },

      dataUrl: {
        type: String,
      },
    },
    {
      _id: false,
    }
  );

const locationSchema =
  new mongoose.Schema(
    {
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

      address: {
        type: String,
        trim: true,
        maxlength: 300,
      },

      source: {
        type: String,
        enum: ['GPS', 'MANUAL'],
        required: true,
      },
    },
    {
      _id: false,
    }
  );

const hazardReportSchema =
  new mongoose.Schema(
    {
      referenceId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      clientSubmissionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      citizenId: {
        type: String,
        required: true,
        trim: true,
      },

      citizenPhone: {
        type: String,
        trim: true,
      },

      submissionChannel: {
        type: String,
        enum: [
          'WEB_MOBILE',
          'SMS',
        ],
        default: 'WEB_MOBILE',
      },

      hazardType: {
        type: String,
        required: true,
        enum: [
          'FLOODING',
          'LANDSLIDE',
          'BLOCKED_ROAD',
        ],
      },

      description: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 1000,
      },

      severity: {
        type: String,
        enum: [
          'LOW',
          'MEDIUM',
          'HIGH',
        ],
        default: 'MEDIUM',
      },

      location: {
        type: locationSchema,
        required: true,
      },

      media: {
        type: [mediaSchema],
        default: [],
      },

      verificationStatus: {
        type: String,
        enum: [
          'UNVERIFIED',
          'VERIFIED',
          'DISMISSED',
        ],
        default: 'UNVERIFIED',
      },

      syncStatus: {
        type: String,
        enum: [
          'SENT',
          'PENDING_SYNC',
          'SYNC_FAILED',
        ],
        default: 'SENT',
      },

      dutyOfficerQueueStatus: {
        type: String,
        enum: [
          'PENDING_REVIEW',
          'UNDER_REVIEW',
          'COMPLETED',
        ],
        default: 'PENDING_REVIEW',
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    'HazardReport',
    hazardReportSchema
  );