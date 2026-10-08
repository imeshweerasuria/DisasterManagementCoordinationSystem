const express =
  require('express');

const controller =
  require(
    '../controllers/hazardWarningController'
  );

const router =
  express.Router();

router.post(
  '/sensors',
  controller.createSensorReading
);

router.get(
  '/sensors/evidence',
  controller.getSensorEvidence
);

router.patch(
  '/reports/:reportId/review',
  controller.reviewReport
);

router.get(
  '/reports/:reportId/verification-history',
  controller.getVerificationHistory
);

router.get(
  '/',
  controller.listWarnings
);

router.post(
  '/',
  controller.createWarning
);

router.post(
  '/:warningId/broadcast',
  controller.broadcastWarning
);

router.post(
  '/:warningId/lifecycle',
  controller.changeLifecycle
);

router.get(
  '/:warningId/deliveries',
  controller.getDeliveries
);

router.post(
  '/:warningId/retry-failed',
  controller.retryFailedDeliveries
);

router.get(
  '/:warningId',
  controller.getWarning
);

module.exports =
  router;