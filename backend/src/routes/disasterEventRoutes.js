const express = require('express');
const controller = require('../controllers/disasterEventController');

const router = express.Router();

router.get('/', controller.listEvents);
router.post('/', controller.createEvent);
router.patch('/:eventId/complete', controller.completeEvent);

module.exports = router;
