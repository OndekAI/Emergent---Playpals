# PlayPals PRD / Build Handoff

## Original Problem Statement
Build PlayPals, a mobile-first PWA for trusted school/community playdate coordination for parents of children aged 3–10. Positioning: “Airbnb meets Peanut with soft family-friendly warmth.” Tagline: “Playdates, sorted.” Hero copy: “Less organizing. More playing.”

## Architecture Decisions
- Frontend: React + Tailwind/CSS mobile-first PWA with install manifest and service worker.
- Backend: FastAPI with MongoDB using existing environment for lowest setup and cost.
- Auth: Emergent Google OAuth plus passwordless magic link flow.
- Email: Resend transactional email integration.
- Community duplicate checking: smart local matching, per user choice.

## User Personas
- School Gate Mom: needs playdates in 3 taps or less.
- New Family: needs trusted community entry and first playdate quickly.
- Community Builder: creates and grows school communities.
- Busy Dad: relies on recurring availability and auto-match nudges.

## Core Requirements
- Mobile-first PWA called PlayPals.
- Login screen matching requested warm minimal reference view.
- Child profile creation and editing.
- Availability calendar with month/week/day views, day sheet, recurring weekly availability, and dots.
- Community create/join, sponsor/school verification flow, duplicate checks.
- Playdate proposal, acceptance, cancellation, completion, credits, and contextual chat.
- Profile with Animal Pack tier and notification settings.

## Implemented
- 2026-06-04: Built PlayPals PWA shell, auth, dashboard, playdates calendar, community feed, proposals, profile, child profiles, chat, and PWA metadata.
- 2026-06-04: Updated login screen to closely duplicate provided PlayPals reference screenshot.
- 2026-06-04: Added child profile editing after creation.
- 2026-06-04: Diagnosed Resend magic-link delivery issue: Resend test mode only allows sending to account owner email until a sender domain is verified.

## Current Known Issue
- Magic links are generated correctly, but Resend blocks delivery to non-owner recipient emails in test mode. Current Resend message: only testing emails to the account owner are allowed until domain verification.

## Prioritized Backlog
### P0
- Verify Resend sender/domain or test with the allowed owner email.
- Complete full browser flow test across onboarding, availability, community, proposal, and chat.

### P1
- Add richer profile editing for parent contact preferences.
- Add reschedule UI controls beyond backend support.
- Improve group playdate calendar overlay visualization.

### P2
- Calendar sync.
- Full inbox.
- Co-admin and school claim workflows.
- Rewards redemption.

## Next Tasks
1. Confirm the email address to use for magic-link testing under the current Resend account.
2. Continue UI QA on mobile widths.
3. Add any refinements requested after founder review.
