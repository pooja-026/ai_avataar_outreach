# AI Avatar Outreach Platform — Development Plan

## Repository assessment

This repository is currently empty. There is no application framework, frontend or backend code, database, ORM, authentication, environment configuration, API route, dependency manifest, avatar integration, email integration, or session implementation to assess or reuse.

The first implementation decision—choosing and scaffolding the application foundation—therefore belongs to Phase 0. The proposed default is a TypeScript full-stack web application using Next.js (App Router), PostgreSQL, and Prisma. This is a recommendation, not a change made in this phase.

## Proposed architecture

- **Web application:** Next.js with TypeScript. Admin pages and recipient avatar pages are rendered by the same application, with server-side API route handlers for privileged operations.
- **Database:** PostgreSQL, accessed through Prisma. Database records represent campaigns, recipients, recipient links, avatar configurations, sessions, and messages.
- **Context boundaries:** Campaign content is stored with a campaign; recipient-specific data is stored with a recipient/campaign-recipient record; each live or historical conversation gets its own avatar session and messages.
- **Recipient links:** A cryptographically random, non-guessable token maps to one campaign-recipient invitation. Tokens are validated server-side, can expire or be revoked, and do not expose database IDs.
- **Avatar provider boundary:** Browser code requests a short-lived session credential from an authenticated/validated server endpoint. The server holds `ANAM_API_KEY`; it is never shipped to the client.
- **Email boundary:** An email provider is called only from server-side code. Delivery attempts and provider message IDs are recorded for tracking and retries.
- **Concurrency:** Each avatar session has its own ID and provider session/token. Conversation writes are scoped to that session, so one recipient cannot read or influence another recipient’s context.
- **Secrets:** Environment variables hold database and provider credentials. Secrets are excluded from version control; only a documented `.env.example` is committed.

## Phased delivery plan

### Phase 0 — Repository/Foundation

- **Goal:** Establish a maintainable, locally runnable application foundation.
- **What we will build:** Select the stack, scaffold the application, add TypeScript/linting/formatting conventions, environment-variable validation, base layout, and developer documentation.
- **Files likely to change:** `package.json`, application source directories, TypeScript/framework configuration, `.gitignore`, `.env.example`, `README.md`.
- **Dependencies:** Node.js, package manager, chosen web framework.
- **API endpoints involved:** Health/status endpoint only, if useful.
- **Database entities involved:** None.
- **How we will test it:** Install dependencies, run lint/type checks, start the app, and verify a base page/health response.
- **Definition of Done:** A documented app starts locally with no secrets committed and baseline checks pass.

### Phase 1 — Database schema

- **Goal:** Model durable outreach and conversation data without implementing product workflows yet.
- **What we will build:** PostgreSQL/Prisma configuration and an initial schema for `Campaign`, `Recipient`, `CampaignRecipient`, `AvatarConfiguration`, `RecipientLink`, `AvatarSession`, and `ConversationMessage`.
- **Files likely to change:** Prisma schema/migrations, database client, `.env.example`, schema documentation, tests.
- **Dependencies:** Phase 0; PostgreSQL; Prisma (or the approved ORM).
- **API endpoints involved:** None required; an internal database connectivity check may be added.
- **Database entities involved:** All entities listed above, with foreign keys and indexes for tokens and session lookups.
- **How we will test it:** Apply migration to a local test database, run schema validation, and create/read isolated fixture records.
- **Definition of Done:** Migration applies cleanly and the schema enforces campaign, recipient, link, session, and message relationships.

### Phase 2 — Admin dashboard UI

- **Goal:** Provide a safe shell for future sender/admin workflows.
- **What we will build:** Dashboard navigation, empty-state views, shared form/table components, and responsive visual foundations.
- **Files likely to change:** Admin routes/pages, components, styles, layout, UI tests.
- **Dependencies:** Phase 0; authentication may be deferred behind a temporary development-only access boundary.
- **API endpoints involved:** Optional dashboard summary endpoint.
- **Database entities involved:** Campaign and recipient counts, read-only.
- **How we will test it:** Component tests and browser smoke tests for desktop/mobile layouts and empty states.
- **Definition of Done:** An admin can navigate clear placeholder areas for campaigns, recipients, and avatar configurations.

### Phase 3 — Campaign creation

