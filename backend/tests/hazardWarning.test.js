const mongoose =
  require('mongoose');

const request =
  require('supertest');

const app =
  require('../src/app');

const HazardReport =
  require(
    '../src/models/HazardReport'
  );

const HazardWarning =
  require(
    '../src/models/HazardWarning'
  );

const SensorReading =
  require(
    '../src/models/SensorReading'
  );

const VerificationLog =
  require(
    '../src/models/VerificationLog'
  );

const NotificationDelivery =
  require(
    '../src/models/NotificationDelivery'
  );

jest.setTimeout(
  30000
);

beforeAll(
  async () => {
    await mongoose.connect(
      'mongodb://127.0.0.1:27017/disaster_management_warning_test',
      {
        serverSelectionTimeoutMS:
          15000,

        connectTimeoutMS:
          15000,
      }
    );
  }
);

afterEach(
  async () => {
    const collections =
      mongoose.connection
        .collections;

    for (
      const key of
      Object.keys(
        collections
      )
    ) {
      await collections[
        key
      ].deleteMany({});
    }
  }
);

afterAll(
  async () => {
    await mongoose
      .connection
      .dropDatabase();

    await mongoose
      .connection
      .close();
  }
);

function validWarning(
  overrides = {}
) {
  return {
    sourceType:
      'SENSOR',

    sourceSensorIds:
      [],

    officerId:
      'DUTY-OFFICER-001',

    targetZone: {
      type:
        'DISTRICT',

      name:
        'Colombo',
    },

    severity:
      'HIGH',

    message:
      'Flood risk is increasing in low-lying areas.',

    channels: [
      'PUSH',
      'SMS',
    ],

    ...overrides,
  };
}

async function
createReport(
  status =
    'UNVERIFIED'
) {
  return HazardReport.create({
    referenceId:
      `HR-2026-${Math.floor(
        100000 +
          Math.random() *
            900000
      )}`,

    clientSubmissionId:
      new mongoose.Types
        .ObjectId()
        .toString(),

    citizenId:
      'DEMO-CITIZEN-001',

    citizenPhone:
      '0771234567',

    submissionChannel:
      'WEB_MOBILE',

    hazardType:
      'FLOODING',

    description:
      'Water level rising rapidly near the bridge.',

    severity:
      'HIGH',

    location: {
      latitude:
        6.9271,

      longitude:
        79.8612,

      address:
        'Colombo',

      source:
        'GPS',
    },

    media: [],

    verificationStatus:
      status,

    syncStatus:
      'SENT',

    dutyOfficerQueueStatus:
      'PENDING_REVIEW',
  });
}

async function
createAndBroadcast() {
  const created =
    await request(app)
      .post(
        '/api/hazard-warnings'
      )
      .send(
        validWarning()
      );

  const id =
    created.body
      .warning
      ._id;

  await request(app)
    .post(
      `/api/hazard-warnings/${id}/broadcast`
    )
    .send({
      confirmed:
        true,

      officerId:
        'DUTY-OFFICER-001',
    });

  return id;
}

