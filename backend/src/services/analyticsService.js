const mongoose = require('mongoose');

const DisasterEvent = require('../models/DisasterEvent');
const HazardWarning = require('../models/HazardWarning');
const NotificationDelivery = require('../models/NotificationDelivery');
const Shelter = require('../models/Shelter');
const ShelterOccupancyRecord = require('../models/ShelterOccupancyRecord');
const ReliefDistribution = require('../models/ReliefDistribution');
const AnalyticsReport = require('../models/AnalyticsReport');

const REPORT_TYPES = [
  'ALERT_REACH_AUDIT',
  'SHELTER_OCCUPANCY_TREND',
  'RESOURCE_USAGE_SUMMARY',
];

const VALID_HAZARD_TYPES = [
  'FLOODING',
  'LANDSLIDE',
  'BLOCKED_ROAD',
  'CYCLONE',
  'OTHER',
];

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseDate(value, fieldName) {
  if (!value) {
    throw createError(`${fieldName} must be a valid date.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError(`${fieldName} must be a valid date.`);
  }

  // Include the full selected day for end-date filters.
  if (fieldName === 'End date' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

function validateObjectId(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createError(`${fieldName} is invalid.`);
  }
}

function dateFilter(field, startDate, endDate) {
  return {
    [field]: {
      $gte: startDate,
      $lte: endDate,
    },
  };
}

async function validateReportParameters(filters) {
  const {
    eventId,
    reportType,
    startDate,
    endDate,
    district = null,
    hazardType = null,
  } = filters || {};

  if (!eventId) {
    throw createError('A disaster event must be selected.');
  }

  validateObjectId(eventId, 'Event ID');

  if (!REPORT_TYPES.includes(reportType)) {
    throw createError('A valid report type must be selected.');
  }

  const parsedStartDate = parseDate(startDate, 'Start date');
  const parsedEndDate = parseDate(endDate, 'End date');

  if (parsedStartDate > parsedEndDate) {
    throw createError('Start date must not be after end date.');
  }

  if (
    hazardType &&
    !VALID_HAZARD_TYPES.includes(hazardType)
  ) {
    throw createError('The selected hazard type is invalid.');
  }

  const event = await DisasterEvent.findById(eventId);

  if (!event) {
    throw createError('Disaster event not found.', 404);
  }

  if (event.status !== 'COMPLETED' || !event.endDate) {
    throw createError(
      'Analytics reports can only be generated for completed disaster events.'
    );
  }

  const eventEndOfDay = new Date(event.endDate);
eventEndOfDay.setUTCHours(23, 59, 59, 999);

if (
  parsedStartDate < event.startDate ||
  parsedEndDate > eventEndOfDay
) {
  throw createError(
    'The reporting date range must fall within the selected disaster event.'
  );
}

  return {
    event,
    filters: {
      eventId: event._id,
      reportType,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      district: district ? String(district).trim() : null,
      hazardType: hazardType || null,
    },
  };
}

async function buildAlertReachMetrics(filters) {
  const {
    eventId,
    startDate,
    endDate,
    district,
  } = filters;

  const warningQuery = {
    eventId,
    broadcastAt: {
      $gte: startDate,
      $lte: endDate,
    },
    lifecycleStatus: {
      $in: ['ACTIVE', 'ESCALATED', 'DE_ESCALATED', 'CANCELLED'],
    },
  };

  if (district) {
    warningQuery['targetZone.name'] = district;
  }

  const warnings = await HazardWarning.find(warningQuery)
    .select('_id warningCode channels targetZone broadcastAt')
    .lean();

  const warningIds = warnings.map((warning) => warning._id);

  const deliveries = warningIds.length
    ? await NotificationDelivery.find({
        warningId: { $in: warningIds },
        ...dateFilter('createdAt', startDate, endDate),
      }).lean()
    : [];

  const deliveryByChannel = {};
  const uniqueDeliveryKeys = new Set();

  let successfulDeliveries = 0;
  let failedDeliveries = 0;

  for (const delivery of deliveries) {
    const key = `${delivery.warningId.toString()}:${delivery.channel}`;

    // Count each warning/channel pair once, using its latest record.
    const existing = deliveryByChannel[key];

    if (
      !existing ||
      new Date(delivery.lastAttemptAt || delivery.createdAt) >
        new Date(existing.lastAttemptAt || existing.createdAt)
    ) {
      deliveryByChannel[key] = delivery;
    }
  }

  const latestDeliveries = Object.values(deliveryByChannel);

  for (const delivery of latestDeliveries) {
    uniqueDeliveryKeys.add(
      `${delivery.warningId.toString()}:${delivery.channel}`
    );

    if (!deliveryByChannel[`${delivery.warningId.toString()}:${delivery.channel}`]) {
      continue;
    }

    if (delivery.status === 'DELIVERED') {
      successfulDeliveries += 1;
    }

    if (delivery.status === 'FAILED') {
      failedDeliveries += 1;
    }
  }

  const failedByChannel = {};
  const channelSummary = {};

  for (const delivery of latestDeliveries) {
    const channel = delivery.channel;

    if (!channelSummary[channel]) {
      channelSummary[channel] = {
        channel,
        targetRecipients: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: 0,
      };
    }

    channelSummary[channel].targetRecipients += 1;

    if (delivery.status === 'DELIVERED') {
      channelSummary[channel].successfulDeliveries += 1;
    } else if (delivery.status === 'FAILED') {
      channelSummary[channel].failedDeliveries += 1;
      failedByChannel[channel] =
        (failedByChannel[channel] || 0) + 1;
    } else {
      channelSummary[channel].pendingDeliveries += 1;
    }
  }

  const targetRecipients = uniqueDeliveryKeys.size;

  return {
    alertsIssued: warnings.length,
    targetRecipients,
    successfulDeliveries,
    failedDeliveries,
    pendingDeliveries: latestDeliveries.filter(
      (delivery) => delivery.status === 'PENDING'
    ).length,
    deliveryPercentage: targetRecipients
      ? Number(
          ((successfulDeliveries / targetRecipients) * 100).toFixed(2)
        )
      : 0,
    failedDeliveriesByChannel: failedByChannel,
    channelSummary: Object.values(channelSummary),
    warnings: warnings.map((warning) => ({
      warningId: warning._id,
      warningCode: warning.warningCode,
      targetZone: warning.targetZone,
      broadcastAt: warning.broadcastAt,
      channels: warning.channels,
    })),
  };
}

async function buildShelterOccupancyMetrics(filters) {
  const {
    eventId,
    startDate,
    endDate,
    district,
  } = filters;

  const shelterQuery = { eventId };

  if (district) {
    shelterQuery.district = district;
  }

  const shelters = await Shelter.find(shelterQuery)
    .select('_id name district capacity currentOccupancy')
    .lean();

  const shelterIds = shelters.map((shelter) => shelter._id);

  const recordQuery = {
    eventId,
    ...dateFilter('recordedAt', startDate, endDate),
  };

  if (shelterIds.length) {
    recordQuery.shelterId = { $in: shelterIds };
  } else {
    recordQuery.shelterId = { $in: [] };
  }

  const records = await ShelterOccupancyRecord.find(recordQuery)
    .sort({ recordedAt: 1 })
    .lean();

  const totalCapacity = shelters.reduce(
    (total, shelter) => total + shelter.capacity,
    0
  );

  const latestRecordByShelter = new Map();
  let peakOccupancy = 0;

  for (const record of records) {
    peakOccupancy = Math.max(peakOccupancy, record.occupancy);
    latestRecordByShelter.set(record.shelterId.toString(), record);
  }

  const latestTotalOccupancy = Array.from(
    latestRecordByShelter.values()
  ).reduce((total, record) => total + record.occupancy, 0);

  const totalCurrentOccupancy = shelters.reduce(
    (total, shelter) => total + (shelter.currentOccupancy || 0),
    0
  );

  const occupancyOverTime = records.map((record) => ({
    shelterId: record.shelterId,
    recordedAt: record.recordedAt,
    occupancy: record.occupancy,
    capacity: record.capacity,
    occupancyPercentage: Number(
      ((record.occupancy / record.capacity) * 100).toFixed(2)
    ),
  }));

  const latestOccupancy =
    records.length > 0 ? latestTotalOccupancy : totalCurrentOccupancy;

  return {
    shelterCount: shelters.length,
    totalCapacity,
    currentOccupancy: latestOccupancy,
    peakOccupancy,
    occupancyPercentage: totalCapacity
      ? Number(((latestOccupancy / totalCapacity) * 100).toFixed(2))
      : 0,
    occupancyOverTime,
    shelters: shelters.map((shelter) => ({
      shelterId: shelter._id,
      name: shelter.name,
      district: shelter.district,
      capacity: shelter.capacity,
      currentOccupancy: latestRecordByShelter.get(
        shelter._id.toString()
      )?.occupancy ?? shelter.currentOccupancy ?? 0,
    })),
  };
}

async function buildResourceUsageMetrics(filters) {
  const {
    eventId,
    startDate,
    endDate,
    district,
  } = filters;

  const query = {
    eventId,
    ...dateFilter('distributedAt', startDate, endDate),
  };

  if (district) {
    query.district = district;
  }

  const distributions = await ReliefDistribution.find(query)
    .sort({ distributedAt: 1 })
    .lean();

  const resourceTotals = {};
  const districtTotals = {};

  let totalQuantityDistributed = 0;

  const distributionRows = distributions.map((distribution) => {
    const quantity = distribution.allocatedQuantity;
    const resourceKey = `${distribution.resourceType}:${distribution.unit}`;

    if (!resourceTotals[resourceKey]) {
      resourceTotals[resourceKey] = {
        resourceType: distribution.resourceType,
        unit: distribution.unit,
        quantityDistributed: 0,
        distributionCount: 0,
      };
    }

    resourceTotals[resourceKey].quantityDistributed += quantity;
    resourceTotals[resourceKey].distributionCount += 1;

    if (!districtTotals[distribution.district]) {
      districtTotals[distribution.district] = {
        district: distribution.district,
        quantityDistributed: 0,
        distributionCount: 0,
      };
    }

    districtTotals[distribution.district].quantityDistributed += quantity;
    districtTotals[distribution.district].distributionCount += 1;

    totalQuantityDistributed += quantity;

    return {
      distributionId: distribution._id,
      resourceType: distribution.resourceType,
      unit: distribution.unit,
      quantityDistributed: quantity,
      requestedQuantity: distribution.requestedQuantity,
      shortfallQuantity: distribution.shortfallQuantity,
      district: distribution.district,
      destinationType: distribution.destinationType,
      destinationLabel: distribution.destinationLabel,
      distributedAt: distribution.distributedAt,
    };
  });

  return {
    distributionCount: distributions.length,
    totalQuantityDistributed,
    totalShortfallQuantity: distributions.reduce(
      (total, item) => total + item.shortfallQuantity,
      0
    ),
    totalsByResource: Object.values(resourceTotals),
    totalsByDistrict: Object.values(districtTotals),
    distributions: distributionRows,
  };
}

async function generateReport(input, generatedBy = 'EXEC-001') {
  const { filters } = await validateReportParameters(input);

  let metrics;

  switch (filters.reportType) {
    case 'ALERT_REACH_AUDIT':
      metrics = await buildAlertReachMetrics(filters);
      break;

    case 'SHELTER_OCCUPANCY_TREND':
      metrics = await buildShelterOccupancyMetrics(filters);
      break;

    case 'RESOURCE_USAGE_SUMMARY':
      metrics = await buildResourceUsageMetrics(filters);
      break;

    default:
      throw createError('Unsupported report type.');
  }

  const hasData =
    filters.reportType === 'ALERT_REACH_AUDIT'
      ? metrics.alertsIssued > 0
      : filters.reportType === 'SHELTER_OCCUPANCY_TREND'
        ? metrics.shelterCount > 0 || metrics.occupancyOverTime.length > 0
        : metrics.distributionCount > 0;

  if (!hasData) {
    throw createError(
      'No data is available for this report and date range.',
      404
    );
  }

  const report = await AnalyticsReport.create({
    eventId: filters.eventId,
    reportType: filters.reportType,
    filters: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      district: filters.district,
      hazardType: filters.hazardType,
    },
    metrics,
    generatedBy,
    generatedAt: new Date(),
  });

  return report;
}

async function listCompletedEvents() {
  return DisasterEvent.find({
    status: 'COMPLETED',
    endDate: { $ne: null },
  })
    .sort({ endDate: -1 })
    .select('_id eventCode name district hazardType startDate endDate status')
    .lean();
}

module.exports = {
  REPORT_TYPES,
  validateReportParameters,
  buildAlertReachMetrics,
  buildShelterOccupancyMetrics,
  buildResourceUsageMetrics,
  generateReport,
  listCompletedEvents,
};