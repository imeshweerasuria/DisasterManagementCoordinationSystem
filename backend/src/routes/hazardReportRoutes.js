const express =
  require('express');

const {
  submitReport,
  submitSmsReport,
  listPendingReports,
  getReport,
} =
  require(
    '../controllers/hazardReportController'
  );

const router =
  express.Router();

router.post(
  '/',
  submitReport
);

router.post(
  '/sms',
  submitSmsReport
);

router.get(
  '/pending',
  listPendingReports
);

router.get(
  '/:referenceId',
  getReport
);

module.exports = router;