describe(
  'Manage & Escalate Hazard Warning',
  () => {
    test(
      'creates sensor-only warning draft',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              validWarning()
            );

        expect(
          response.statusCode
        ).toBe(201);

        expect(
          response.body
            .warning
            .lifecycleStatus
        ).toBe(
          'DRAFT'
        );
      }
    );

    test(
      'rejects missing target zone',
      async () => {
        const payload =
          validWarning();

        delete payload
          .targetZone;

        const response =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              payload
            );

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    test(
      'rejects invalid target zone type',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              validWarning({
                targetZone: {
                  type:
                    'PROVINCE',

                  name:
                    'Western',
                },
              })
            );

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    test(
      'rejects invalid severity',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              validWarning({
                severity:
                  'EXTREME',
              })
            );

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    test(
      'records recent nearby sensor evidence',
      async () => {
        await SensorReading.create({
          sensorCode:
            'RIVER-01',

          sensorType:
            'WATER_LEVEL',

          district:
            'Colombo',

          latitude:
            6.9272,

          longitude:
            79.8613,

          value:
            5.6,

          unit:
            'm',

          recordedAt:
            new Date(),
        });

        const response =
          await request(app)
            .get(
              '/api/hazard-warnings/sensors/evidence'
            )
            .query({
              latitude:
                6.9271,

              longitude:
                79.8612,

              maxDistanceKm:
                10,

              maxAgeMinutes:
                60,
            });

        expect(
          response.body.count
        ).toBe(1);

        expect(
          response.body
            .readings[0]
            .proximityKm
        ).toBeDefined();

        expect(
          response.body
            .readings[0]
            .ageMinutes
        ).toBeDefined();
      }
    );

    test(
      'excludes stale sensor evidence',
      async () => {
        await SensorReading.create({
          sensorCode:
            'STALE-01',

          sensorType:
            'RAINFALL',

          district:
            'Colombo',

          latitude:
            6.9271,

          longitude:
            79.8612,

          value:
            30,

          unit:
            'mm',

          recordedAt:
            new Date(
              Date.now() -
                5 *
                  60 *
                  60 *
                  1000
            ),
        });

        const response =
          await request(app)
            .get(
              '/api/hazard-warnings/sensors/evidence'
            )
            .query({
              latitude:
                6.9271,

              longitude:
                79.8612,

              maxDistanceKm:
                10,

              maxAgeMinutes:
                60,
            });

        expect(
          response.body.count
        ).toBe(0);
      }
    );

    test(
      'verifies citizen report and creates VerificationLog',
      async () => {
        const report =
          await createReport();

        const response =
          await request(app)
            .patch(
              `/api/hazard-warnings/reports/${report._id}/review`
            )
            .send({
              decision:
                'VERIFIED',

              officerId:
                'DUTY-OFFICER-001',

              remarks:
                'Evidence supported by recent sensors.',
            });

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.body
            .report
            .verificationStatus
        ).toBe(
          'VERIFIED'
        );

        expect(
          await VerificationLog
            .countDocuments({
              reportId:
                report._id,
            })
        ).toBe(1);
      }
    );

    test(
      'dismisses false alarm and creates VerificationLog',
      async () => {
        const report =
          await createReport();

        const response =
          await request(app)
            .patch(
              `/api/hazard-warnings/reports/${report._id}/review`
            )
            .send({
              decision:
                'DISMISSED',

              officerId:
                'DUTY-OFFICER-001',
            });

        expect(
          response.body
            .report
            .verificationStatus
        ).toBe(
          'DISMISSED'
        );
      }
    );

    test(
      'conflicting evidence keeps report unverified',
      async () => {
        const report =
          await createReport();

        const response =
          await request(app)
            .patch(
              `/api/hazard-warnings/reports/${report._id}/review`
            )
            .send({
              decision:
                'CONFLICTING',

              officerId:
                'DUTY-OFFICER-001',
            });

        expect(
          response.body
            .report
            .verificationStatus
        ).toBe(
          'UNVERIFIED'
        );

        expect(
          response.body
            .report
            .dutyOfficerQueueStatus
        ).toBe(
          'UNDER_REVIEW'
        );
      }
    );

    test(
      'unverified report cannot create warning',
      async () => {
        const report =
          await createReport();

        const response =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              validWarning({
                sourceType:
                  'REPORT',

                sourceReportId:
                  report._id
                    .toString(),
              })
            );

        expect(
          response.statusCode
        ).toBe(409);
      }
    );

    test(
      'verified report with verification log can create warning',
      async () => {
        const report =
          await createReport();

        await request(app)
          .patch(
            `/api/hazard-warnings/reports/${report._id}/review`
          )
          .send({
            decision:
              'VERIFIED',

            officerId:
              'DUTY-OFFICER-001',
          });

        const response =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              validWarning({
                sourceType:
                  'REPORT',

                sourceReportId:
                  report._id
                    .toString(),
              })
            );

        expect(
          response.statusCode
        ).toBe(201);
      }
    );

    test(
      'broadcast requires confirmation',
      async () => {
        const created =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              validWarning()
            );

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${created.body.warning._id}/broadcast`
            )
            .send({
              confirmed:
                false,

              officerId:
                'DUTY-OFFICER-001',
            });

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    test(
      'broadcast activates warning and logs delivery per channel',
      async () => {
        const id =
          await createAndBroadcast();

        const warning =
          await HazardWarning
            .findById(id);

        expect(
          warning.lifecycleStatus
        ).toBe(
          'ACTIVE'
        );

        expect(
          warning
            .districtOfficerNotification
            .status
        ).toBe(
          'NOTIFIED'
        );

        expect(
          await NotificationDelivery
            .countDocuments({
              warningId:
                id,
            })
        ).toBe(2);
      }
    );

    test(
      'records failed notification channel independently',
      async () => {
        const created =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              validWarning()
            );

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${created.body.warning._id}/broadcast`
            )
            .send({
              confirmed:
                true,

              officerId:
                'DUTY-OFFICER-001',

              simulateFailedChannels:
                ['SMS'],
            });

        const sms =
          response.body
            .deliveries
            .find(
              (delivery) =>
                delivery.channel ===
                'SMS'
            );

        expect(
          sms.status
        ).toBe(
          'FAILED'
        );
      }
    );

    test(
      'retries only failed channels',
      async () => {
        const created =
          await request(app)
            .post(
              '/api/hazard-warnings'
            )
            .send(
              validWarning()
            );

        const id =
          created.body
            .warning
            ._id;

        await request(app)
          .post(
            `/api/hazard-warnings/${id}/broadcast`
          )
          .send({
            confirmed:
              true,

            officerId:
              'DUTY-OFFICER-001',

            simulateFailedChannels:
              ['SMS'],
          });

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${id}/retry-failed`
            )
            .send({
              officerId:
                'DUTY-OFFICER-001',
            });

        expect(
          response.body
            .retried
        ).toHaveLength(1);

        expect(
          response.body
            .retried[0]
            .channel
        ).toBe(
          'SMS'
        );

        expect(
          response.body
            .retried[0]
            .attemptCount
        ).toBe(2);
      }
    );

    test(
      'escalation requires higher severity',
      async () => {
        const id =
          await createAndBroadcast();

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${id}/lifecycle`
            )
            .send({
              action:
                'ESCALATE',

              officerId:
                'DUTY-OFFICER-001',

              newSeverity:
                'MEDIUM',

              message:
                'Risk level changed.',
            });

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    test(
      'escalates and re-broadcasts changed warning',
      async () => {
        const id =
          await createAndBroadcast();

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${id}/lifecycle`
            )
            .send({
              action:
                'ESCALATE',

              officerId:
                'DUTY-OFFICER-001',

              newSeverity:
                'CRITICAL',

              message:
                'Severe flooding is expected. Evacuate immediately.',
            });

        expect(
          response.body
            .warning
            .lifecycleStatus
        ).toBe(
          'ESCALATED'
        );

        expect(
          response.body
            .warning
            .severity
        ).toBe(
          'CRITICAL'
        );

        expect(
          response.body
            .deliveries
        ).toHaveLength(2);
      }
    );

    test(
      'de-escalation requires lower severity',
      async () => {
        const id =
          await createAndBroadcast();

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${id}/lifecycle`
            )
            .send({
              action:
                'DE_ESCALATE',

              officerId:
                'DUTY-OFFICER-001',

              newSeverity:
                'CRITICAL',

              message:
                'Risk remains.',
            });

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    test(
      'de-escalates warning',
      async () => {
        const id =
          await createAndBroadcast();

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${id}/lifecycle`
            )
            .send({
              action:
                'DE_ESCALATE',

              officerId:
                'DUTY-OFFICER-001',

              newSeverity:
                'MEDIUM',

              message:
                'Flood risk is reducing. Remain alert.',
            });

        expect(
          response.body
            .warning
            .lifecycleStatus
        ).toBe(
          'DE_ESCALATED'
        );
      }
    );

    test(
      'cancel requires explicit confirmation',
      async () => {
        const id =
          await createAndBroadcast();

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${id}/lifecycle`
            )
            .send({
              action:
                'CANCEL',

              confirmed:
                false,

              officerId:
                'DUTY-OFFICER-001',
            });

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    test(
      'cancellation sends all-clear and preserves history',
      async () => {
        const id =
          await createAndBroadcast();

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${id}/lifecycle`
            )
            .send({
              action:
                'CANCEL',

              confirmed:
                true,

              officerId:
                'DUTY-OFFICER-001',
            });

        expect(
          response.body
            .warning
            .lifecycleStatus
        ).toBe(
          'CANCELLED'
        );

        expect(
          response.body
            .deliveries
            .every(
              (delivery) =>
                delivery.notificationType ===
                'ALL_CLEAR'
            )
        ).toBe(true);

        const warning =
          await HazardWarning
            .findById(id);

        expect(
          warning
            .lifecycleHistory
            .length
        ).toBeGreaterThanOrEqual(
          3
        );
      }
    );

    test(
      'cancelled warning is terminal',
      async () => {
        const id =
          await createAndBroadcast();

        await request(app)
          .post(
            `/api/hazard-warnings/${id}/lifecycle`
          )
          .send({
            action:
              'CANCEL',

            confirmed:
              true,

            officerId:
              'DUTY-OFFICER-001',
          });

        const response =
          await request(app)
            .post(
              `/api/hazard-warnings/${id}/lifecycle`
            )
            .send({
              action:
                'ESCALATE',

              officerId:
                'DUTY-OFFICER-001',

              newSeverity:
                'CRITICAL',
            });

        expect(
          response.statusCode
        ).toBe(409);
      }
    );
  }
);