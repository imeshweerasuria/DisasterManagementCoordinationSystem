const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');
const DisasterEvent = require('../src/models/DisasterEvent');
const RescueTeam = require('../src/models/RescueTeam');
const RescueAssignment = require('../src/models/RescueAssignment');
const ShelterOccupancyRecord = require('../src/models/ShelterOccupancyRecord');
const Shelter = require('../src/models/Shelter');
const ReliefResource = require('../src/models/ReliefResource');

jest.setTimeout(30000);

beforeAll(async () => {
  await mongoose.connect(
    'mongodb://127.0.0.1:27017/disaster_management_test',
    {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    }
  );
});

afterEach(async () => {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

async function createEvent(status = 'ACTIVE') {
  return DisasterEvent.create({
    eventCode: `EV-${Date.now()}-${Math.random()}`,
    name: 'Flood Response Event',
    district: 'Colombo',
    hazardType: 'FLOODING',
    startDate: new Date('2026-10-01T00:00:00Z'),
    endDate:
      status === 'COMPLETED'
        ? new Date('2026-10-03T00:00:00Z')
        : null,
    status,
  });
}

async function createTeam(overrides = {}) {
  return RescueTeam.create({
    teamCode: `TEAM-${Date.now()}-${Math.random()}`,
    name: 'Rescue Alpha',
    district: 'Colombo',
    teamType: 'GENERAL',
    currentStatus: 'AVAILABLE',
    ...overrides,
  });
}

describe('Emergency Response API', () => {
  test('registers shelter and initial occupancy history', async () => {
    const event = await createEvent();

    const response = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: event._id.toString(),
        name: 'Central College Shelter',
        district: 'Colombo',
        address: 'Main Street',
        capacity: 100,
        currentOccupancy: 20,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('OPEN');
    expect(response.body.data.currentOccupancy).toBe(20);

    const history = await ShelterOccupancyRecord.find({
      shelterId: response.body.data._id,
      eventId: event._id,
    });

    expect(history).toHaveLength(1);
    expect(history[0].occupancy).toBe(20);
  });

  test('marks shelter FULL when occupancy reaches capacity', async () => {
    const event = await createEvent();

    const create = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: event._id.toString(),
        name: 'Town Hall Shelter',
        district: 'Colombo',
        address: 'Town Hall',
        capacity: 50,
      });

    const response = await request(app)
      .patch(
        `/api/emergency-response/shelters/${create.body.data._id}/occupancy`
      )
      .send({
        occupancy: 50,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('FULL');
  });

  test('rejects occupancy above shelter capacity', async () => {
    const event = await createEvent();

    const create = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: event._id.toString(),
        name: 'School Shelter',
        district: 'Colombo',
        address: 'School Road',
        capacity: 25,
      });

    const response = await request(app)
      .patch(
        `/api/emergency-response/shelters/${create.body.data._id}/occupancy`
      )
      .send({
        occupancy: 26,
      });

    expect(response.status).toBe(400);
  });

  test('dispatches an available rescue team', async () => {
    const event = await createEvent();
    const team = await createTeam();

    const response = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: team._id.toString(),
        incidentDescription: 'Families stranded by flood water.',
        affectedLocation: {
          label: 'Kelani Bridge',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('EN_ROUTE');
  });

  test('rejects dispatch of unavailable rescue team', async () => {
    const event = await createEvent();
    const team = await createTeam({
      currentStatus: 'UNAVAILABLE',
    });

    const response = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: team._id.toString(),
        incidentDescription: 'Blocked access road.',
        affectedLocation: {
          label: 'Bridge Road',
        },
      });

    expect(response.status).toBe(409);
  });

  test('updates rescue team assignment from EN_ROUTE to ON_SCENE', async () => {
    const event = await createEvent();
    const team = await createTeam();

    const create = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: team._id.toString(),
        incidentDescription: 'Flood evacuation.',
        affectedLocation: {
          label: 'River Road',
        },
      });

    const response = await request(app)
      .patch(
        `/api/emergency-response/assignments/${create.body.data._id}/status`
      )
      .send({
        status: 'ON_SCENE',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ON_SCENE');
  });

  test('preserves assignment history during reassignment', async () => {
    const event = await createEvent();
    const firstTeam = await createTeam();
    const replacementTeam = await createTeam({
      teamCode: `REPLACEMENT-${Date.now()}`,
      name: 'Rescue Bravo',
    });

    const create = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: firstTeam._id.toString(),
        incidentDescription: 'Road blocked by debris.',
        affectedLocation: {
          label: 'Hill Road',
        },
      });

    const response = await request(app)
      .post(
        `/api/emergency-response/assignments/${create.body.data._id}/reassign`
      )
      .send({
        newTeamId: replacementTeam._id.toString(),
      });

    expect(response.status).toBe(201);
    expect(response.body.data.previousAssignment.status).toBe('REASSIGNED');
    expect(
      response.body.data.newAssignment.previousAssignmentId
    ).toBe(create.body.data._id);
  });

  test('rejects reassigning a medical assignment to a general team', async () => {
    const event = await createEvent();
    const medical = await createTeam({
      teamCode: `MED-${Date.now()}`,
      name: 'Medical Unit',
      teamType: 'MEDICAL',
    });
    const general = await createTeam({
      teamCode: `GEN-${Date.now()}`,
      name: 'General Unit',
      teamType: 'GENERAL',
    });

    const create = await request(app)
      .post('/api/emergency-response/medical-evacuation')
      .send({
        eventId: event._id.toString(),
        affectedLocation: {
          label: 'Kelani Bridge',
        },
      });

    expect(create.body.data.assignment.teamId).toBe(
      medical._id.toString()
    );

    const response = await request(app)
      .post(
        `/api/emergency-response/assignments/${create.body.data.assignment._id}/reassign`
      )
      .send({
        newTeamId: general._id.toString(),
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/MEDICAL/);
  });

  test('partially fulfils relief allocation and records shortfall', async () => {
    const event = await createEvent();

    const resource = await request(app)
      .post('/api/emergency-response/resources')
      .send({
        eventId: event._id.toString(),
        organisationName: 'Relief NGO',
        resourceType: 'Water Bottle',
        unit: 'bottles',
        availableQuantity: 40,
        district: 'Colombo',
      });

    const response = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'AFFECTED_LOCATION',
        destinationLabel: 'River Road',
        requestedQuantity: 60,
        district: 'Colombo',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.partialFulfilment).toBe(true);
    expect(response.body.data.distribution.allocatedQuantity).toBe(40);
    expect(response.body.data.distribution.shortfallQuantity).toBe(20);
  });

  test('dispatches available medical team for urgent evacuation', async () => {
    const event = await createEvent();

    await createTeam({
      teamCode: `MED-${Date.now()}`,
      name: 'Medical Rescue Unit',
      teamType: 'MEDICAL',
    });

    const response = await request(app)
      .post('/api/emergency-response/medical-evacuation')
      .send({
        eventId: event._id.toString(),
        district: 'Colombo',
        affectedLocation: {
          label: 'Flood Zone A',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.escalated).toBe(false);
  });

  test('does not dispatch a general team for medical evacuation', async () => {
    const event = await createEvent();

    await createTeam({
      teamCode: `GEN-${Date.now()}`,
      name: 'Rescue Gama',
      teamType: 'GENERAL',
    });
    const medical = await createTeam({
      teamCode: `MED-${Date.now()}`,
      name: 'Rescue Gama',
      teamType: 'MEDICAL',
    });

    const response = await request(app)
      .post('/api/emergency-response/medical-evacuation')
      .send({
        eventId: event._id.toString(),
        affectedLocation: {
          label: 'Kelani Bridge',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.assignment.teamId).toBe(
      medical._id.toString()
    );
  });

  test('escalates urgent medical evacuation when no local team exists', async () => {
    const event = await createEvent();

    const response = await request(app)
      .post('/api/emergency-response/medical-evacuation')
      .send({
        eventId: event._id.toString(),
        district: 'Colombo',
        affectedLocation: {
          label: 'Flood Zone B',
        },
      });

    expect(response.status).toBe(202);
    expect(response.body.data.escalated).toBe(true);
  });

  test('marks inactive field assignment STATUS_UNKNOWN on dashboard', async () => {
    const event = await createEvent();
    const team = await createTeam();

    const assignment = await RescueAssignment.create({
      eventId: event._id,
      teamId: team._id,
      incidentDescription: 'Flood rescue',
      affectedLocation: {
        label: 'Old Road',
      },
      status: 'EN_ROUTE',
      lastUpdateTime: new Date(Date.now() - 60 * 60 * 1000),
    });

    const response = await request(app)
      .get('/api/emergency-response/dashboard')
      .query({
        eventId: event._id.toString(),
        inactivityMinutes: 30,
      });

    expect(response.status).toBe(200);

    const updated = response.body.data.assignments.find(
      (item) => item._id === assignment._id.toString()
    );

    expect(updated.status).toBe('STATUS_UNKNOWN');
  });

  test('lists event shelters and shared available teams and stock', async () => {
    const colombo = await createEvent();
    const gampaha = await DisasterEvent.create({
      eventCode: `EV2-${Date.now()}`,
      name: 'Gampaha Flood',
      district: 'Gampaha',
      hazardType: 'FLOODING',
      startDate: new Date('2026-10-07T00:00:00Z'),
      status: 'ACTIVE',
    });

    await createTeam({
      name: 'Colombo Team',
      district: 'Colombo',
    });
    await createTeam({
      name: 'Gampaha Team',
      district: 'Gampaha',
    });

    await request(app).post('/api/emergency-response/shelters').send({
      eventId: colombo._id.toString(),
      name: 'Colombo Shelter',
      district: 'Colombo',
      address: 'Main Street',
      capacity: 10,
    });

    await request(app).post('/api/emergency-response/shelters').send({
      eventId: gampaha._id.toString(),
      name: 'Gampaha Shelter',
      district: 'Gampaha',
      address: 'Town Road',
      capacity: 10,
    });

    await request(app).post('/api/emergency-response/resources').send({
      organisationName: 'Kandy Warehouse',
      resourceType: 'Blankets',
      unit: 'packs',
      availableQuantity: 5,
      district: 'Kandy',
    });

    const response = await request(app)
      .get('/api/emergency-response/dashboard')
      .query({ eventId: gampaha._id.toString() });

    expect(response.status).toBe(200);
    expect(response.body.data.teams).toEqual([]);
    expect(
      response.body.data.availableTeams.map((team) => team.name).sort()
    ).toEqual(['Colombo Team', 'Gampaha Team']);
    expect(response.body.data.shelters.map((shelter) => shelter.name)).toEqual([
      'Gampaha Shelter',
    ]);
    expect(response.body.data.districtShelters).toBeUndefined();
    expect(response.body.data.shelters[0].occupancyHistory).toHaveLength(1);
    expect(response.body.data.resources).toEqual([]);
    expect(
      response.body.data.availableResources.map((item) => item.district)
    ).toEqual(['Kandy']);
  });

  test('dispatches an available team from another district', async () => {
    const event = await DisasterEvent.create({
      eventCode: `EV3-${Date.now()}`,
      name: 'Gampaha Flood',
      district: 'Gampaha',
      hazardType: 'FLOODING',
      startDate: new Date('2026-10-07T00:00:00Z'),
      status: 'ACTIVE',
    });
    const team = await createTeam({
      district: 'Kalutara',
      name: 'Mutual Aid Team',
    });

    const response = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: team._id.toString(),
        incidentDescription: 'Mutual aid dispatch.',
        affectedLocation: { label: 'Gampaha Town' },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('EN_ROUTE');
    expect(response.body.data.eventId).toBe(event._id.toString());
  });

  test('rejects a shelter from another district', async () => {
    const event = await DisasterEvent.create({
      eventCode: `EV4-${Date.now()}`,
      name: 'Gampaha Flood',
      district: 'Gampaha',
      hazardType: 'FLOODING',
      startDate: new Date('2026-10-07T00:00:00Z'),
      status: 'ACTIVE',
    });

    const response = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: event._id.toString(),
        name: 'Colombo Shelter',
        district: 'Colombo',
        address: 'Main Street',
        capacity: 10,
      });

    expect(response.status).toBe(400);
  });

  test('allocates stock that originated in another district', async () => {
    const event = await DisasterEvent.create({
      eventCode: `EV5-${Date.now()}`,
      name: 'Gampaha Flood',
      district: 'Gampaha',
      hazardType: 'FLOODING',
      startDate: new Date('2026-10-07T00:00:00Z'),
      status: 'ACTIVE',
    });

    const resource = await request(app)
      .post('/api/emergency-response/resources')
      .send({
        organisationName: 'Colombo Donor',
        resourceType: 'Water',
        unit: 'packs',
        availableQuantity: 20,
        district: 'Colombo',
      });

    const response = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'AFFECTED_LOCATION',
        destinationLabel: 'Gampaha Town',
        requestedQuantity: 8,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.distribution.allocatedQuantity).toBe(8);
    expect(response.body.data.partialFulfilment).toBe(false);
  });

  test('keeps registered shelters on their own event only', async () => {
    const first = await DisasterEvent.create({
      eventCode: `EV6-${Date.now()}`,
      name: 'First Gampaha Flood',
      district: 'Gampaha',
      hazardType: 'FLOODING',
      startDate: new Date('2026-10-07T00:00:00Z'),
      status: 'ACTIVE',
    });
    const second = await DisasterEvent.create({
      eventCode: `EV7-${Date.now()}`,
      name: 'Second Gampaha Flood',
      district: 'Gampaha',
      hazardType: 'FLOODING',
      startDate: new Date('2026-10-08T00:00:00Z'),
      status: 'ACTIVE',
    });

    const created = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: first._id.toString(),
        name: 'Town Hall Shelter',
        district: 'Gampaha',
        address: 'Town Hall',
        capacity: 40,
        currentOccupancy: 12,
      });

    await request(app)
      .patch(
        `/api/emergency-response/shelters/${created.body.data._id}/occupancy`
      )
      .send({
        occupancy: 18,
      });

    const firstDashboard = await request(app)
      .get('/api/emergency-response/dashboard')
      .query({ eventId: first._id.toString() });
    const secondDashboard = await request(app)
      .get('/api/emergency-response/dashboard')
      .query({ eventId: second._id.toString() });

    expect(
      firstDashboard.body.data.shelters.map((item) => item.name)
    ).toEqual(['Town Hall Shelter']);
    expect(firstDashboard.body.data.shelters[0].currentOccupancy).toBe(18);
    expect(
      firstDashboard.body.data.shelters[0].occupancyHistory.map(
        (item) => item.occupancy
      )
    ).toEqual([18, 12]);
    expect(secondDashboard.body.data.shelters).toEqual([]);
  });

  test('rejects shelter occupancy above capacity at registration', async () => {
    const event = await createEvent();

    const response = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: event._id.toString(),
        name: 'Overfull Shelter',
        district: 'Colombo',
        address: 'Main Street',
        capacity: 10,
        currentOccupancy: 12,
      });

    expect(response.status).toBe(400);
  });

  test('registers a shelter as FULL when occupancy equals capacity', async () => {
    const event = await createEvent();

    const response = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: event._id.toString(),
        name: 'Full Shelter',
        district: 'Colombo',
        address: 'Hall Road',
        capacity: 20,
        currentOccupancy: 20,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('FULL');
  });

  test('rejects occupancy updates for a missing or closed shelter', async () => {
    const event = await createEvent();
    const missing = await request(app)
      .patch(
        `/api/emergency-response/shelters/${new mongoose.Types.ObjectId()}/occupancy`
      )
      .send({ occupancy: 1 });

    const closed = await Shelter.create({
      eventId: event._id,
      name: 'Closed Hall',
      district: 'Colombo',
      address: 'Old Road',
      capacity: 30,
      currentOccupancy: 0,
      status: 'CLOSED',
    });

    const closedUpdate = await request(app)
      .patch(`/api/emergency-response/shelters/${closed._id}/occupancy`)
      .send({ occupancy: 4 });

    expect(missing.status).toBe(404);
    expect(closedUpdate.status).toBe(400);
  });

  test('rejects work on a missing or completed event', async () => {
    const completed = await createEvent('COMPLETED');

    const missing = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: new mongoose.Types.ObjectId().toString(),
        name: 'Hall',
        district: 'Colombo',
        address: 'Main Street',
        capacity: 10,
      });

    const inactive = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: completed._id.toString(),
        name: 'Hall',
        district: 'Colombo',
        address: 'Main Street',
        capacity: 10,
      });

    expect(missing.status).toBe(404);
    expect(inactive.status).toBe(400);
  });

  test('registers a rescue team and rejects a missing district or duplicate code', async () => {
    const created = await request(app)
      .post('/api/emergency-response/rescue-teams')
      .send({
        teamCode: 'RESCUE-COV-001',
        name: 'Coverage Team',
        district: 'Colombo',
        teamType: 'GENERAL',
      });

    const noDistrict = await request(app)
      .post('/api/emergency-response/rescue-teams')
      .send({
        teamCode: 'RESCUE-COV-002',
        name: 'No District Team',
        teamType: 'GENERAL',
      });

    const duplicate = await request(app)
      .post('/api/emergency-response/rescue-teams')
      .send({
        teamCode: 'RESCUE-COV-001',
        name: 'Copy Team',
        district: 'Gampaha',
        teamType: 'GENERAL',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.currentStatus).toBe('AVAILABLE');
    expect(noDistrict.status).toBe(400);
    expect(duplicate.status).toBe(409);
  });

  test('requires eventId on the dashboard', async () => {
    const response = await request(app).get(
      '/api/emergency-response/dashboard'
    );

    expect(response.status).toBe(400);
  });

  test('completes an assignment and records last known location', async () => {
    const event = await createEvent();
    const team = await createTeam();

    const dispatched = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: team._id.toString(),
        incidentDescription: 'Evacuation complete check.',
        affectedLocation: { label: 'River Bank' },
      });

    const response = await request(app)
      .patch(
        `/api/emergency-response/assignments/${dispatched.body.data._id}/status`
      )
      .send({
        status: 'COMPLETED',
        location: { label: 'River Bank exit' },
      });

    const updatedTeam = await RescueTeam.findById(team._id);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('COMPLETED');
    expect(updatedTeam.currentStatus).toBe('AVAILABLE');
    expect(updatedTeam.lastKnownLocation.label).toBe('River Bank exit');
  });

  test('rejects missing teams, assignments and invalid status updates', async () => {
    const event = await createEvent();
    const missingTeam = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: new mongoose.Types.ObjectId().toString(),
        incidentDescription: 'Missing team.',
        affectedLocation: { label: 'Town' },
      });

    const missingAssignment = await request(app)
      .patch(
        `/api/emergency-response/assignments/${new mongoose.Types.ObjectId()}/status`
      )
      .send({ status: 'ON_SCENE' });

    const team = await createTeam();
    const dispatched = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: team._id.toString(),
        incidentDescription: 'Invalid status check.',
        affectedLocation: { label: 'Town' },
      });

    const invalidStatus = await request(app)
      .patch(
        `/api/emergency-response/assignments/${dispatched.body.data._id}/status`
      )
      .send({ status: 'UNKNOWN' });

    expect(missingTeam.status).toBe(404);
    expect(missingAssignment.status).toBe(404);
    expect(invalidStatus.status).toBe(400);
  });

  test('rejects reassignment when the assignment or replacement is invalid', async () => {
    const event = await createEvent();
    const first = await createTeam();
    const busy = await createTeam({ currentStatus: 'UNAVAILABLE' });

    const dispatched = await request(app)
      .post('/api/emergency-response/assignments')
      .send({
        eventId: event._id.toString(),
        teamId: first._id.toString(),
        incidentDescription: 'Reassign checks.',
        affectedLocation: { label: 'Hill Road' },
      });

    const missingAssignment = await request(app)
      .post(
        `/api/emergency-response/assignments/${new mongoose.Types.ObjectId()}/reassign`
      )
      .send({ newTeamId: first._id.toString() });

    const missingTeam = await request(app)
      .post(
        `/api/emergency-response/assignments/${dispatched.body.data._id}/reassign`
      )
      .send({ newTeamId: new mongoose.Types.ObjectId().toString() });

    const unavailable = await request(app)
      .post(
        `/api/emergency-response/assignments/${dispatched.body.data._id}/reassign`
      )
      .send({ newTeamId: busy._id.toString() });

    expect(missingAssignment.status).toBe(404);
    expect(missingTeam.status).toBe(404);
    expect(unavailable.status).toBe(409);
  });

  test('allocates stock to a shelter registered for the event', async () => {
    const event = await createEvent();
    const shelter = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: event._id.toString(),
        name: 'College Shelter',
        district: 'Colombo',
        address: 'College Road',
        capacity: 40,
      });

    const resource = await request(app)
      .post('/api/emergency-response/resources')
      .send({
        organisationName: 'Donor Hub',
        resourceType: 'Rice',
        unit: 'packs',
        availableQuantity: 12,
        district: 'Kandy',
      });

    const response = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'SHELTER',
        shelterId: shelter.body.data._id,
        requestedQuantity: 5,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.distribution.destinationLabel).toBe(
      'College Shelter'
    );
    expect(response.body.data.partialFulfilment).toBe(false);
  });

  test('rejects invalid relief allocations', async () => {
    const event = await createEvent();
    const other = await DisasterEvent.create({
      eventCode: `EV-OTHER-${Date.now()}`,
      name: 'Gampaha Flood',
      district: 'Gampaha',
      hazardType: 'FLOODING',
      startDate: new Date('2026-10-07T00:00:00Z'),
      status: 'ACTIVE',
    });

    const ownShelter = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: event._id.toString(),
        name: 'Own Shelter',
        district: 'Colombo',
        address: 'Own Road',
        capacity: 10,
      });

    const otherShelter = await request(app)
      .post('/api/emergency-response/shelters')
      .send({
        eventId: other._id.toString(),
        name: 'Other Shelter',
        district: 'Gampaha',
        address: 'Town Road',
        capacity: 10,
      });

    const closed = await Shelter.create({
      eventId: event._id,
      name: 'Closed Shelter',
      district: 'Colombo',
      address: 'Shut Road',
      capacity: 8,
      status: 'CLOSED',
    });

    const resource = await request(app)
      .post('/api/emergency-response/resources')
      .send({
        organisationName: 'Stock Yard',
        resourceType: 'Mats',
        unit: 'packs',
        availableQuantity: 4,
        district: 'Colombo',
      });

    const emptyStock = await ReliefResource.create({
      organisationName: 'Empty Yard',
      resourceType: 'Blankets',
      unit: 'packs',
      availableQuantity: 0,
      district: 'Colombo',
    });

    const missingResource = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: new mongoose.Types.ObjectId().toString(),
        destinationType: 'AFFECTED_LOCATION',
        destinationLabel: 'Town',
        requestedQuantity: 1,
      });

    const missingShelter = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'SHELTER',
        shelterId: new mongoose.Types.ObjectId().toString(),
        requestedQuantity: 1,
      });

    const otherEventShelter = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'SHELTER',
        shelterId: otherShelter.body.data._id,
        requestedQuantity: 1,
      });

    const closedShelter = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'SHELTER',
        shelterId: closed._id.toString(),
        requestedQuantity: 1,
      });

    const badType = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'WAREHOUSE',
        destinationLabel: 'Yard',
        requestedQuantity: 1,
      });

    const noLabel = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'AFFECTED_LOCATION',
        requestedQuantity: 1,
      });

    const badQty = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: resource.body.data._id,
        destinationType: 'AFFECTED_LOCATION',
        destinationLabel: 'Town',
        requestedQuantity: 0,
      });

    const empty = await request(app)
      .post('/api/emergency-response/distributions')
      .send({
        eventId: event._id.toString(),
        resourceId: emptyStock._id.toString(),
        destinationType: 'AFFECTED_LOCATION',
        destinationLabel: 'Town',
        requestedQuantity: 2,
      });

    expect(ownShelter.status).toBe(201);
    expect(missingResource.status).toBe(404);
    expect(missingShelter.status).toBe(404);
    expect(otherEventShelter.status).toBe(400);
    expect(closedShelter.status).toBe(400);
    expect(badType.status).toBe(400);
    expect(noLabel.status).toBe(400);
    expect(badQty.status).toBe(400);
    expect(empty.status).toBe(409);
  });

  test('uses a medical team from another district when none are local', async () => {
    const event = await DisasterEvent.create({
      eventCode: `EV-MED-${Date.now()}`,
      name: 'Gampaha Flood',
      district: 'Gampaha',
      hazardType: 'FLOODING',
      startDate: new Date('2026-10-07T00:00:00Z'),
      status: 'ACTIVE',
    });

    await createTeam({
      teamType: 'MEDICAL',
      district: 'Colombo',
      name: 'Visiting Medical',
    });

    const response = await request(app)
      .post('/api/emergency-response/medical-evacuation')
      .send({
        eventId: event._id.toString(),
        affectedLocation: { label: 'Gampaha Town' },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.escalated).toBe(false);
  });
});
