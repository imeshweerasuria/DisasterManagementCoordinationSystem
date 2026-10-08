const service = require('../services/emergencyResponseService');

async function createShelter(req, res, next) {
  try {
    const shelter = await service.createShelter(req.body);

    res.status(201).json({
      success: true,
      message: 'Emergency shelter registered.',
      data: shelter,
    });
  } catch (error) {
    next(error);
  }
}

async function updateOccupancy(req, res, next) {
  try {
    const shelter = await service.updateShelterOccupancy(
      req.params.shelterId,
      req.body.occupancy
    );

    res.json({
      success: true,
      message:
        shelter.status === 'FULL'
          ? 'Shelter occupancy updated. Shelter is now full.'
          : 'Shelter occupancy updated.',
      data: shelter,
    });
  } catch (error) {
    next(error);
  }
}

async function createRescueTeam(req, res, next) {
  try {
    const team = await service.createRescueTeam(req.body);

    res.status(201).json({
      success: true,
      message: 'Rescue team registered.',
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

async function dispatchTeam(req, res, next) {
  try {
    const assignment = await service.dispatchTeam(req.body);

    res.status(201).json({
      success: true,
      message: 'Rescue team dispatched.',
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

async function updateAssignmentStatus(req, res, next) {
  try {
    const assignment = await service.updateAssignmentStatus(
      req.params.assignmentId,
      req.body
    );

    res.json({
      success: true,
      message: 'Rescue assignment updated.',
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

async function reassignTeam(req, res, next) {
  try {
    const result = await service.reassignTeam(
      req.params.assignmentId,
      req.body.newTeamId
    );

    res.status(201).json({
      success: true,
      message: 'Rescue assignment replaced while preserving history.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function registerResource(req, res, next) {
  try {
    const resource = await service.registerReliefResource(req.body);

    res.status(201).json({
      success: true,
      message: 'Relief resource registered.',
      data: resource,
    });
  } catch (error) {
    next(error);
  }
}

async function allocateResource(req, res, next) {
  try {
    const result = await service.allocateResource(req.body);

    res.status(201).json({
      success: true,
      message: result.partialFulfilment
        ? 'Resource partially allocated. Shortfall recorded.'
        : 'Resource allocated successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function requestMedicalEvacuation(req, res, next) {
  try {
    const result = await service.requestMedicalEvacuation(req.body);

    res.status(result.escalated ? 202 : 201).json({
      success: true,
      message: result.message || 'Medical rescue team dispatched.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function dashboard(req, res, next) {
  try {
    if (!req.query.eventId) {
      return res.status(400).json({
        success: false,
        message: 'eventId is required.',
      });
    }

    const data = await service.getDashboard(
      req.query.eventId,
      Number(req.query.inactivityMinutes || 30)
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createShelter,
  updateOccupancy,
  createRescueTeam,
  dispatchTeam,
  updateAssignmentStatus,
  reassignTeam,
  registerResource,
  allocateResource,
  requestMedicalEvacuation,
  dashboard,
};
