const HazardReport =
  require('../models/HazardReport');

const generateReferenceId =
  require(
    '../utils/generateReferenceId'
  );

async function findExistingSubmission(
  clientSubmissionId
) {
  return HazardReport.findOne({
    clientSubmissionId,
  });
}

async function createHazardReport(
  reportData
) {
  const existing =
    await findExistingSubmission(
      reportData.clientSubmissionId
    );

  if (existing) {
    return {
      report: existing,
      duplicate: true,
    };
  }

  let referenceId;
  let referenceExists = true;

  while (referenceExists) {
    referenceId =
      generateReferenceId();

    referenceExists =
      await HazardReport.exists({
        referenceId,
      });
  }

  const report =
    await HazardReport.create({
      ...reportData,

      referenceId,

      verificationStatus:
        'UNVERIFIED',

      syncStatus: 'SENT',

      dutyOfficerQueueStatus:
        'PENDING_REVIEW',
    });

  return {
    report,
    duplicate: false,
  };
}

async function getPendingReports() {
  return HazardReport.find({
    verificationStatus:
      'UNVERIFIED',
  }).sort({
    createdAt: -1,
  });
}

async function getReportByReference(
  referenceId
) {
  return HazardReport.findOne({
    referenceId,
  });
}

module.exports = {
  createHazardReport,
  findExistingSubmission,
  getPendingReports,
  getReportByReference,
};