const DisasterEvent = require('../models/DisasterEvent');
const Shelter = require('../models/Shelter');
const ShelterOccupancyRecord = require('../models/ShelterOccupancyRecord');
const RescueTeam = require('../models/RescueTeam');
const RescueAssignment = require('../models/RescueAssignment');
const ReliefResource = require('../models/ReliefResource');
const ReliefDistribution = require('../models/ReliefDistribution');

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function ensureActiveEvent(eventId) {
  const event = await DisasterEvent.findById(eventId);

  if (!event) {
    throw httpError('Disaster event not found.', 404);
  }

  if (event.status !== 'ACTIVE') {
    throw httpError('Emergency response can only be managed for an active disaster event.', 400);
  }

  return event;
}

function eventDistrict(event) {
  const district = String(event.district || '').trim();

  if (!district) {
    throw httpError('This event has no district.', 400);
  }

  return district;
}

function sameDistrict(left, right) {
  return (
    String(left || '').trim().toLowerCase() ===
    String(right || '').trim().toLowerCase()
  );
}

function escapeRegex(value) {
  return String(value || '').replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function districtQuery(district) {
  return {
    district: {
      $regex: `^${escapeRegex(String(district || '').trim())}$`,
      $options: 'i',
    },
  };
}

function requireHomeDistrict(value) {
  const district = String(value || '').trim().replace(/\s+/g, ' ');

  if (!district) {
    throw httpError('Enter the district.', 400);
  }

  return district;
}

async function createShelter(payload) {
  const event = await ensureActiveEvent(payload.eventId);
  const district = eventDistrict(event);

  if (
    payload.district &&
    !sameDistrict(payload.district, district)
  ) {
    throw httpError(
      `This event is in ${district}. Register the shelter in ${district}.`,
      400
    );
  }

  if (Number(payload.currentOccupancy || 0) > Number(payload.capacity)) {
    throw httpError('Shelter occupancy cannot exceed capacity.', 400);
  }

  const occupancy = Number(payload.currentOccupancy || 0);

  const shelter = await Shelter.create({
    eventId: payload.eventId,
    name: payload.name,
    district,
    address: payload.address,
    capacity: Number(payload.capacity),
    currentOccupancy: occupancy,
    status: occupancy >= Number(payload.capacity) ? 'FULL' : 'OPEN',
  });

  await ShelterOccupancyRecord.create({
    eventId: shelter.eventId,
    shelterId: shelter._id,
    occupancy: shelter.currentOccupancy,
    capacity: shelter.capacity,
  });

  return shelter;
}

async function updateShelterOccupancy(shelterId, occupancy) {
  const shelter = await Shelter.findById(shelterId);

  if (!shelter) {
    throw httpError('Shelter not found.', 404);
  }

  if (shelter.status === 'CLOSED') {
    throw httpError('A closed shelter cannot accept occupancy updates.', 400);
  }

  const value = Number(occupancy);

  if (!Number.isFinite(value) || value < 0 || value > shelter.capacity) {
    throw httpError('Occupancy must be between 0 and shelter capacity.', 400);
  }

  shelter.currentOccupancy = value;
  shelter.status = value >= shelter.capacity ? 'FULL' : 'OPEN';
  await shelter.save();

  await ShelterOccupancyRecord.create({
    eventId: shelter.eventId,
    shelterId: shelter._id,
    occupancy: value,
    capacity: shelter.capacity,
  });

  return shelter;
}

async function createRescueTeam(payload) {
  const district = requireHomeDistrict(payload.district);

  return RescueTeam.create({
    teamCode: payload.teamCode,
    name: payload.name,
    district,
    teamType: payload.teamType || 'GENERAL',
    currentStatus: payload.currentStatus || 'AVAILABLE',
    lastKnownLocation: payload.lastKnownLocation || {},
    lastUpdateTime: new Date(),
  });
}

async function dispatchTeam(payload) {
  await ensureActiveEvent(payload.eventId);

  const team = await RescueTeam.findById(payload.teamId);

  if (!team) {
    throw httpError('Rescue team not found.', 404);
  }

  if (team.currentStatus !== 'AVAILABLE') {
    throw httpError('Selected rescue team is not available.', 409);
  }

  const assignment = await RescueAssignment.create({
    eventId: payload.eventId,
    teamId: team._id,
    incidentDescription: payload.incidentDescription,
    affectedLocation: payload.affectedLocation,
    status: 'EN_ROUTE',
    lastUpdateTime: new Date(),
  });

  team.currentStatus = 'EN_ROUTE';
  team.lastUpdateTime = new Date();
  await team.save();

  return assignment;
}

async function updateAssignmentStatus(assignmentId, payload) {
  const assignment = await RescueAssignment.findById(assignmentId);

  if (!assignment) {
    throw httpError('Rescue assignment not found.', 404);
  }

  const allowed = ['EN_ROUTE', 'ON_SCENE', 'COMPLETED'];

  if (!allowed.includes(payload.status)) {
    throw httpError('Invalid assignment status.', 400);
  }

  assignment.status = payload.status;
  assignment.lastUpdateTime = new Date();

  if (payload.status === 'COMPLETED') {
    assignment.completedAt = new Date();
  }

  await assignment.save();

  const team = await RescueTeam.findById(assignment.teamId);

  if (team) {
    team.currentStatus =
      payload.status === 'COMPLETED'
        ? 'AVAILABLE'
        : payload.status;

    team.lastUpdateTime = new Date();

    if (payload.location) {
      team.lastKnownLocation = payload.location;
    }

    await team.save();
  }

  return assignment;
}

async function reassignTeam(assignmentId, newTeamId) {
  const previous = await RescueAssignment.findById(assignmentId);

  if (!previous) {
    throw httpError('Rescue assignment not found.', 404);
  }

  const newTeam = await RescueTeam.findById(newTeamId);

  if (!newTeam) {
    throw httpError('Replacement rescue team not found.', 404);
  }

  if (newTeam.currentStatus !== 'AVAILABLE') {
    throw httpError('Replacement rescue team is not available.', 409);
  }

  const previousTeam = await RescueTeam.findById(previous.teamId);

  if (
    previousTeam?.teamType &&
    newTeam.teamType !== previousTeam.teamType
  ) {
    throw httpError(
      `Replacement team must be ${previousTeam.teamType}.`,
      409
    );
  }

  previous.status = 'REASSIGNED';
  previous.lastUpdateTime = new Date();
  await previous.save();

  if (previousTeam) {
    previousTeam.currentStatus = 'AVAILABLE';
    previousTeam.lastUpdateTime = new Date();
    await previousTeam.save();
  }

  const replacement = await RescueAssignment.create({
    eventId: previous.eventId,
    teamId: newTeam._id,
    previousAssignmentId: previous._id,
    incidentDescription: previous.incidentDescription,
    affectedLocation: previous.affectedLocation,
    status: 'EN_ROUTE',
    lastUpdateTime: new Date(),
  });

  newTeam.currentStatus = 'EN_ROUTE';
  newTeam.lastUpdateTime = new Date();
  await newTeam.save();

  return {
    previousAssignment: previous,
    newAssignment: replacement,
  };
}

async function registerReliefResource(payload) {
  const district = requireHomeDistrict(payload.district);

  if (payload.eventId) {
    await ensureActiveEvent(payload.eventId);
  }

  return ReliefResource.create({
    eventId: payload.eventId || undefined,
    organisationName: payload.organisationName,
    resourceType: payload.resourceType,
    unit: payload.unit,
    availableQuantity: Number(payload.availableQuantity),
    district,
  });
}

async function allocateResource(payload) {
  const event = await ensureActiveEvent(payload.eventId);
  const district = eventDistrict(event);

  const resource = await ReliefResource.findById(payload.resourceId);

  if (!resource) {
    throw httpError('Relief resource not found.', 404);
  }

  let destinationLabel = payload.destinationLabel || '';
  let shelter = null;

  if (payload.destinationType === 'SHELTER') {
    shelter = await Shelter.findById(payload.shelterId);

    if (!shelter) {
      throw httpError('Shelter not found.', 404);
    }

    if (String(shelter.eventId) !== String(event._id)) {
      throw httpError(
        'Allocate only to a shelter registered for this event.',
        400
      );
    }

    if (shelter.status === 'CLOSED') {
      throw httpError('Cannot allocate resources to a closed shelter.', 400);
    }

    destinationLabel = shelter.name;
  }

  if (!['SHELTER', 'AFFECTED_LOCATION'].includes(payload.destinationType)) {
    throw httpError('Invalid destination type.', 400);
  }

  if (!destinationLabel) {
    throw httpError('Destination label is required.', 400);
  }

  const requested = Number(payload.requestedQuantity);

  if (!Number.isFinite(requested) || requested <= 0) {
    throw httpError('Requested quantity must be greater than zero.', 400);
  }

  const allocated = Math.min(requested, resource.availableQuantity);
  const shortfall = requested - allocated;

  if (allocated <= 0) {
    throw httpError('No stock is available for this resource.', 409);
  }

  resource.availableQuantity -= allocated;
  await resource.save();

  const distribution = await ReliefDistribution.create({
    eventId: payload.eventId,
    resourceId: resource._id,
    resourceType: resource.resourceType,
    unit: resource.unit,
    district,
    destinationType: payload.destinationType,
    shelterId: shelter?._id || null,
    destinationLabel,
    requestedQuantity: requested,
    allocatedQuantity: allocated,
    shortfallQuantity: shortfall,
  });

  return {
    distribution,
    partialFulfilment: shortfall > 0,
    remainingStock: resource.availableQuantity,
  };
}

async function requestMedicalEvacuation(payload) {
  const event = await ensureActiveEvent(payload.eventId);
  const district = eventDistrict(event);

  let team = await RescueTeam.findOne({
    teamType: 'MEDICAL',
    currentStatus: 'AVAILABLE',
    ...districtQuery(district),
  }).sort({ updatedAt: 1 });

  if (!team) {
    team = await RescueTeam.findOne({
      teamType: 'MEDICAL',
      currentStatus: 'AVAILABLE',
    }).sort({ updatedAt: 1 });
  }

  if (!team) {
    return {
      escalated: true,
      escalationTarget: 'DMC_HQ_EXTERNAL_AGENCY',
      message: 'No local medical rescue team is available. Escalated externally.',
    };
  }

  const assignment = await dispatchTeam({
    eventId: payload.eventId,
    teamId: team._id.toString(),
    incidentDescription:
      payload.incidentDescription || 'Urgent medical evacuation',
    affectedLocation: payload.affectedLocation,
  });

  return {
    escalated: false,
    assignment,
  };
}

async function applyTimeoutStatus(assignments, inactivityMinutes) {
  const thresholdMs = inactivityMinutes * 60 * 1000;
  const now = Date.now();

  for (const assignment of assignments) {
    if (
      ['COMPLETED', 'REASSIGNED'].includes(assignment.status)
    ) {
      continue;
    }

    if (
      now - new Date(assignment.lastUpdateTime).getTime() >
      thresholdMs
    ) {
      assignment.status = 'STATUS_UNKNOWN';
      await assignment.save();
    }
  }

  return assignments;
}

async function getDashboard(eventId, inactivityMinutes = 30) {
  const event = await ensureActiveEvent(eventId);

  const district = eventDistrict(event);

  const [shelters, occupancyRecords, assignments, distributions] =
    await Promise.all([
      Shelter.find({ eventId }).sort({ name: 1 }),
      ShelterOccupancyRecord.find({ eventId }).sort({
        recordedAt: -1,
      }),
      RescueAssignment.find({ eventId })
        .populate('teamId')
        .sort({ createdAt: -1 }),
      ReliefDistribution.find({ eventId }).sort({ distributedAt: -1 }),
    ]);

  const assignedTeamIds = assignments
    .map((assignment) => assignment.teamId?._id || assignment.teamId)
    .filter(Boolean);

  const distributedResourceIds = distributions
    .map((item) => item.resourceId)
    .filter(Boolean);

  const [teams, availableTeams, resources, availableResources] =
    await Promise.all([
      RescueTeam.find({
        _id: { $in: assignedTeamIds },
      }).sort({ name: 1 }),
      RescueTeam.find({
        currentStatus: 'AVAILABLE',
      }).sort({ name: 1 }),
      ReliefResource.find({
        $or: [
          { eventId },
          { _id: { $in: distributedResourceIds } },
        ],
      }).sort({ resourceType: 1 }),
      ReliefResource.find({}).sort({ resourceType: 1 }),
    ]);

  await applyTimeoutStatus(assignments, inactivityMinutes);

  const occupancyByShelter = occupancyRecords.reduce((history, record) => {
    const key = String(record.shelterId);

    if (!history[key]) {
      history[key] = [];
    }

    history[key].push(record);
    return history;
  }, {});

  const sheltersWithHistory = shelters.map((shelter) => {
    const item = shelter.toObject();
    item.occupancyHistory = occupancyByShelter[String(shelter._id)] || [];
    return item;
  });

  return {
    shelters: sheltersWithHistory,
    assignments,
    resources,
    availableResources,
    distributions,
    teams,
    availableTeams,
  };
}

module.exports = {
  createShelter,
  updateShelterOccupancy,
  createRescueTeam,
  dispatchTeam,
  updateAssignmentStatus,
  reassignTeam,
  registerReliefResource,
  allocateResource,
  requestMedicalEvacuation,
  getDashboard,
};