- **Goal:** Let an admin create and manage message campaigns.
- **What we will build:** Campaign list, create/edit form, validation, draft status, and campaign detail page.
- **Files likely to change:** Campaign pages/components, validation schemas, server actions or route handlers, tests.
- **Dependencies:** Phases 1–2.
- **API endpoints involved:** `GET /api/campaigns`, `POST /api/campaigns`, `GET/PATCH /api/campaigns/:id`.
- **Database entities involved:** `Campaign`, optionally `AvatarConfiguration` association.
- **How we will test it:** Form validation, create/edit integration tests, and database assertions.
- **Definition of Done:** A valid draft campaign can be created, edited, listed, and retrieved without exposing data across campaigns.

### Phase 4 — Recipient management

- **Goal:** Add individual recipients and their optional context to campaigns.
- **What we will build:** Recipient CRUD, campaign recipient assignment, duplicate-email behavior, and contextual fields.
- **Files likely to change:** Recipient pages/components, validation, route handlers, tests.
- **Dependencies:** Phases 1–3.
- **API endpoints involved:** `GET/POST /api/recipients`, `GET/PATCH/DELETE /api/recipients/:id`, `POST /api/campaigns/:id/recipients`.
- **Database entities involved:** `Recipient`, `CampaignRecipient`, `Campaign`.
- **How we will test it:** Create/update/remove recipient assignments; verify context stays scoped to the intended campaign recipient.
- **Definition of Done:** An admin can manage recipients and attach them to a campaign with independently stored context.

### Phase 5 — Unique recipient links

- **Goal:** Create secure, recipient-specific entry points for campaigns.
- **What we will build:** Token generation, expiration/revocation policy, invitation status, and a token-resolution recipient page without avatar functionality.
- **Files likely to change:** Token service, recipient route/page, campaign recipient controls, tests.
- **Dependencies:** Phases 1, 3, and 4.
- **API endpoints involved:** `POST /api/campaigns/:id/links`, `POST /api/links/:id/revoke`, `GET /r/:token`.
- **Database entities involved:** `RecipientLink`, `CampaignRecipient`, `Campaign`.
- **How we will test it:** Ensure generated tokens are unique/non-sequential; valid, expired, revoked, and malformed token cases are handled correctly.
- **Definition of Done:** A valid link identifies exactly one campaign-recipient and invalid links reveal no sensitive information.

### Phase 6 — Email sending

- **Goal:** Deliver campaign messages with recipient-specific links.
- **What we will build:** Server-side email provider adapter, preview mode, delivery status records, and send controls with safeguards against accidental duplicate sends.
- **Files likely to change:** Email service/templates, server route handlers, delivery UI, environment docs, tests.
- **Dependencies:** Phase 5; an approved email provider account and credentials.
- **API endpoints involved:** `POST /api/campaigns/:id/send`, `GET /api/campaigns/:id/deliveries`, provider webhook endpoint when selected.
- **Database entities involved:** `RecipientLink`, `CampaignRecipient`, plus `EmailDelivery` if introduced.
- **How we will test it:** Provider sandbox/test mode, rendered-email snapshot, and link personalization checks.
- **Definition of Done:** A controlled test campaign sends correctly personalized emails and records outcome without browser-side provider secrets.

### Phase 7 — Recipient avatar page

- **Goal:** Provide a polished, token-gated landing page before live avatar connectivity.
- **What we will build:** Recipient greeting, campaign message, consent/privacy copy, loading/error states, and an avatar conversation container.
- **Files likely to change:** Public recipient route, components/styles, token validation service, tests.
- **Dependencies:** Phase 5.
- **API endpoints involved:** `GET /r/:token`, read-only invitation metadata endpoint if needed.
- **Database entities involved:** `RecipientLink`, `CampaignRecipient`, `Campaign`, `Recipient`.
- **How we will test it:** Valid-link personalization, inaccessible invalid links, responsive/browser smoke tests.
- **Definition of Done:** A recipient can open a unique link and see only their intended campaign experience.

### Phase 8 — Secure Anam server-side session/token generation

