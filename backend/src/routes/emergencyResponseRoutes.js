const express = require('express');
const controller = require('../controllers/emergencyResponseController');

const router = express.Router();

router.get('/dashboard', controller.dashboard);

router.post('/shelters', controller.createShelter);
router.patch('/shelters/:shelterId/occupancy', controller.updateOccupancy);

router.post('/rescue-teams', controller.createRescueTeam);

router.post('/assignments', controller.dispatchTeam);
router.patch('/assignments/:assignmentId/status', controller.updateAssignmentStatus);
router.post('/assignments/:assignmentId/reassign', controller.reassignTeam);

router.post('/resources', controller.registerResource);
router.post('/distributions', controller.allocateResource);

router.post('/medical-evacuation', controller.requestMedicalEvacuation);

module.exports = router;
