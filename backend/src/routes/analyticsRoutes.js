const express = require('express');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

// List completed disaster events available for reporting.
router.get('/events', analyticsController.listCompletedEvents);

// Generate and retrieve saved analytics reports.
router.post('/reports', analyticsController.generateReport);
router.get('/reports/:reportId', analyticsController.getReport);

// Export saved reports.
router.get('/reports/:reportId/export/csv', analyticsController.exportCsv);
router.get('/reports/:reportId/export/pdf', analyticsController.exportPdf);

// Grant and revoke read-only sharing.
router.post('/reports/:reportId/share', analyticsController.shareReport);
router.delete(
  '/reports/:reportId/share/:recipientId',
  analyticsController.revokeShare
);

// View a report shared with an authorized demo recipient.
router.get(
  '/shared/:recipientId/:reportId',
  analyticsController.getSharedReport
);

module.exports = router;