- **Goal:** Establish a secure server-only Anam integration boundary.
- **What we will build:** Anam provider client, validated server endpoint that creates/obtains short-lived client session credentials, configuration validation, and error handling.
- **Files likely to change:** Anam server service, session route handler, environment docs, tests.
- **Dependencies:** Phases 5 and 7; Anam account, approved API documentation, `ANAM_API_KEY` in server environment.
- **API endpoints involved:** `POST /api/recipient-links/:token/avatar-session` (or equivalent validated route).
- **Database entities involved:** `AvatarConfiguration`, `RecipientLink`, `AvatarSession` (initial creation).
- **How we will test it:** Mocked provider tests plus sandbox integration test; inspect client build to ensure no `ANAM_API_KEY` exposure.
- **Definition of Done:** A validated recipient can receive only a short-lived session credential; the Anam API key remains server-side.

### Phase 9 — Real-time Anam avatar

- **Goal:** Connect the recipient UI to a real-time Anam avatar.
- **What we will build:** Client integration, microphone/camera permission handling as applicable, connection lifecycle, retry/error UI, and disconnect control.
- **Files likely to change:** Avatar client component, recipient page, Anam adapter, tests.
- **Dependencies:** Phase 8; supported Anam client SDK/package if required.
- **API endpoints involved:** Phase 8 session endpoint; optional session-status endpoint.
- **Database entities involved:** `AvatarSession`, `AvatarConfiguration`.
- **How we will test it:** Provider sandbox/manual browser test, mocked lifecycle tests, permission-denied/disconnected states.
- **Definition of Done:** A recipient with a valid link can start and end a live avatar interaction without sharing provider credentials.

### Phase 10 — Per-recipient conversation context

- **Goal:** Supply the avatar with the intended campaign and recipient context, isolated per session.
- **What we will build:** Context assembly service that combines approved campaign content and recipient-specific fields; minimal-data rules and provider payload mapping.
- **Files likely to change:** Context service, Anam session service, schema/validation, tests.
- **Dependencies:** Phases 4, 8, and 9.
- **API endpoints involved:** Existing avatar-session creation endpoint.
- **Database entities involved:** `Campaign`, `Recipient`, `CampaignRecipient`, `AvatarSession`, `AvatarConfiguration`.
- **How we will test it:** Fixture tests verify one recipient/session never receives another recipient’s data; integration test validates payload formation.
- **Definition of Done:** Avatar initialization uses only its own campaign-recipient context and an auditable context contract.

### Phase 11 — Session persistence/history

- **Goal:** Preserve session metadata and conversation messages for authorized review.
- **What we will build:** Message ingestion/persistence strategy, session states/timestamps, admin session history UI, and retention/deletion policy.
- **Files likely to change:** Session/message services, webhook or client event handling, admin history pages, migrations, tests.
- **Dependencies:** Phases 1 and 9; provider event/transcript capabilities determined.
- **API endpoints involved:** `POST /api/avatar-sessions/:id/events`, `GET /api/avatar-sessions/:id`, `GET /api/campaigns/:id/sessions`.
- **Database entities involved:** `AvatarSession`, `ConversationMessage`, `CampaignRecipient`.
- **How we will test it:** Persist ordered messages, authorize access, and confirm session records never mix transcripts.
- **Definition of Done:** Sessions and messages are reliably recorded, scoped, viewable by authorized admins, and governed by retention rules.

### Phase 12 — Concurrent sessions

- **Goal:** Validate that shared avatars safely support simultaneous recipient conversations.
- **What we will build:** Idempotent session-creation semantics, connection/session limits, concurrency tests, and operational metrics for active sessions.
- **Files likely to change:** Session service, database constraints/indexes, load-test scripts, monitoring hooks, tests.
- **Dependencies:** Phases 8–11; confirmed Anam concurrency limits.
- **API endpoints involved:** Avatar-session creation and status endpoints.
- **Database entities involved:** `AvatarSession`, `RecipientLink`, `AvatarConfiguration`.
- **How we will test it:** Parallel test users start sessions using the same avatar configuration; assert distinct session/provider IDs and isolated messages.
- **Definition of Done:** Concurrent recipients reliably receive separate sessions and no shared context is observed.

### Phase 13 — Real-time context engine

