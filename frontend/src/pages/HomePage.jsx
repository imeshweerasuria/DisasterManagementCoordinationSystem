import {
  Link,
} from 'react-router-dom';

import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      <div className="home-shell">
        <header className="home-topbar">
          <div className="home-brand">
            <span
              className="home-brand-mark"
              aria-hidden="true"
            >
              DMC
            </span>

            <div className="home-brand-text">
              <strong>
                Disaster Management
                Coordination System
              </strong>

              <span>
                Citizen Reporting &amp;
                Duty Officer Portal
              </span>
            </div>
          </div>

          <span className="home-badge">
            SE3070 · Assignment 02 ·
            Group 022
          </span>
        </header>

        <section className="home-hero">
          <p className="home-eyebrow">
            Emergency Reporting Platform
          </p>

          <h1>
            Report hazards on the
            ground.
            <br />
            Coordinate the response.
          </h1>

          <p className="home-lead">
            A unified, offline-first
            platform that lets citizens
            submit verified ground-level
            hazard reports — flooding,
            landslides, blocked roads —
            and lets duty officers
            triage, verify and dispatch
            response from a single
            queue.
          </p>

          <div className="home-actions">
            <Link
              to="/report-hazard"
              className="home-cta primary"
            >
              <span
                className="home-cta-icon"
                aria-hidden="true"
              >
                !
              </span>

              <span className="home-cta-text">
                <strong>
                  Submit Ground
                  Hazard Report
                </strong>

                <small>
                  Citizen flow · GPS ·
                  media · offline sync
                </small>
              </span>

              <span
                className="home-cta-arrow"
                aria-hidden="true"
              >
                →
              </span>
            </Link>

            <Link
              to="/duty-officer/reports"
              className="home-cta secondary"
            >
              <span
                className="home-cta-icon"
                aria-hidden="true"
              >
                ⌘
              </span>

              <span className="home-cta-text">
                <strong>
                  Duty Officer Queue
                </strong>

                <small>
                  Verify · triage ·
                  dispatch reports
                </small>
              </span>

              <span
                className="home-cta-arrow"
                aria-hidden="true"
              >
                →
              </span>
            </Link>
          </div>

          <ul className="home-features">
            <li>
              <span className="home-feature-dot" />
              Offline-first reporting
            </li>

            <li>
              <span className="home-feature-dot" />
              GPS &amp; manual location
            </li>

            <li>
              <span className="home-feature-dot" />
              Photo &amp; video evidence
            </li>

            <li>
              <span className="home-feature-dot" />
              Auto sync on reconnect
            </li>
          </ul>
        </section>

        <section
          className="home-status-strip"
          aria-label="System capabilities"
        >
          <div className="home-status-item">
            <span className="home-status-label">
              Pipeline
            </span>

            <strong>
              Details → Location →
              Evidence → Review
            </strong>
          </div>

          <div className="home-status-item">
            <span className="home-status-label">
              Connectivity
            </span>

            <strong>
              Online &amp; Pending Sync
              supported
            </strong>
          </div>

          <div className="home-status-item">
            <span className="home-status-label">
              Stack
            </span>

            <strong>
              MERN · React · Node ·
              MongoDB
            </strong>
          </div>
        </section>

        <footer className="home-footer">
          <span>
            SE3070 — Assignment 02
            Implementation
          </span>

          <span>
            Group 022 · MERN Stack
          </span>
        </footer>
      </div>
    </div>
  );
}