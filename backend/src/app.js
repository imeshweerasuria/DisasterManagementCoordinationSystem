const express =
  require('express');

const cors =
  require('cors');

const hazardReportRoutes =
  require(
    './routes/hazardReportRoutes'
  );

const hazardWarningRoutes =
  require(
    './routes/hazardWarningRoutes'
  );

const disasterEventRoutes =
  require(
    './routes/disasterEventRoutes'
  );

const emergencyResponseRoutes =
  require(
    './routes/emergencyResponseRoutes'
  );

const errorHandler =
  require(
    './middleware/errorHandler'
  );

const app =
  express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      'http://localhost:5173',

    credentials: true,
  })
);

app.use(
  express.json({
    limit: '10mb',
  })
);

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      success: true,
      message:
        'Disaster Management API is running.',
    });
  }
);

app.use(
  '/api/hazard-reports',
  hazardReportRoutes
);

app.use(
  '/api/hazard-warnings',
  hazardWarningRoutes
);

app.use(
  '/api/disaster-events',
  disasterEventRoutes
);

app.use(
  '/api/emergency-response',
  emergencyResponseRoutes
);

app.use(
  errorHandler
);

module.exports = app;