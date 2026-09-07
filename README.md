# AI Avatar Outreach Platform

This is the Phase 0 foundation for a secure, campaign-based AI avatar outreach application.

## Stack

- Next.js (App Router) and React
- TypeScript
- Tailwind CSS
- ESLint

## Local development

1. Copy `.env.example` to `.env.local` when local configuration is introduced.
2. Run `npm run dev`.
3. Open `http://localhost:3000`.

## Checks

- `npm run lint`
- `npm run build`

## Scope

No database, authentication, email delivery, Anam integration, or recipient/session workflow is implemented yet. The phased implementation plan is in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Secret handling

Use `.env.local` for local secrets. Never commit credentials or expose server-side provider keys to browser code.
