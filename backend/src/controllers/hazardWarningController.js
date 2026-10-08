const service =
  require(
    '../services/hazardWarningService'
  );

async function
createSensorReading(
  req,
  res,
  next
) {
  try {
    const sensorReading =
      await service
        .createSensorReading(
          req.body
        );

    return res
      .status(201)
      .json({
        success: true,
        sensorReading,
      });
  } catch (error) {
    return next(error);
  }
}

async function
getSensorEvidence(
  req,
  res,
  next
) {
  try {
    const readings =
      await service
        .getSensorEvidence(
          req.query
        );

    return res.json({
      success: true,
      count:
        readings.length,
      readings,
    });
  } catch (error) {
    return next(error);
  }
}

async function
reviewReport(
  req,
  res,
  next
) {
  try {
    const result =
      await service
        .reviewReport(
          req.params.reportId,
          req.body
        );

    return res.json({
      success: true,
      message:
        'Report review recorded.',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

async function
getVerificationHistory(
  req,
  res,
  next
) {
  try {
    const logs =
      await service
        .getVerificationHistory(
          req.params.reportId
        );

    return res.json({
      success: true,
      count:
        logs.length,
      logs,
    });
  } catch (error) {
    return next(error);
  }
}

async function
createWarning(
  req,
  res,
  next
) {
  try {
    const warning =
      await service
        .createWarning(
          req.body
        );

    return res
      .status(201)
      .json({
        success: true,
        message:
          'Hazard warning draft created.',
        warning,
      });
  } catch (error) {
    return next(error);
  }
}

async function
listWarnings(
  req,
  res,
  next
) {
  try {
    const warnings =
      await service
        .listWarnings();

    return res.json({
      success: true,
      count:
        warnings.length,
      warnings,
    });
  } catch (error) {
    return next(error);
  }
}

async function
getWarning(
  req,
  res,
  next
) {
  try {
    const warning =
      await service
        .getWarningById(
          req.params.warningId
        );

    return res.json({
      success: true,
      warning,
    });
  } catch (error) {
    return next(error);
  }
}

async function
broadcastWarning(
  req,
  res,
  next
) {
  try {
    const result =
      await service
        .broadcastWarning(
          req.params.warningId,
          req.body
        );

    return res.json({
      success: true,
      message:
        'Warning broadcast processed.',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

async function
changeLifecycle(
  req,
  res,
  next
) {
  try {
    const result =
      await service
        .changeLifecycle(
          req.params.warningId,
          req.body
        );

    return res.json({
      success: true,
      message:
        'Warning lifecycle updated.',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

async function
getDeliveries(
  req,
  res,
  next
) {
  try {
    const deliveries =
      await service
        .getDeliveries(
          req.params.warningId
        );

    return res.json({
      success: true,
      count:
        deliveries.length,
      deliveries,
    });
  } catch (error) {
    return next(error);
  }
}

async function
retryFailedDeliveries(
  req,
  res,
  next
) {
  try {
    const result =
      await service
        .retryFailedDeliveries(
          req.params.warningId,
          req.body
        );

    return res.json({
      success: true,
      message:
        'Failed notification channels retried.',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createSensorReading,
  getSensorEvidence,
  reviewReport,
  getVerificationHistory,
  createWarning,
  listWarnings,
  getWarning,
  broadcastWarning,
  changeLifecycle,
  getDeliveries,
  retryFailedDeliveries,
};