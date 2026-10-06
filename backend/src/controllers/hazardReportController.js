const crypto =
  require('crypto');

const {
  createHazardReport,
  getPendingReports,
  getReportByReference,
} =
  require(
    '../services/hazardReportService'
  );

const {
  validateMedia,
} =
  require(
    '../utils/validateMedia'
  );

function validateLocation(
  location
) {
  if (!location) {
    return 'Location is required.';
  }

  const latitude =
    Number(location.latitude);

  const longitude =
    Number(location.longitude);

  if (
    Number.isNaN(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return 'Latitude must be between -90 and 90.';
  }

  if (
    Number.isNaN(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return 'Longitude must be between -180 and 180.';
  }

  if (
    !['GPS', 'MANUAL'].includes(
      location.source
    )
  ) {
    return 'Location source must be GPS or MANUAL.';
  }

  return null;
}

async function submitReport(
  req,
  res,
  next
) {
  try {
    const {
      clientSubmissionId,
      citizenId,
      citizenPhone,
      hazardType,
      description,
      severity,
      location,
      media = [],
    } = req.body;

    if (
      !clientSubmissionId
    ) {
      return res.status(400).json({
        success: false,
        message:
          'clientSubmissionId is required.',
      });
    }

    if (!citizenId) {
      return res.status(400).json({
        success: false,
        message:
          'Citizen ID is required.',
      });
    }

    const allowedHazards = [
      'FLOODING',
      'LANDSLIDE',
      'BLOCKED_ROAD',
    ];

    if (
      !allowedHazards.includes(
        hazardType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'A valid hazard type is required.',
      });
    }

    if (
      !description ||
      description.trim().length <
        10
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Description must contain at least 10 characters.',
      });
    }

    const locationError =
      validateLocation(location);

    if (locationError) {
      return res.status(400).json({
        success: false,
        message: locationError,
      });
    }

    const mediaValidation =
      validateMedia(media);

    if (
      !mediaValidation.valid
    ) {
      return res.status(400).json({
        success: false,
        message:
          mediaValidation.message,
      });
    }

    const {
      report,
      duplicate,
    } =
      await createHazardReport({
        clientSubmissionId,

        citizenId,

        citizenPhone,

        submissionChannel:
          'WEB_MOBILE',

        hazardType,

        description:
          description.trim(),

        severity:
          severity ||
          'MEDIUM',

        location: {
          latitude:
            Number(
              location.latitude
            ),

          longitude:
            Number(
              location.longitude
            ),

          address:
            location.address ||
            '',

          source:
            location.source,
        },

        media,
      });

    return res
      .status(
        duplicate ? 200 : 201
      )
      .json({
        success: true,

        duplicate,

        message: duplicate
          ? 'This report was already submitted. Existing report returned.'
          : 'Hazard report submitted successfully.',

        data: {
          referenceId:
            report.referenceId,

          clientSubmissionId:
            report.clientSubmissionId,

          verificationStatus:
            report.verificationStatus,

          syncStatus:
            report.syncStatus,

          dutyOfficerQueueStatus:
            report.dutyOfficerQueueStatus,

          createdAt:
            report.createdAt,
        },
      });
  } catch (error) {
    next(error);
  }
}

async function submitSmsReport(
  req,
  res,
  next
) {
  try {
    const {
      sender,
      message,
    } = req.body;

    if (!sender || !message) {
      return res.status(400).json({
        success: false,
        message:
          'Sender and SMS message are required.',
      });
    }

    const registeredPhones = [
      '0771234567',
      '0712345678',
      '0751234567',
    ];

    if (
      !registeredPhones.includes(
        sender
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          'The sender is not a registered citizen.',
      });
    }

    const parts =
      message
        .split('|')
        .map(
          (part) =>
            part.trim()
        );

    if (
      parts.length !== 4
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid SMS format. Use TYPE|LATITUDE,LONGITUDE|DESCRIPTION|SEVERITY',
      });
    }

    const [
      hazardTypeInput,
      coordinatesInput,
      description,
      severityInput,
    ] = parts;

    const hazardMap = {
      FLOOD:
        'FLOODING',

      FLOODING:
        'FLOODING',

      LANDSLIDE:
        'LANDSLIDE',

      ROAD:
        'BLOCKED_ROAD',

      BLOCKED_ROAD:
        'BLOCKED_ROAD',
    };

    const hazardType =
      hazardMap[
        hazardTypeInput.toUpperCase()
      ];

    if (!hazardType) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid hazard type. Use FLOOD, LANDSLIDE or ROAD.',
      });
    }

    const [
      latitudeString,
      longitudeString,
    ] =
      coordinatesInput.split(',');

    const latitude =
      Number(latitudeString);

    const longitude =
      Number(longitudeString);

    const locationError =
      validateLocation({
        latitude,
        longitude,
        source: 'MANUAL',
      });

    if (locationError) {
      return res.status(400).json({
        success: false,
        message: locationError,
      });
    }

    if (
      !description ||
      description.length < 10
    ) {
      return res.status(400).json({
        success: false,
        message:
          'SMS description must contain at least 10 characters.',
      });
    }

    const severity =
      severityInput.toUpperCase();

    if (
      ![
        'LOW',
        'MEDIUM',
        'HIGH',
      ].includes(severity)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Severity must be LOW, MEDIUM or HIGH.',
      });
    }

    const {
      report,
    } =
      await createHazardReport({
        clientSubmissionId:
          crypto.randomUUID(),

        citizenId:
          `SMS-${sender}`,

        citizenPhone:
          sender,

        submissionChannel:
          'SMS',

        hazardType,

        description,

        severity,

        location: {
          latitude,
          longitude,
          address:
            'Submitted via SMS',
          source:
            'MANUAL',
        },

        media: [],
      });

    return res.status(201).json({
      success: true,

      message:
        'SMS hazard report accepted.',

      data: {
        referenceId:
          report.referenceId,

        verificationStatus:
          report.verificationStatus,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function listPendingReports(
  req,
  res,
  next
) {
  try {
    const reports =
      await getPendingReports();

    res.json({
      success: true,
      count:
        reports.length,
      data:
        reports,
    });
  } catch (error) {
    next(error);
  }
}

async function getReport(
  req,
  res,
  next
) {
  try {
    const report =
      await getReportByReference(
        req.params.referenceId
      );

    if (!report) {
      return res.status(404).json({
        success: false,
        message:
          'Hazard report not found.',
      });
    }

    res.json({
      success: true,
      data:
        report,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitReport,
  submitSmsReport,
  listPendingReports,
  getReport,
};