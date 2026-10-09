const DisasterEvent = require('../models/DisasterEvent');

const hazardCodes = {
  FLOODING: 'FLOOD',
  LANDSLIDE: 'LANDSLIDE',
  BLOCKED_ROAD: 'BLOCKED-ROAD',
  CYCLONE: 'CYCLONE',
  OTHER: 'OTHER',
};

function codePart(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function singleDistrict(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

async function generateEventCode({
  hazardType,
  district,
  startDate,
}) {
  const hazard =
    hazardCodes[hazardType] ||
    codePart(hazardType) ||
    'EVENT';
  const place =
    codePart(district) ||
    'DISTRICT';
  const year = new Date(startDate).getUTCFullYear();
  const prefix = `${hazard}-${place}-${year}-`;
  const pattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`
  );

  const existing = await DisasterEvent.find({
    eventCode: pattern,
  }).select('eventCode');

  const nextNumber =
    existing.reduce((highest, item) => {
      const match = String(item.eventCode).match(pattern);
      const number = match ? Number(match[1]) : 0;
      return Math.max(highest, number);
    }, 0) + 1;

  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

async function createEvent(req, res, next) {
  try {
    const district = singleDistrict(req.body.district);

    if (!district) {
      return res.status(400).json({
        success: false,
        message: 'Enter the district.',
      });
    }

    const eventCode = await generateEventCode({
      ...req.body,
      district,
    });

    const event = await DisasterEvent.create({
      eventCode,
      name: req.body.name,
      district,
      hazardType: req.body.hazardType,
      startDate: req.body.startDate,
      endDate: req.body.endDate || null,
      status: req.body.status || 'ACTIVE',
    });

    res.status(201).json({
      success: true,
      message: 'Disaster event created.',
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

async function listEvents(req, res, next) {
  try {
    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const events = await DisasterEvent.find(filter)
      .sort({ startDate: -1 })
      .lean();

    res.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
}

async function completeEvent(req, res, next) {
  try {
    const event = await DisasterEvent.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Disaster event not found.',
      });
    }

    event.status = 'COMPLETED';
    event.endDate = req.body.endDate || new Date();

    if (event.endDate < event.startDate) {
      return res.status(400).json({
        success: false,
        message: 'Event end date cannot be earlier than start date.',
      });
    }

    await event.save();

    return res.json({
      success: true,
      message: 'Disaster event completed.',
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEvent,
  listEvents,
  completeEvent,
};
