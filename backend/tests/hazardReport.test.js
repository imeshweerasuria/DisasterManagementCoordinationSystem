const mongoose =
  require('mongoose');

const request =
  require('supertest');

const app =
  require('../src/app');


/*
 * Give Jest enough time for MongoDB
 * connection/setup on slower machines.
 */
jest.setTimeout(30000);


/*
 * TEST DATABASE SETUP
 *
 * This uses a separate MongoDB database:
 *
 * disaster_management_test
 *
 * It does NOT use or delete data from:
 *
 * disaster_management_db
 */

beforeAll(async () => {
  await mongoose.connect(
    'mongodb://127.0.0.1:27017/disaster_management_test',
    {
      serverSelectionTimeoutMS:
        15000,

      connectTimeoutMS:
        15000,
    }
  );
});


/*
 * Clear all test collection data
 * after every individual test.
 */

afterEach(async () => {
  const collections =
    mongoose.connection.collections;

  for (const key in collections) {
    await collections[
      key
    ].deleteMany({});
  }
});


/*
 * Delete the temporary test database
 * and close the MongoDB connection
 * after all tests finish.
 */

afterAll(async () => {
  await mongoose
    .connection
    .dropDatabase();

  await mongoose
    .connection
    .close();
});


/*
 * Creates a valid hazard report
 * for reuse throughout the tests.
 */

function validReport(
  overrides = {}
) {
  return {
    clientSubmissionId:
      `submission-${Date.now()}-${Math.random()}`,

    citizenId:
      'DEMO-CITIZEN-001',

    citizenPhone:
      '0771234567',

    hazardType:
      'FLOODING',

    description:
      'Water level is rapidly rising near the bridge.',

    severity:
      'HIGH',

    location: {
      latitude:
        6.9271,

      longitude:
        79.8612,

      address:
        'Kelani Bridge',

      source:
        'GPS',
    },

    media: [],

    ...overrides,
  };
}