- **Goal:** Safely incorporate approved dynamic context during conversations.
- **What we will build:** Context-source abstraction, explicit allowlists, refresh rules, provenance/audit data, and failure fallbacks.
- **Files likely to change:** Context-engine services, provider adapter, settings UI, tests.
- **Dependencies:** Phases 10–12; defined external data sources and privacy policy.
- **API endpoints involved:** Context refresh/tool endpoints as needed, always server-side.
- **Database entities involved:** `AvatarSession`, context audit/configuration entities if introduced.
- **How we will test it:** Unit tests for source access/allowlists and integration tests for a session-specific context update.
- **Definition of Done:** Dynamic context is constrained, auditable, resilient to failures, and cannot cross recipient boundaries.

### Phase 14 — Analytics

- **Goal:** Measure campaign delivery and recipient engagement while respecting privacy.
- **What we will build:** Event model, aggregate dashboard metrics, link-open/session engagement tracking, and export/read controls.
- **Files likely to change:** Analytics services/routes, dashboard charts/tables, migrations, tests.
- **Dependencies:** Phases 6, 9, and 11; privacy/retention decisions.
- **API endpoints involved:** `GET /api/campaigns/:id/analytics`, event collection endpoints/webhooks.
- **Database entities involved:** `EmailDelivery`, `RecipientLink`, `AvatarSession`, analytics event/aggregate entities.
- **How we will test it:** Fixture event aggregation, authorization tests, and data minimization checks.
- **Definition of Done:** Admins can view accurate campaign-level delivery and engagement metrics without exposing unrelated recipient data.

### Phase 15 — CSV/bulk campaigns

- **Goal:** Efficiently create and send to larger recipient lists.
- **What we will build:** CSV template/download, parsing/validation preview, error reporting, deduplication choices, and bulk campaign workflow.
- **Files likely to change:** Upload UI, CSV parsing service, background-job integration if selected, tests.
- **Dependencies:** Phases 4 and 6; agreed file-size and throughput limits.
- **API endpoints involved:** `POST /api/campaigns/:id/recipients/import`, `POST /api/campaigns/:id/send`.
- **Database entities involved:** `Recipient`, `CampaignRecipient`, `RecipientLink`, `EmailDelivery`.
- **How we will test it:** Valid/malformed CSV fixtures, duplicate handling, dry runs, and a provider sandbox bulk test.
- **Definition of Done:** An admin can preview, correct, import, and safely send a validated recipient batch.

### Phase 16 — Security, rate limiting, production hardening

- **Goal:** Protect recipient data, provider usage, and public endpoints in production.
- **What we will build:** Authentication/authorization completion, rate limits, CSRF/origin protections where applicable, audit logs, secret rotation guidance, validation, observability, backups, and incident/runbook documentation.
- **Files likely to change:** Auth middleware/configuration, security services, deployment configuration, documentation, tests.
- **Dependencies:** All earlier workflows; hosting/security policy decisions.
- **API endpoints involved:** All authenticated/admin and public token/session endpoints.
- **Database entities involved:** User/account/audit/rate-limit entities as selected, plus all protected existing entities.
- **How we will test it:** Security review, authorization matrix tests, rate-limit tests, dependency audit, and staged penetration checks.
- **Definition of Done:** Production controls are documented, automated tests cover critical boundaries, and secrets/tokens/session data are protected.

### Phase 17 — Deployment

- **Goal:** Release a repeatable, monitored production deployment.
- **What we will build:** Hosting configuration, managed PostgreSQL, migrations workflow, environment setup, CI/CD, monitoring/alerts, backup verification, and release checklist.
- **Files likely to change:** CI workflows, Docker/hosting configuration, infrastructure documentation, environment templates, runbooks.
- **Dependencies:** Phase 16; chosen hosting, domain, email sender domain, and provider production credentials.
- **API endpoints involved:** All production endpoints; health/readiness checks.
- **Database entities involved:** Existing schema and migration history.
- **How we will test it:** Staging deployment, migration rehearsal, smoke tests, rollback drill, and production-readiness checklist.
- **Definition of Done:** The application deploys reproducibly, is monitored, backs up data, and has an owner-approved rollback/recovery process.

## Cross-phase decisions to confirm before implementation

1. The selected web stack (the default proposal is Next.js + TypeScript + PostgreSQL + Prisma).
2. Authentication provider and roles for the administrative dashboard.
3. Email provider, sending domain, and consent/compliance requirements.
4. Anam API/session model, avatar configuration model, transcript availability, and concurrency limits.
5. Recipient-data retention, deletion, and privacy policy requirements.
6. Hosting, production region, expected scale, and budget constraints.
