import {
  useEffect,
  useState,
} from 'react';

import {
  allocateReliefResource,
  createRescueTeam,
  createShelter,
  dispatchRescueTeam,
  getEmergencyDashboard,
  reassignRescueTeam,
  registerReliefResource,
  requestMedicalEvacuation,
  updateAssignmentStatus,
  updateShelterOccupancy,
} from '../services/emergencyResponseService';

import {
  createDisasterEvent,
  listDisasterEvents,
} from '../services/disasterEventService';

import '../styles/EmergencyResponse.css';

function cleanDistrict(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export default function EmergencyResponsePage() {
  const [
    eventId,
    setEventId,
  ] =
    useState('');

  const [
    activeEvents,
    setActiveEvents,
  ] =
    useState([]);

  const [
    inactivityMinutes,
    setInactivityMinutes,
  ] =
    useState('');

  const [
    eventForm,
    setEventForm,
  ] =
    useState({
      name:
        '',
      district:
        '',
      hazardType:
        'FLOODING',
      startDate:
        '2026-10-07',
    });

  const [
    teamForm,
    setTeamForm,
  ] =
    useState({
      teamCode:
        '',
      name:
        '',
      district:
        '',
      teamType:
        '',
    });

  const [
    dashboard,
    setDashboard,
  ] =
    useState(null);

  const [
    replacementTeamIds,
    setReplacementTeamIds,
  ] =
    useState({});

  const [
    medicalForm,
    setMedicalForm,
  ] =
    useState({
      district:
        '',
      location:
        '',
    });

  const [
    occupancyDrafts,
    setOccupancyDrafts,
  ] =
    useState({});

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  const selectedEvent =
    activeEvents.find(
      (item) =>
        item._id ===
        eventId
    );

  const eventDistrict =
    selectedEvent?.district ||
    '';

  const [
    shelterForm,
    setShelterForm,
  ] =
    useState({
      name:
        '',
      district:
        '',
      address:
        '',
      capacity:
        '',
      currentOccupancy:
        '',
    });

  const [
    dispatchForm,
    setDispatchForm,
  ] =
    useState({
      teamId:
        '',
      incidentDescription:
        '',
      locationLabel:
        '',
    });

  const [
    resourceForm,
    setResourceForm,
  ] =
    useState({
      organisationName:
        '',
      resourceType:
        '',
      unit:
        '',
      availableQuantity:
        '',
      district:
        '',
    });

  const [
    allocationForm,
    setAllocationForm,
  ] =
    useState({
      resourceId:
        '',
      destinationType:
        'AFFECTED_LOCATION',
      shelterId:
        '',
      destinationLabel:
        '',
      requestedQuantity:
        '',
      district:
        '',
    });

  async function loadActiveEvents() {
    const response =
      await listDisasterEvents(
        'ACTIVE'
      );

    setActiveEvents(
      response.data ||
        []
    );
  }

  useEffect(() => {
    loadActiveEvents().catch(
      () => {
        // Event list is optional until the API is reachable.
      }
    );
  }, []);

  useEffect(() => {
    if (!eventId) {
      return undefined;
    }

    setError('');

    let cancelled =
      false;

    function loadDashboard() {
      getEmergencyDashboard(
        eventId,
        Number(
          inactivityMinutes
        ) || 30
      )
        .then(
          (
            response
          ) => {
            if (
              !cancelled
            ) {
              setDashboard(
                response.data
              );
            }
          }
        )
        .catch(
          () => {
            // Keep the last known dashboard visible.
          }
        );
    }

    loadDashboard();

    const timer =
      window.setInterval(
        loadDashboard,
        10000
      );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        timer
      );
    };
  }, [
    eventId,
    inactivityMinutes,
  ]);

  async function refresh() {
    if (!eventId) {
      setError(
        'Select an active event first.'
      );
      setMessage('');
      return false;
    }

    try {
      const response =
        await getEmergencyDashboard(
          eventId,
          Number(
            inactivityMinutes
          ) || 30
        );

      setDashboard(
        response.data
      );

      setError('');
      return true;
    } catch (
      loadError
    ) {
      setError(
        loadError.response?.data
          ?.message ||
          loadError.message
      );
      setMessage('');
      return false;
    }
  }

  function showSuccess(
    text
  ) {
    setMessage(text);
    setError('');

    if (eventId) {
      refresh();
    }
  }

  function showError(
    requestError
  ) {
    setError(
      requestError.response
        ?.data?.message ||
        requestError.message
    );
    setMessage('');
  }

  async function submitEvent(
    event
  ) {
    event.preventDefault();

    const district =
      cleanDistrict(
        eventForm.district
      );

    if (!district) {
      setError(
        'Enter the district.'
      );
      setMessage('');
      return;
    }

    try {
      const response =
        await createDisasterEvent(
          {
            name:
              eventForm.name,
            district,
            hazardType:
              eventForm.hazardType,
            startDate:
              new Date(
                eventForm.startDate
              ).toISOString(),
            status:
              'ACTIVE',
          }
        );

      const createdId =
        response.data._id;

      setEventId(
        createdId
      );

      await loadActiveEvents();

      const dashboardResponse =
        await getEmergencyDashboard(
          createdId,
          Number(
            inactivityMinutes
          ) || 30
        );

      setDashboard(
        dashboardResponse.data
      );

      setEventForm({
        name:
          '',
        district:
          '',
        hazardType:
          'FLOODING',
        startDate:
          eventForm.startDate,
      });

      setMessage(
        `Active disaster event created. Event code: ${response.data.eventCode}.`
      );

      setError('');
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  async function submitTeam(
    event
  ) {
    event.preventDefault();

    const teamDistrict =
      cleanDistrict(
        teamForm.district
      );

    if (!teamDistrict) {
      setError(
        'Enter the team district.'
      );
      setMessage('');
      return;
    }

    try {
      const response =
        await createRescueTeam(
          {
            ...teamForm,
            district:
              teamDistrict,
          }
        );

      setDispatchForm(
        (
          current
        ) => ({
          ...current,
          teamId:
            response.data
              ._id,
        })
      );

      setTeamForm({
        teamCode:
          '',
        name:
          '',
        district:
          '',
        teamType:
          '',
      });

      showSuccess(
        'Rescue team registered.'
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  function availableReplacementTeams(
    assignment
  ) {
    return (
      dashboard?.availableTeams ||
      dashboard?.teams ||
      []
    ).filter(
      (
        team
      ) =>
        team.currentStatus ===
          'AVAILABLE' &&
        team._id !==
          (
            assignment.teamId
              ?._id ||
            assignment.teamId
          ) &&
        (
          !assignment.teamId
            ?.teamType ||
          team.teamType ===
            assignment.teamId
              .teamType
        )
    );
  }

  async function reassignPrompt(
    assignment
  ) {
    const newTeamId =
      replacementTeamIds[
        assignment._id
      ];

    if (
      !newTeamId
    ) {
      setError(
        'Select an available replacement team.'
      );
      setMessage('');
      return;
    }

    try {
      await reassignRescueTeam(
        assignment._id,
        newTeamId
      );

      setReplacementTeamIds(
        (
          current
        ) => ({
          ...current,
          [assignment._id]:
            '',
        })
      );

      showSuccess(
        'Assignment reassigned. Previous assignment history was preserved.'
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  async function submitShelter(
    event
  ) {
    event.preventDefault();

    if (
      !eventId ||
      !eventDistrict
    ) {
      setError(
        'Select an active event first.'
      );
      setMessage('');
      return;
    }

    try {
      await createShelter({
        eventId,
        ...shelterForm,
        district:
          eventDistrict,
        capacity:
          Number(
            shelterForm.capacity
          ),
        currentOccupancy:
          Number(
            shelterForm.currentOccupancy ||
              0
          ),
      });

      setShelterForm({
        name:
          '',
        district:
          '',
        address:
          '',
        capacity:
          '',
        currentOccupancy:
          '',
      });

      showSuccess(
        'Emergency shelter registered.'
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  async function submitDispatch(
    event
  ) {
    event.preventDefault();

    try {
      await dispatchRescueTeam(
        {
          eventId,
          teamId:
            dispatchForm.teamId,
          incidentDescription:
            dispatchForm.incidentDescription,
          affectedLocation:
            {
              label:
                dispatchForm.locationLabel,
            },
        }
      );

      setDispatchForm({
        teamId:
          '',
        incidentDescription:
          '',
        locationLabel:
          '',
      });

      showSuccess(
        'Rescue team dispatched.'
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  async function submitResource(
    event
  ) {
    event.preventDefault();

    const stockDistrict =
      cleanDistrict(
        resourceForm.district
      );

    if (!stockDistrict) {
      setError(
        'Enter the stock origin district.'
      );
      setMessage('');
      return;
    }

    try {
      await registerReliefResource(
        {
          ...resourceForm,
          district:
            stockDistrict,
          availableQuantity:
            Number(
              resourceForm.availableQuantity
            ),
          ...(eventId
            ? { eventId }
            : {}),
        }
      );

      setResourceForm({
        organisationName:
          '',
        resourceType:
          '',
        unit:
          '',
        availableQuantity:
          '',
        district:
          '',
      });

      showSuccess(
        'Relief stock registered.'
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  async function submitAllocation(
    event
  ) {
    event.preventDefault();

    if (
      !eventId ||
      !eventDistrict
    ) {
      setError(
        'Select an active event first.'
      );
      setMessage('');
      return;
    }

    try {
      const response =
        await allocateReliefResource(
          {
            eventId,
            ...allocationForm,
            district:
              eventDistrict,
            requestedQuantity:
              Number(
                allocationForm.requestedQuantity
              ),
          }
        );

      setAllocationForm({
        resourceId:
          '',
        destinationType:
          'AFFECTED_LOCATION',
        shelterId:
          '',
        destinationLabel:
          '',
        requestedQuantity:
          '',
        district:
          '',
      });

      showSuccess(
        response.message
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  async function submitOccupancy(
    shelter
  ) {
    const next =
      occupancyDrafts[
        shelter._id
      ] ??
      shelter.currentOccupancy;

    try {
      const result =
        await updateShelterOccupancy(
          shelter._id,
          Number(next)
        );

      setOccupancyDrafts(
        (
          current
        ) => {
          const updated =
            {
              ...current,
            };

          delete updated[
            shelter._id
          ];

          return updated;
        }
      );

      showSuccess(
        result.message ||
          'Shelter occupancy updated.'
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  async function medicalEvacuation(
    event
  ) {
    event.preventDefault();

    if (
      !eventId ||
      !eventDistrict
    ) {
      setError(
        'Select an active event first.'
      );
      setMessage('');
      return;
    }

    try {
      const response =
        await requestMedicalEvacuation(
          {
            eventId,
            district:
              eventDistrict,
            affectedLocation:
              {
                label:
                  medicalForm.location,
              },
          }
        );

      setMedicalForm({
        district:
          '',
        location:
          '',
      });

      showSuccess(
        response.data
          .escalated
          ? 'No local medical team. Request escalated to DMC HQ / external agency.'
          : 'Medical rescue team dispatched.'
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }
  async function assignmentUpdate(
    assignment,
    status
  ) {
    try {
      await updateAssignmentStatus(
        assignment._id,
        {
          status,
        }
      );

      showSuccess(
        `Assignment updated to ${status}.`
      );
    } catch (
      requestError
    ) {
      showError(
        requestError
      );
    }
  }

  return (
    <main className="response-page">
      <header className="response-hero">
        <p className="response-eyebrow">
          District Operations
        </p>

        <h1>
          Coordinate Emergency
          Response &amp;
          Resource Deployment
        </h1>

        <p>
          Manage shelters,
          rescue-team
          assignments,
          timestamped field
          status and relief
          allocation from one
          event-scoped
          dashboard.
        </p>

        <div className="event-selector">
          <label className="event-field">
            <span>
              Active event
            </span>

            <select
              value={
                activeEvents.some(
                  (
                    item
                  ) =>
                    item._id ===
                    eventId
                )
                  ? eventId
                  : ''
              }
              onChange={(
                event
              ) =>
                setEventId(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                Select an active event
              </option>

              {
                activeEvents.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item._id
                      }
                      value={
                        item._id
                      }
                    >
                      {
                        item.eventCode
                      }
                      {' — '}
                      {
                        item.name
                      }
                    </option>
                  )
                )
              }
            </select>
          </label>

          <label className="event-field">
            <span>
              Event ID
            </span>

            <input
              value={
                eventId
              }
              onChange={(
                event
              ) =>
                setEventId(
                  event.target
                    .value
                )
              }
              placeholder="Created automatically"
            />
          </label>

          <label className="event-field">
            <span>
              Inactivity minutes
            </span>

            <input
              type="number"
              min="1"
              placeholder="Inactivity minutes"
              value={
                inactivityMinutes
              }
              onChange={(
                event
              ) =>
                setInactivityMinutes(
                  event.target
                    .value
                )
              }
            />
          </label>

          <button
            type="button"
            onClick={
              refresh
            }
          >
            Load response
            dashboard
          </button>

          <button
            type="button"
            className="urgent-button"
            onClick={() => {
              document
                .getElementById(
                  'medical-evacuation'
                )
                ?.scrollIntoView(
                  {
                    behavior:
                      'smooth',
                    block:
                      'center',
                  }
                );
            }}
          >
            Urgent medical
            evacuation
          </button>
        </div>

        {
          eventDistrict && (
            <p className="event-district-note">
              {`District for this event: ${eventDistrict}. Register and track shelters in this district for this event. Rescue teams and relief stock can come from any district.`}
            </p>
          )
        }

        {
          error && (
            <p className="event-load-note is-error">
              {error}
            </p>
          )
        }
      </header>

      {
        message && (
          <div className="response-message success">
            <p>{message}</p>
            <button
              type="button"
              className="response-message-close"
              aria-label="Close message"
              onClick={() =>
                setMessage('')
              }
            >
              ×
            </button>
          </div>
        )
      }

      {
        error && (
          <div className="response-message error">
            <p>{error}</p>
            <button
              type="button"
              className="response-message-close"
              aria-label="Close message"
              onClick={() =>
                setError('')
              }
            >
              ×
            </button>
          </div>
        )
      }

      <section className="response-form-grid">
        <form
          className="response-card"
          onSubmit={
            submitEvent
          }
        >
          <h2>
            Active disaster
            event
          </h2>

          <p className="event-code-note">
            The event code is
            created automatically
            from the hazard,
            district and year.
          </p>

          <input
            placeholder="Event name"
            required
            value={
              eventForm.name
            }
            onChange={(
              event
            ) =>
              setEventForm(
                {
                  ...eventForm,
                  name:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            placeholder="District"
            required
            value={
              eventForm.district
            }
            onChange={(
              event
            ) =>
              setEventForm(
                {
                  ...eventForm,
                  district:
                    event.target
                      .value,
                }
              )
            }
          />

          <select
            value={
              eventForm.hazardType
            }
            onChange={(
              event
            ) =>
              setEventForm(
                {
                  ...eventForm,
                  hazardType:
                    event.target
                      .value,
                }
              )
            }
          >
            <option value="FLOODING">
              Flooding
            </option>
            <option value="LANDSLIDE">
              Landslide
            </option>
            <option value="BLOCKED_ROAD">
              Blocked road
            </option>
            <option value="CYCLONE">
              Cyclone
            </option>
            <option value="OTHER">
              Other
            </option>
          </select>

          <input
            type="date"
            required
            value={
              eventForm.startDate
            }
            onChange={(
              event
            ) =>
              setEventForm(
                {
                  ...eventForm,
                  startDate:
                    event.target
                      .value,
                }
              )
            }
          />

          <button>
            Create active
            event
          </button>
        </form>

        <form
          className="response-card"
          onSubmit={
            submitTeam
          }
        >
          <h2>
            Register rescue
            team
          </h2>

          <p className="event-code-note">
            Teams are shared emergency resources. Dispatch later links a team to the selected event.
          </p>

          <input
            placeholder="Team code"
            required
            value={
              teamForm.teamCode
            }
            onChange={(
              event
            ) =>
              setTeamForm(
                {
                  ...teamForm,
                  teamCode:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            placeholder="Team name"
            required
            value={
              teamForm.name
            }
            onChange={(
              event
            ) =>
              setTeamForm(
                {
                  ...teamForm,
                  name:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            placeholder="District"
            required
            value={
              teamForm.district
            }
            onChange={(
              event
            ) =>
              setTeamForm(
                {
                  ...teamForm,
                  district:
                    event.target
                      .value,
                }
              )
            }
          />

          <select
            required
            value={
              teamForm.teamType
            }
            onChange={(
              event
            ) =>
              setTeamForm(
                {
                  ...teamForm,
                  teamType:
                    event.target
                      .value,
                }
              )
            }
          >
            <option value="">
              Team type
            </option>
            <option value="GENERAL">
              General rescue
            </option>
            <option value="MEDICAL">
              Medical
            </option>
          </select>

          <button>
            Register team
          </button>
        </form>

        <form
          className="response-card"
          onSubmit={
            submitShelter
          }
        >
          <h2>
            Register and track shelter
          </h2>

          <p className="event-code-note">
            {eventDistrict
              ? `Register a shelter in ${eventDistrict} for this event. Occupancy is tracked only for this event.`
              : 'Select an active event first. The shelter will use that event district.'}
          </p>

          <input
            placeholder="Shelter name"
            required
            value={
              shelterForm.name
            }
            onChange={(
              event
            ) =>
              setShelterForm(
                {
                  ...shelterForm,
                  name:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            placeholder="Address"
            required
            value={
              shelterForm.address
            }
            onChange={(
              event
            ) =>
              setShelterForm(
                {
                  ...shelterForm,
                  address:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            type="number"
            min="1"
            required
            placeholder="Capacity"
            value={
              shelterForm.capacity
            }
            onChange={(
              event
            ) =>
              setShelterForm(
                {
                  ...shelterForm,
                  capacity:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            type="number"
            min="0"
            required
            placeholder="Current occupancy"
            value={
              shelterForm.currentOccupancy
            }
            onChange={(
              event
            ) =>
              setShelterForm(
                {
                  ...shelterForm,
                  currentOccupancy:
                    event.target
                      .value,
                }
              )
            }
          />

          <button>
            Register shelter
          </button>
        </form>

        <form
          className="response-card"
          onSubmit={
            submitDispatch
          }
        >
          <h2>
            Dispatch rescue
            team
          </h2>

          <select
            required
            value={
              dispatchForm.teamId
            }
            onChange={(
              event
            ) =>
              setDispatchForm(
                {
                  ...dispatchForm,
                  teamId:
                    event.target
                      .value,
                }
              )
            }
          >
            <option value="">
              Select an available team
            </option>

            {
              (
                dashboard?.availableTeams ||
                dashboard?.teams ||
                []
              )
                .filter(
                  (
                    team
                  ) =>
                    team.currentStatus ===
                    'AVAILABLE'
                )
                .map(
                  (
                    team
                  ) => (
                    <option
                      key={
                        team._id
                      }
                      value={
                        team._id
                      }
                    >
                      {
                        team.name
                      }
                      {' · '}
                      {
                        team.teamCode
                      }
                      {' · '}
                      {
                        team.teamType
                      }
                      {' · '}
                      {
                        team.district
                      }
                    </option>
                  )
                )
            }
          </select>

          <textarea
            placeholder="Incident description"
            required
            value={
              dispatchForm.incidentDescription
            }
            onChange={(
              event
            ) =>
              setDispatchForm(
                {
                  ...dispatchForm,
                  incidentDescription:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            placeholder="Affected location"
            required
            value={
              dispatchForm.locationLabel
            }
            onChange={(
              event
            ) =>
              setDispatchForm(
                {
                  ...dispatchForm,
                  locationLabel:
                    event.target
                      .value,
                }
              )
            }
          />

          <button>
            Dispatch team
          </button>
        </form>

        <form
          className="response-card"
          onSubmit={
            submitResource
          }
        >
          <h2>
            Register relief
            stock
          </h2>

          <p className="event-code-note">
            Stock can come from any district, NGO, donor or warehouse.
          </p>

          <input
            placeholder="NGO / donor organisation"
            required
            value={
              resourceForm.organisationName
            }
            onChange={(
              event
            ) =>
              setResourceForm(
                {
                  ...resourceForm,
                  organisationName:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            placeholder="Resource type"
            required
            value={
              resourceForm.resourceType
            }
            onChange={(
              event
            ) =>
              setResourceForm(
                {
                  ...resourceForm,
                  resourceType:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            placeholder="Unit"
            required
            value={
              resourceForm.unit
            }
            onChange={(
              event
            ) =>
              setResourceForm(
                {
                  ...resourceForm,
                  unit:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            placeholder="Origin district / warehouse"
            required
            value={
              resourceForm.district
            }
            onChange={(
              event
            ) =>
              setResourceForm(
                {
                  ...resourceForm,
                  district:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            type="number"
            min="0"
            required
            placeholder="Available quantity"
            value={
              resourceForm.availableQuantity
            }
            onChange={(
              event
            ) =>
              setResourceForm(
                {
                  ...resourceForm,
                  availableQuantity:
                    event.target
                      .value,
                }
              )
            }
          />

          <button>
            Register stock
          </button>
        </form>

        <form
          className="response-card"
          onSubmit={
            submitAllocation
          }
        >
          <h2>
            Allocate relief
          </h2>

          <select
            required
            value={
              allocationForm.resourceId
            }
            onChange={(
              event
            ) =>
              setAllocationForm(
                {
                  ...allocationForm,
                  resourceId:
                    event.target
                      .value,
                }
              )
            }
          >
            <option value="">
              Select registered stock
            </option>

            {
              (
                dashboard?.availableResources ||
                dashboard?.resources ||
                []
              ).map(
                (
                  resource
                ) => (
                  <option
                    key={
                      resource._id
                    }
                    value={
                      resource._id
                    }
                  >
                    {
                      resource.resourceType
                    }
                    {' · '}
                    {
                      resource.availableQuantity
                    }
                    {' '}
                    {
                      resource.unit
                    }
                    {' · '}
                    {
                      resource.district
                    }
                  </option>
                )
              )
            }
          </select>

          <select
            value={
              allocationForm.destinationType
            }
            onChange={(
              event
            ) =>
              setAllocationForm(
                {
                  ...allocationForm,
                  destinationType:
                    event.target
                      .value,
                }
              )
            }
          >
            <option value="AFFECTED_LOCATION">
              Affected location
            </option>

            <option value="SHELTER">
              Shelter
            </option>
          </select>

          {
            allocationForm.destinationType ===
            'SHELTER' && (
              <>
              <select
                required
                value={
                  allocationForm.shelterId
                }
                onChange={(
                  event
                ) => {
                  const selectedShelter =
                    (
                      dashboard?.shelters ||
                      []
                    ).find(
                      (
                        shelter
                      ) =>
                        shelter._id ===
                        event.target
                          .value
                    );

                  setAllocationForm(
                    {
                      ...allocationForm,
                      shelterId:
                        event.target
                          .value,
                      destinationLabel:
                        selectedShelter?.name ||
                        allocationForm.destinationLabel,
                    }
                  );
                }}
              >
                <option value="">
                  Select shelter
                </option>

                {
                  (
                    dashboard?.shelters ||
                    []
                  ).map(
                    (
                      shelter
                    ) => (
                      <option
                        key={
                          shelter._id
                        }
                        value={
                          shelter._id
                        }
                      >
                        {
                          shelter.name
                        }
                        {' · '}
                        {
                          shelter.status
                        }
                      </option>
                    )
                  )
                }
              </select>
              </>
            )
          }

          <input
            placeholder="Destination label"
            required={
              allocationForm.destinationType ===
              'AFFECTED_LOCATION'
            }
            value={
              allocationForm.destinationLabel
            }
            onChange={(
              event
            ) =>
              setAllocationForm(
                {
                  ...allocationForm,
                  destinationLabel:
                    event.target
                      .value,
                }
              )
            }
          />

          <input
            type="number"
            min="1"
            required
            placeholder="Requested quantity"
            value={
              allocationForm.requestedQuantity
            }
            onChange={(
              event
            ) =>
              setAllocationForm(
                {
                  ...allocationForm,
                  requestedQuantity:
                    event.target
                      .value,
                }
              )
            }
          />

          <button>
            Allocate stock
          </button>
        </form>

        <form
          id="medical-evacuation"
          className="response-card"
          onSubmit={
            medicalEvacuation
          }
        >
          <h2>
            Urgent medical
            evacuation
          </h2>

          <p className="event-code-note">
            This uses an available MEDICAL team only. General rescue teams are not assigned here.
          </p>

          <input
            placeholder="Affected location"
            required
            value={
              medicalForm.location
            }
            onChange={(
              event
            ) =>
              setMedicalForm(
                {
                  ...medicalForm,
                  location:
                    event.target
                      .value,
                }
              )
            }
          />

          <button
            className="urgent-button"
          >
            Request evacuation
          </button>
        </form>
      </section>

      {
        dashboard && (
          <section
            id="response-dashboard"
            className="response-dashboard"
          >
            <article className="response-card">
              <h2>
                Registered shelters
              </h2>

              {
                dashboard.shelters.map(
                  (
                    shelter
                  ) => (
                    <div
                      className="operation-row"
                      key={
                        shelter._id
                      }
                    >
                      <div>
                        <strong>
                          {
                            shelter.name
                          }
                        </strong>

                        <span>
                          {
                            shelter.currentOccupancy
                          }{' '}
                          /{' '}
                          {
                            shelter.capacity
                          }
                          {' · '}
                          {
                            shelter.district
                          }
                        </span>

                        {
                          (
                            shelter.occupancyHistory ||
                            []
                          )
                            .slice(
                              0,
                              4
                            )
                            .map(
                              (
                                record
                              ) => (
                                <small
                                  key={
                                    record._id
                                  }
                                >
                                  {
                                    record.occupancy
                                  }
                                  /
                                  {
                                    record.capacity
                                  }
                                  {' · '}
                                  {
                                    new Date(
                                      record.recordedAt
                                    ).toLocaleString()
                                  }
                                </small>
                              )
                            )
                        }
                      </div>

                      <span
                        className={`operation-status ${shelter.status.toLowerCase()}`}
                      >
                        {
                          shelter.status
                        }
                      </span>

                      <input
                        type="number"
                        min="0"
                        max={
                          shelter.capacity
                        }
                        aria-label={`Occupancy for ${shelter.name}`}
                        value={
                          occupancyDrafts[
                            shelter._id
                          ] ??
                          shelter.currentOccupancy
                        }
                        onChange={(
                          event
                        ) =>
                          setOccupancyDrafts(
                            (
                              current
                            ) => ({
                              ...current,
                              [shelter._id]:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          submitOccupancy(
                            shelter
                          )
                        }
                      >
                        Update occupancy
                      </button>
                    </div>
                  )
                )
              }
            </article>

            <article className="response-card">
              <h2>
                Rescue
                assignments
              </h2>

              {
                dashboard.assignments.map(
                  (
                    assignment
                  ) => (
                    <div
                      className="operation-row"
                      key={
                        assignment._id
                      }
                    >
                      <div>
                        <strong>
                          {
                            assignment.teamId
                              ?.name ||
                            'Team'
                          }
                        </strong>

                        <span>
                          {
                            assignment.teamId
                              ?.teamCode
                          }
                          {
                            assignment.teamId
                              ?.teamType
                              ? ` · ${assignment.teamId.teamType}`
                              : ''
                          }
                          {
                            assignment.affectedLocation
                              ?.label
                              ? ` · ${assignment.affectedLocation.label}`
                              : ''
                          }
                        </span>

                        <small>
                          Last update:{' '}
                          {
                            new Date(
                              assignment.lastUpdateTime
                            ).toLocaleString()
                          }
                        </small>
                      </div>

                      <span className="operation-status">
                        {
                          assignment.status
                        }
                      </span>

                      {
                        assignment.status ===
                        'EN_ROUTE' && (
                          <button
                            type="button"
                            onClick={() =>
                              assignmentUpdate(
                                assignment,
                                'ON_SCENE'
                              )
                            }
                          >
                            On scene
                          </button>
                        )
                      }

                      {
                        assignment.status ===
                        'ON_SCENE' && (
                          <button
                            type="button"
                            onClick={() =>
                              assignmentUpdate(
                                assignment,
                                'COMPLETED'
                              )
                            }
                          >
                            Complete
                          </button>
                        )
                      }

                      {
                        ![
                          'COMPLETED',
                          'REASSIGNED',
                        ].includes(
                          assignment.status
                        ) && (
                          <>
                            <select
                              aria-label="Replacement team"
                              value={
                                replacementTeamIds[
                                  assignment._id
                                ] ||
                                ''
                              }
                              onChange={(
                                event
                              ) =>
                                setReplacementTeamIds(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [assignment._id]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                            >
                              <option value="">
                                Replacement team
                              </option>

                              {
                                availableReplacementTeams(
                                  assignment
                                ).map(
                                  (
                                    team
                                  ) => (
                                    <option
                                      key={
                                        team._id
                                      }
                                      value={
                                        team._id
                                      }
                                    >
                                      {
                                        team.name
                                      }
                                      {' · '}
                                      {
                                        team.teamCode
                                      }
                                      {
                                        team.teamType
                                          ? ` · ${team.teamType}`
                                          : ''
                                      }
                                    </option>
                                  )
                                )
                              }
                            </select>

                            <button
                              type="button"
                              onClick={() =>
                                reassignPrompt(
                                  assignment
                                )
                              }
                            >
                              Reassign
                            </button>
                          </>
                        )
                      }
                    </div>
                  )
                )
              }
            </article>

            <article className="response-card">
              <h2>
                Rescue teams
              </h2>

              {
                (
                  dashboard.teams ||
                  []
                ).length ===
                  0 && (
                  <p>
                    No rescue teams are assigned to this event.
                  </p>
                )
              }

              {
                (
                  dashboard.teams ||
                  []
                ).map(
                  (
                    team
                  ) => (
                    <div
                      className="operation-row"
                      key={
                        team._id
                      }
                    >
                      <div>
                        <strong>
                          {
                            team.name
                          }
                        </strong>

                        <span>
                          {
                            team.teamCode
                          }
                          {' · '}
                          {
                            team.teamType
                          }
                          {' · '}
                          {
                            team.district
                          }
                        </span>

                        <small>
                          Last update:{' '}
                          {
                            team.lastUpdateTime
                              ? new Date(
                                  team.lastUpdateTime
                                ).toLocaleString()
                              : '—'
                          }
                        </small>
                      </div>

                      <span className="operation-status">
                        {
                          team.currentStatus
                        }
                      </span>
                    </div>
                  )
                )
              }
            </article>

            <article className="response-card">
              <h2>
                Relief inventory
              </h2>

              {
                dashboard.resources.map(
                  (
                    resource
                  ) => (
                    <div
                      className="operation-row"
                      key={
                        resource._id
                      }
                    >
                      <strong>
                        {
                          resource.resourceType
                        }
                      </strong>

                      <span>
                        {
                          resource.availableQuantity
                        }{' '}
                        {
                          resource.unit
                        }
                      </span>
                    </div>
                  )
                )
              }
            </article>

            <article className="response-card">
              <h2>
                Distribution
                history
              </h2>

              {
                dashboard.distributions.map(
                  (
                    distribution
                  ) => (
                    <div
                      className="operation-row"
                      key={
                        distribution._id
                      }
                    >
                      <strong>
                        {
                          distribution.resourceType
                        }
                      </strong>

                      <span>
                        {
                          distribution.allocatedQuantity
                        }{' '}
                        {
                          distribution.unit
                        }{' '}
                        →{' '}
                        {
                          distribution.destinationLabel
                        }
                      </span>

                      {
                        distribution.shortfallQuantity >
                          0 && (
                          <small className="shortfall">
                            Shortfall:{' '}
                            {
                              distribution.shortfallQuantity
                            }
                          </small>
                        )
                      }
                    </div>
                  )
                )
              }
            </article>
          </section>
        )
      }
    </main>
  );
}