describe(
  'Hazard Report API',
  () => {

    test(
      'creates a valid hazard report',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              validReport()
            );

        expect(
          response.status
        ).toBe(201);

        expect(
          response.body.success
        ).toBe(true);

        expect(
          response.body.data
            .verificationStatus
        ).toBe(
          'UNVERIFIED'
        );

        expect(
          response.body.data
            .syncStatus
        ).toBe(
          'SENT'
        );

        expect(
          response.body.data
            .referenceId
        ).toMatch(
          /^HR-\d{4}-\d{6}$/
        );
      }
    );


    test(
      'rejects missing hazard type',
      async () => {
        const report =
          validReport({
            hazardType:
              '',
          });

        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              report
            );

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects short description',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              validReport({
                description:
                  'Flood',
              })
            );

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects invalid latitude',
      async () => {
        const report =
          validReport();

        report.location.latitude =
          120;

        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              report
            );

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects invalid longitude',
      async () => {
        const report =
          validReport();

        report.location.longitude =
          250;

        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              report
            );

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'accepts manual location',
      async () => {
        const report =
          validReport();

        report.location.source =
          'MANUAL';

        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              report
            );

        expect(
          response.status
        ).toBe(201);

        expect(
          response.body.success
        ).toBe(true);
      }
    );


    test(
      'prevents duplicate submission using clientSubmissionId',
      async () => {
        const report =
          validReport();

        const first =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              report
            );

        const second =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              report
            );

        expect(
          first.status
        ).toBe(201);

        expect(
          second.status
        ).toBe(200);

        expect(
          second.body.duplicate
        ).toBe(true);

        expect(
          second.body.data
            .referenceId
        ).toBe(
          first.body.data
            .referenceId
        );
      }
    );


    test(
      'accepts supported image',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              validReport({
                media: [
                  {
                    fileName:
                      'flood.jpg',

                    mimeType:
                      'image/jpeg',

                    size:
                      10000,

                    dataUrl:
                      'data:image/jpeg;base64,test',
                  },
                ],
              })
            );

        expect(
          response.status
        ).toBe(201);

        expect(
          response.body.success
        ).toBe(true);
      }
    );


    test(
      'rejects unsupported media type',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              validReport({
                media: [
                  {
                    fileName:
                      'file.exe',

                    mimeType:
                      'application/exe',

                    size:
                      5000,
                  },
                ],
              })
            );

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects oversized media',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              validReport({
                media: [
                  {
                    fileName:
                      'large.jpg',

                    mimeType:
                      'image/jpeg',

                    size:
                      3 *
                      1024 *
                      1024,
                  },
                ],
              })
            );

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'returns unverified reports in duty officer queue',
      async () => {
        await request(app)
          .post(
            '/api/hazard-reports'
          )
          .send(
            validReport()
          );

        const response =
          await request(app)
            .get(
              '/api/hazard-reports/pending'
            );

        expect(
          response.status
        ).toBe(200);

        expect(
          response.body.count
        ).toBe(1);

        expect(
          response.body.data[0]
            .verificationStatus
        ).toBe(
          'UNVERIFIED'
        );

        expect(
          response.body.data[0]
            .dutyOfficerQueueStatus
        ).toBe(
          'PENDING_REVIEW'
        );
      }
    );


    test(
      'accepts valid structured SMS report',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports/sms'
            )
            .send({
              sender:
                '0771234567',

              message:
                'FLOOD|6.9271,79.8612|Water level rising near the bridge|HIGH',
            });

        expect(
          response.status
        ).toBe(201);

        expect(
          response.body.success
        ).toBe(true);

        expect(
          response.body.data
            .verificationStatus
        ).toBe(
          'UNVERIFIED'
        );

        expect(
          response.body.data
            .referenceId
        ).toMatch(
          /^HR-\d{4}-\d{6}$/
        );
      }
    );


    test(
      'rejects SMS from unregistered sender',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports/sms'
            )
            .send({
              sender:
                '0700000000',

              message:
                'FLOOD|6.9271,79.8612|Water rising near bridge area|HIGH',
            });

        expect(
          response.status
        ).toBe(403);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects malformed SMS',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports/sms'
            )
            .send({
              sender:
                '0771234567',

              message:
                'Flood near bridge',
            });

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);

        expect(
          response.body.message
        ).toContain(
          'Invalid SMS format'
        );
      }
    );


    test(
      'returns report by reference id',
      async () => {
        const createResponse =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              validReport()
            );

        const referenceId =
          createResponse
            .body
            .data
            .referenceId;

        const response =
          await request(app)
            .get(
              `/api/hazard-reports/${referenceId}`
            );

        expect(
          response.status
        ).toBe(200);

        expect(
          response.body.success
        ).toBe(true);

        expect(
          response.body.data
            .referenceId
        ).toBe(
          referenceId
        );
      }
    );


    test(
      'returns 404 for unknown reference id',
      async () => {
        const response =
          await request(app)
            .get(
              '/api/hazard-reports/HR-2026-000000'
            );

        expect(
          response.status
        ).toBe(404);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    /*
     * Additional branch coverage tests
     */


    test(
      'rejects more than three media attachments',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              validReport({
                media: [
                  {
                    fileName:
                      'one.jpg',

                    mimeType:
                      'image/jpeg',

                    size:
                      1000,
                  },

                  {
                    fileName:
                      'two.jpg',

                    mimeType:
                      'image/jpeg',

                    size:
                      1000,
                  },

                  {
                    fileName:
                      'three.jpg',

                    mimeType:
                      'image/jpeg',

                    size:
                      1000,
                  },

                  {
                    fileName:
                      'four.jpg',

                    mimeType:
                      'image/jpeg',

                    size:
                      1000,
                  },
                ],
              })
            );

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects report without location',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports'
            )
            .send(
              validReport({
                location:
                  null,
              })
            );

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects SMS with invalid severity',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports/sms'
            )
            .send({
              sender:
                '0771234567',

              message:
                'FLOOD|6.9271,79.8612|Water rising near bridge|EXTREME',
            });

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects SMS with invalid hazard type',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports/sms'
            )
            .send({
              sender:
                '0771234567',

              message:
                'FIRE|6.9271,79.8612|Large fire near the bridge|HIGH',
            });

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );


    test(
      'rejects SMS with invalid coordinates',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/hazard-reports/sms'
            )
            .send({
              sender:
                '0771234567',

              message:
                'FLOOD|120,250|Water rising near bridge|HIGH',
            });

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );
  }
);