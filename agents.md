# FUDL - Agent Instructions

## Project Overview

FUDL is an AI-powered flag football analytics platform — a Hudl clone with route detection and game analysis. It is a **Turborepo monorepo** managed with **Bun** as the package manager.

### Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Next.js Web   │ ──────▶ │   Elysia API     │
│   (port 3000)   │         │   (port 3002)    │
└─────────────────┘         └────────┬─────────┘
                                     │
                                     │ Queues jobs
                                     ▼
                            ┌──────────────────┐         ┌─────────────────┐
                            │  Redis + BullMQ  │ ◀────── │   mitt-worker   │
                            │   Job Queue      │         │   (Python)      │
                            └──────────────────┘         └─────────────────┘
                                                                  │
                                                                  ▼
                                                         ┌─────────────────┐
                                                         │  ML/AI Models   │
                                                         │  (route detect) │
                                                         └─────────────────┘
```

### Repository Structure

| Path                         | Package                 | Description                                         |
| ---------------------------- | ----------------------- | --------------------------------------------------- |
| `apps/web`                   | web                     | Next.js 16 web application (port 3000)              |
| `apps/docs`                  | docs                    | Next.js 16 documentation site (port 3001)           |
| `apps/api`                   | @repo/api               | Elysia API server on Bun (port 3002)                |
| `apps/mitt-worker`           | mitt-worker             | Python BullMQ job worker for video processing       |
| `packages/auth`              | @repo/auth              | better-auth authentication (server + client)        |
| `packages/db`                | @repo/db                | Prisma ORM + PostgreSQL database                    |
| `packages/email`             | @repo/email             | Email templates (Resend integration)                |
| `packages/env`               | @repo/env               | Zod-validated environment variables                 |
| `packages/types`             | @repo/types             | Shared TypeScript types                             |
| `packages/ui`                | @repo/ui                | Shared shadcn/ui component library (48+ components) |
| `packages/eslint-config`     | @repo/eslint-config     | Shared ESLint configuration                         |
| `packages/typescript-config` | @repo/typescript-config | Shared TypeScript configuration                     |

### Tech Stack

- **Runtime:** Bun 1.3.3
- **Frontend:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (new-york style)
- **API:** Elysia v1.4 (Bun HTTP framework)
- **Database:** PostgreSQL via Prisma 7 with `@prisma/adapter-pg`
- **Auth:** better-auth v1.4 with email/password, org support, email verification
- **Queue:** BullMQ + Redis (Alpine)
- **Worker:** Python 3.11 with BullMQ, OpenCV, PyTorch
- **Env Management:** Envoy for .env versioning, Zod for runtime validation
- **Styling:** Tailwind CSS v4 with oklch color system, dark mode, Inter + Geist fonts
- **Forms:** react-hook-form + zod v4 + @hookform/resolvers

---

## Design Objectives

The goal of FUDL is to provide coaches and players with:

1. **Video Upload & Management** — Upload game footage, organize by team/game/season.
2. **AI Route Analysis** — Detect and classify various data from the games on demand.
3. **Player Tracking** — Track individual player movements across frames.
4. **Game Analytics** — Provide stats, tendencies, and visualizations for game review.
5. **Team/Organization Management** — Multi-tenant org support.
6. **Real-time Processing Feedback** — Show job progress as videos are analyzed.

### Package commands

- You can access all available commands at turbo.json, for database commands and repo commands.
- You should never spin up dev servers unless explicitly told to do so.

### Design Principles

- **Type-safe end-to-end:** Shared types in `@repo/types`, Zod validation for env/forms, Prisma for DB types. Never use bypasses for type-safety such as converting to unknown or record<string,unknown> if there is an error where you think there shouldn't be it's usually due to stale typescript language server or bad imports.
- **Separation of concerns:** API server handles auth + job queuing, Python worker handles ML, web app handles presentation.
- **Progressive enhancement:** Start with polling for job status, evolve to SSE (endpoint already exists).
- **Monorepo cohesion:** Shared packages for UI, types, auth, DB, env — no code duplication.
- **Performance-first:** Follow Vercel React best practices (see Skills section).
- **Server-first** For best client performance we should optimize the app to do as much server side rendering as it can unless otherwise needed. Eg.: A layout.tsx should never be a client component as that means that everything in that tree will be client side rendered. page.tsx should never be a client component, bad for SEO and you can never generate metadata for example.
- **Avoiding use-effect** Use effect is a place prone to bugs and endless loops and causes for too many refreshes, avoid it when possible.
- **Input Validation and Sanitization** Always use client side validation as well as server side validation for user input. This is very important for security.
- **Database migrations** When updating database instead of using db push use db:migrate.

---

## Current State (What Exists)

### Implemented

- Full auth flow: registration, login, session management, email verification
- **Email transport via Resend:** `@repo/email` package provides shared layout (header/footer) and template functions for verification, password reset, and invitation emails
- Organization/team membership model and middleware (owner/member authorization)
- Organization creation flow (setup page with slug validation)
- Organization invitation system (invite by email, accept/reject/cancel invitations)
- Members management page (list members, invite, remove, pending invitations, secure invite links)
- **Secure invite links:** Token-based shareable invite links with configurable expiry and max uses. `InviteLink` model in DB, API routes for create/list/revoke/validate/accept, frontend UI for generating and managing links.
- Auth redirect flow (login/register preserve `?redirect` param for post-auth navigation)
- Invite acceptance page (`/invite?id=` for email invitations, `/invite?token=` for secure invite links)
- Auto-set active organization on session creation (databaseHooks)
- Authenticated layout wrapper with session + org resolution
- Dashboard page with top nav, org info cards, member management link
- Job queue infrastructure: submit video URL, poll for progress, display results
- 48+ shared UI components in `@repo/ui` (peer deps properly configured)
- Health check endpoints (ready/live)
- SSE endpoint for real-time job streaming
- Docker setup for Redis
- **Prisma schema with auth + org + domain models (11 tables):** User, Session, Account, Verification, Organization, Member, Invitation, InviteLink, Season, Game, Video
- **Domain models (lean):** Season, Game, Video with `VideoStatus` enum (PENDING → UPLOADING → UPLOADED → PROCESSING → COMPLETED → FAILED)
- Zod-validated environment variables across all packages (including `RESEND_API_KEY`, `EMAIL_FROM`); auth env uses lazy `createEnv` proxy to prevent import-time crashes
- Sonner toast notifications in root layout
- react-hook-form + zod validation on all forms (login, register, setup, invite)
- **Domain models synced to database** via Prisma migrations (`prisma migrate dev` now works after `migrate reset`)
- **API CRUD routes for Season, Game, Video** — org-scoped REST endpoints with auth/membership checks
- **Next.js caching enabled** — `experimental: { useCache: true }` in `apps/web/next.config.ts` (Next.js 16 renamed `dynamicIO` to `useCache`)
- **Role system with display-name mapping** — DB stores `"owner"`, `"admin"`, `"member"`; displayed as Owner, Coach, Player. Shared role module in `@repo/types/src/roles.ts` with helpers (`getRoleDisplayName`, `roleBadgeVariant`, `isCoachRole`, `isOwnerRole`, `ASSIGNABLE_ROLES`).
- **`isCoach` API middleware macro** — in `apps/api/src/middleware/auth.ts`. Allows owner + admin (coach-level) access. Used for all domain data write operations.
- **Coach-gated permissions on all API write routes** — Seasons, Games, Videos POST/PATCH/DELETE use `isCoach: true`. Invite link management (list/create/revoke) also uses `isCoach: true`. Read operations remain `isOrgMember: true`.
- **Dashboard coach-gating** — Upload video, delete game, and create game actions are hidden from players on the frontend.
- **Team roster page** — `/roster` shows all team members grouped by role (Coaches, Players) with avatars, names, and role badges.
- **Authenticated layout nav bar** — Persistent `h-14` top nav with Home, Seasons, Roster links, avatar dropdown with org switcher, mobile hamburger menu.
- **Account deletion flow** — Email-verified account deletion via better-auth's `deleteUser` feature. `beforeDelete` hook blocks sole org owners. Delete account verification email template in `@repo/email`. Profile settings UI with sole-ownership guard and confirmation dialog (type DELETE + email verification).
- **Shared Zod validation schemas** — `@repo/types/validations` provides centralized validation schemas for all forms: auth (login, register), profile, password change, team settings, invite, invite links, domain models (season, game, video), and setup. Used by both client forms (`react-hook-form`) and can be used by API routes.
- **Server-side auth helpers** — `apps/web/app/lib/auth.ts` provides `getServerSession()`, `requireAuth()`, `getServerOrg()`, `getActiveMember()`, `listUserOrgs()`, `requireAuthWithOrg()` for server component data fetching.
- **Server component architecture** — Dashboard, profile settings, team settings, roster, and authenticated layout are all async server components with extracted client components for interactivity.
- **`@repo/db` as direct dependency of `apps/web`** — Allows server components to query the database directly (e.g., sole-ownership check in profile settings).
- **Seasons page** — `/seasons` lists all seasons with name, date range, game count. Coach-gated create/edit/delete via Dialog and AlertDialog. Server component page with client component for interactivity. Uses `standardSchemaResolver` for form validation.
- **Invite redirect chain fix** — Registration via invite link now preserves the invite token through the entire email verification flow: register → verification email → verify page → login → invite acceptance. `callbackURL` is extracted from better-auth's `url` parameter in `sendVerificationEmail` and threaded through as `?redirect=` query params.
- **No forced `/setup` redirect** — Users without a team are no longer force-redirected. The authenticated layout, `requireAuthWithOrg()`, and all org-dependent pages handle the no-org state gracefully.
- **No-team dashboard** — When a user has no active organization, the dashboard shows a welcome page with two options: "Create a team" (links to `/setup`) and "Join a team" (paste invite link URL, parses token, redirects to `/invite?token=...`).
- **No-team empty states** — Org-dependent pages (Seasons, Roster, Team Settings) show a shared `<NoTeamState>` component instead of rendering blank or redirecting. Directs users to the dashboard to create or join a team.
- **Nav bar org-awareness** — Seasons and Roster nav links are hidden when user has no active org. Team settings link in dropdown is conditionally rendered.
- **Ownership transfer** — Team owners can transfer ownership to any non-owner member via Team Settings. Two-step process: promotes target to owner, demotes self to coach. AlertDialog confirmation. Profile settings danger zone links to Team Settings when sole-owner block is active.

### Placeholder / Incomplete

- `process_video()` in Python worker is a stub (returns empty results after 2s sleep)
- `video_frame.py` has incomplete OpenCV frame extraction
- No ML models for route detection implemented
- No file/video upload infrastructure (S3, cloud storage)
- No actual analytics dashboards or visualizations
- No web pages for games or videos (game detail, video upload, etc.)
- No season detail page (`/seasons/:seasonId` — clicking a season row navigates there but the page doesn't exist yet)
- Design specs written for home page, team settings, and profile settings (see `designs/` directory) — not yet implemented
- `@repo/ui` has `chart.tsx` and `resizable.tsx` commented out (recharts v3 and react-resizable-panels v4 type incompatibilities)

---

## Skills Available

The following agent skills are installed and should be used when appropriate:

### Core Architecture Skills

#### `vercel-react-best-practices`

**When to use:** Writing, reviewing, or refactoring any React/Next.js code in `apps/web` or `apps/docs`.

Key priorities:

- **CRITICAL:** Eliminate async waterfalls (use `Promise.all`, Suspense boundaries)
- **CRITICAL:** Optimize bundle size (avoid barrel imports, use `next/dynamic` for heavy components)
- **HIGH:** Server-side performance (React.cache, parallel fetching, minimize client serialization)
- **MEDIUM:** Re-render optimization (memoize expensive work, functional setState, startTransition)

#### `prisma-expert`

**When to use:** Designing/modifying the Prisma schema, writing queries, debugging migrations, optimizing database access, or working with relations. Use proactively whenever touching `packages/db`.

Key areas: Schema design, N+1 prevention, migration safety, connection management, transaction patterns.

#### `bullmq-specialist`

**When to use:** Working with the job queue system — designing job flows, configuring workers, handling retries, delayed/scheduled jobs, or debugging stuck jobs. Use whenever touching `apps/api/src/routes/analysis/queue.ts` or `apps/mitt-worker`.

Key areas: Queue setup, job scheduling, rate limiting, flow producers, worker concurrency.

#### `bun-development`

**When to use:** Working with Bun-specific APIs, optimizing for Bun runtime, or troubleshooting Bun compatibility issues. Relevant for `apps/api` (Elysia runs on Bun) and root monorepo tooling.

Key areas: Bun.serve, Bun.file, testing with `bun:test`, bundling, migration from Node.js patterns.

### Frontend Skills

#### `frontend-patterns`

**When to use:** Implementing React component patterns, custom hooks, state management, performance optimization, or animation in `apps/web`.

Key areas: Composition, compound components, render props, virtualization, error boundaries, form handling.

#### `zustand`

**When to use:** If/when adopting Zustand for client-side state management. Currently no global state library is used — evaluate Zustand when state complexity grows beyond local `useState`.

Key areas: Action patterns (public/internal/dispatch), slice organization, optimistic updates, selectors.

#### `accessibility`

**When to use:** Building or reviewing UI components for WCAG 2.1 compliance. Run before any component is considered "done."

Key areas: POUR principles, keyboard navigation, focus management, ARIA usage, color contrast, screen reader testing.

### Code Quality Skills

#### `typescript`

**When to use:** Writing any TypeScript code across the monorepo. Enforce type safety, async patterns, and code structure conventions.

Key rules: Prefer inference over explicit annotations, avoid `any`, use `interface` for object shapes, `async/await` over callbacks, `@ts-expect-error` over `@ts-ignore`.

#### `coding-standards`

**When to use:** General code quality enforcement — naming conventions, error handling, immutability, DRY/KISS/YAGNI principles.

Key rules: Verb-noun function names, spread operator for immutability, `Promise.all` for parallel operations, early returns over deep nesting.

#### `python-patterns`

**When to use:** Writing or reviewing Python code in `apps/mitt-worker`. Enforce idiomatic Python, type hints, and PEP 8 standards.

Key areas: EAFP style, context managers, dataclasses, generators, proper exception handling, `pyproject.toml` configuration.

### Security & Quality Skills

#### `security-review`

**When to use:** Implementing auth flows, handling user input, creating API endpoints, working with secrets, or building file upload features. Use proactively on security-sensitive code.

Key areas: Secrets management, input validation, SQL injection prevention, XSS/CSRF protection, rate limiting, secure cookies.

#### `best-practices`

**When to use:** Pre-deployment audits — security headers, CSP, HTTPS, dependency vulnerabilities, deprecated API usage, semantic HTML.

#### `web-design-guidelines`

**When to use:** Reviewing UI code for accessibility, UX quality, and design best practices. Run this skill against components before considering them "done."

### Database Skills

#### `postgres-patterns`

**When to use:** Writing raw SQL, designing indexes, optimizing queries, or implementing RLS policies on the PostgreSQL database.

Key areas: Index cheat sheet (B-tree, GIN, BRIN), data type selection, cursor pagination, partial indexes, anti-pattern detection.

### Specialized Skills

#### `opentui`

**When to use:** If building any terminal-based UI tooling for the project (CLI tools, dev utilities). Supports React, Solid, and imperative APIs for TUI development.

#### `api-documentation-generator`

**When to use:** Documenting the Elysia API endpoints. Generate endpoint specs, request/response examples, auth requirements, and error codes.

#### `find-skills`

**When to use:** When encountering a task that might benefit from a specialized skill not yet installed. Search with `npx skills find [query]`.

### Context-Specific Skills (Use Selectively)

These skills are installed but designed for different project architectures. Use only the patterns that apply to FUDL:

- **`react`** — Component and routing patterns. Note: FUDL uses Next.js App Router, not `react-router-dom`. Use only the general component patterns, not the routing or `@lobehub/ui` references.
- **`i18n`** — Internationalization with `react-i18next`. Use if/when FUDL adds multi-language support.
- **`update-docs`** — Next.js documentation updater. Use if contributing to `apps/docs`.
- **`agent-md-refactor`** — For refactoring this `agents.md` file if it grows too large.

---

## Development Guidelines

### Frontend (apps/web)

- Use `@repo/ui` components exclusively — do not create one-off UI components in `apps/web` unless they are truly page-specific.
- Forms must use `react-hook-form` + `zod` schemas for validation.
- API calls go through `fetch()` with `credentials: "include"` to the Elysia API. Consider adopting SWR or React Query for caching and deduplication.
- Use `@repo/env/web` for all environment variable access.
- Follow the `vercel-react-best-practices` skill rules, especially around waterfalls and bundle size.

### API (apps/api)

- All routes live under `src/routes/` with a barrel export pattern.
- Auth-protected routes use the `{ auth: true }` macro option on Elysia routes.
- Org-scoped routes use `{ isOrgOwner: true }` or `{ isOrgMember: true }`.
- Error handling uses the `ApiError` class in `src/middleware/error.ts`.
- BullMQ queue operations are in `src/routes/analysis/queue.ts`.

### Database (packages/db)

- Schema lives in `packages/db/prisma/schema.prisma`.
- Run `bun run db:generate` after schema changes.
- Run `bunx prisma migrate dev` for migrations.
- Use the `prisma` singleton from `@repo/db` — never create new PrismaClient instances.

### Python Worker (apps/mitt-worker)

- Dependencies managed with `uv` (not pip).
- Worker entry point is `src/mitt_worker/worker.py`.
- Job data types are mirrored in `@repo/types` (TypeScript) — keep them in sync.
- ML models go in `src/mitt_worker/models/`.
- Tests: `uv run pytest`, Linting: `uv run ruff check .`, Types: `uv run mypy src`.

### Types (packages/types)

- Shared types between API, web, and worker live here.
- Job-related types: `JobState`, `JobStatus`, `VideoJobData`, `VideoAnalysisResult`, `PlayerAnalysis`.
- When adding new domain types, export them from `src/index.ts`.

### Next.js Caching Strategy

**Current state:** `experimental: { useCache: true }` is enabled in `apps/web/next.config.ts`. Next.js 16 renamed `dynamicIO` to `useCache`. This enables the `"use cache"` directive and related APIs (`cacheLife`, `cacheTag`). No pages currently use `"use cache"` — all pages use `"use client"`. Migration to Server Components with caching is a future task.

**Target architecture:**

1. **Enable `dynamicIO`** in `apps/web/next.config.js`:

   ```js
   const nextConfig = {
     experimental: {
       dynamicIO: true,
     },
   };
   ```

   This enables the `"use cache"` directive and related APIs.

2. **Use `"use cache"` directive** for cached Server Components and Server Actions:
   - Add `"use cache"` at the top of a file or inside an async function to opt into caching.
   - Ideal for data-fetching pages (game lists, analytics dashboards, team rosters) where data changes infrequently.
   - Components with `"use cache"` must NOT use request-time APIs (`cookies()`, `headers()`) directly — pass dynamic data as props instead.

3. **Use `cacheLife()` for TTL control:**

   ```tsx
   import { cacheLife } from "next/cache";

   async function TeamRoster({ teamId }: { teamId: string }) {
     "use cache";
     cacheLife("hours"); // Built-in profiles: 'seconds', 'minutes', 'hours', 'days', 'weeks', 'max'
     const roster = await fetchRoster(teamId);
     return <RosterList players={roster} />;
   }
   ```

4. **Use `cacheTag()` for on-demand revalidation:**

   ```tsx
   import { cacheTag } from "next/cache";
   import { revalidateTag } from "next/cache";

   // In a cached component:
   async function GameDetail({ gameId }: { gameId: string }) {
     "use cache";
     cacheTag(`game-${gameId}`);
     const game = await fetchGame(gameId);
     return <GameView game={game} />;
   }

   // In a Server Action after mutation:
   async function updateGame(gameId: string, data: GameData) {
     "use server";
     await saveGame(gameId, data);
     revalidateTag(`game-${gameId}`);
   }
   ```

5. **Use `React.cache()` for per-request deduplication:**

   ```tsx
   import { cache } from "react";

   const getUser = cache(async (userId: string) => {
     const user = await prisma.user.findUnique({ where: { id: userId } });
     return user;
   });
   ```

   This ensures that if multiple components call `getUser()` with the same ID during a single render, only one database query executes.

6. **Migration plan:** Evaluate each page in `apps/web` for Server Component candidacy:
   - Pages that only display data → Convert to Server Components with `"use cache"`.
   - Pages with interactive forms/state → Keep as Client Components, but wrap data-fetching in cached Server Components using Suspense boundaries.
   - Job status page → Likely stays client-side due to real-time polling/SSE requirements.

---

## What Remains to Develop

### Phase 1: Domain Foundation

- [x] Design and implement domain database models (Video, Game, Season — lean, extensible)
- [ ] Build video upload flow (file upload endpoint, cloud storage integration — S3 or similar)
- [x] Create API routes for domain models (Season, Game, Video CRUD)
- [ ] Create video management pages (list, detail, delete)
- [ ] Migrate web app job status from polling to SSE
- [x] Set up Next.js caching (`cachedComponents`, `"use cache"`, `cacheLife`/`cacheTag`, `React.cache`)

### Phase 2: ML Pipeline

- [ ] Implement OpenCV frame extraction in `video_frame.py`
- [ ] Build player detection model (YOLO or similar object detection)
- [ ] Build route classification model (CNN/RNN for trajectory classification)
- [ ] Implement full `process_video()` pipeline in the worker
- [ ] Define route taxonomy (slant, out, post, corner, go, curl, etc.)

### Phase 3: Analytics & Visualization

- [ ] Build game review interface with video playback + route overlays
- [ ] Create analytics dashboards (route tendencies, player stats, team comparisons)
- [ ] Implement play-by-play breakdown views
- [ ] Add charting/visualization components using recharts

### Phase 4: Team & Collaboration

- [x] Build team management UI (invite members, assign roles)
- [ ] Implement game sharing between organizations
- [ ] Add permission-based access to videos and analytics
- [ ] Build coaching tools (annotations, drawing on video frames)

### Phase 5: Production Readiness

- [ ] Set up CI/CD pipeline
- [ ] Add comprehensive test coverage (unit, integration, e2e)
- [ ] Performance optimization (follow vercel-react-best-practices)
- [ ] Accessibility audit (use web-design-guidelines skill)
- [ ] Production deployment configuration

---

## Post-Session Instructions

**After every coding session, the agent MUST update this `agents.md` file with:**

1. **New learnings** — Any architectural decisions made, patterns discovered, or gotchas encountered during the session.
2. **Updated "What Remains to Develop"** — Check off completed items, add new items discovered during development, reprioritize if needed.
3. **Updated "Current State"** — Move items from "Placeholder/Incomplete" to "Implemented" as they are completed.
4. **Session notes** — A brief summary of what was accomplished in the session, appended to a "Session Log" section at the bottom of this file.

This ensures continuity across sessions and prevents redundant work.

---

## Session Log

### Session 3 — 2026-02-08

**Focus:** Email transport integration + domain database models

**Completed:**

1. **Resend email integration** — Installed `resend` in `@repo/auth`, added `RESEND_API_KEY` and `EMAIL_FROM` to the auth env schema (`packages/env/src/auth.ts`), and configured three email handlers in `packages/auth/src/server.ts`:
   - `sendVerificationEmail` — HTML email with verify button, sent on registration
   - `sendResetPasswordEmail` — HTML email with reset button
   - `sendInvitationEmail` — HTML email with accept invitation button (replaced console.log stub)
2. **Lean domain database models** — Added 3 domain models to the Prisma schema:
   - `Season` — org-scoped, with optional date range, linked to games
   - `Game` — org-scoped, optional season link, opponent/date/location/notes
   - `Video` — org-scoped, optional game link, storage fields (key, URL, mime, size, duration), processing status via `VideoStatus` enum (PENDING → UPLOADING → UPLOADED → PROCESSING → COMPLETED → FAILED), jobId for BullMQ integration
3. **Updated `.env.example`** with `RESEND_API_KEY` and `EMAIL_FROM` vars

**Key decisions:**

- Kept domain models intentionally lean — no Play, Route, or Player models yet since the video processing pipeline is still undefined. These will be added when ML output shape is clearer.
- `VideoStatus` enum defined at DB level (not in `@repo/types`) — Prisma generates the type, no duplication needed.
- `Game.seasonId` uses `onDelete: SetNull` (not Cascade) — deleting a season shouldn't delete games.
- `Video.gameId` uses `onDelete: SetNull` — deleting a game shouldn't delete videos.
- `Video.uploadedById` uses `onDelete: Cascade` — if a user is deleted, their videos are removed.

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `@repo/ui` ❌ (pre-existing chart.tsx/resizable.tsx errors)

**Continuation (same session):**

4. **`@repo/email` package** — Created `packages/email/` with a shared HTML email layout (responsive table, FUDL header, copyright footer) and reusable helpers (`button()`, `fallbackLink()`). Three template functions exported: `verificationEmail()`, `resetPasswordEmail()`, `invitationEmail()` — each returns `{ subject, html }`.
5. **Refactored `packages/auth/src/server.ts`** — Removed all inline HTML. Added `sendEmail()` helper wrapping Resend + error logging. Each auth email handler is now 1-2 lines.
6. **UI type errors resolved** — `chart.tsx` and `resizable.tsx` commented out by user. Full monorepo `check-types` now passes with 0 errors across all 4 packages.

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 4 — 2026-02-08

**Focus:** Fix RESEND_API_KEY runtime error, domain model DB sync, API CRUD routes, Next.js config fix

**Completed:**

1. **Fixed RESEND_API_KEY runtime error** — Root cause: `packages/env/src/auth.ts` used `parseEnv()` (eager validation at import time). When Next.js bundled `@repo/auth/client`, the `import type { auth } from "./server"` in `client.ts` could pull in `server.ts` → `@repo/env/auth` → instant crash because `RESEND_API_KEY` isn't available in the browser environment.
   - **Fix 1:** Switched `authEnv` from `parseEnv(authSchema)` to `createEnv(authSchema)` in `packages/env/src/auth.ts` — validation is now deferred until first property access (lazy proxy).
   - **Fix 2 (reverted):** Initially added `import "server-only"` guard to `packages/auth/src/server.ts`, but this caused a runtime crash because Bun's bundler resolves `import type` modules eagerly. Since better-auth's client pattern requires `import type { auth } from "./server"` for `inferAdditionalFields<typeof auth>()`, the `server-only` guard is incompatible. The lazy `createEnv` proxy is the correct and sufficient protection.

2. **Synced domain models to database** — Ran `prisma db push` successfully. `prisma migrate dev` fails on Prisma Postgres due to `pg_advisory_lock` timeout — this is a known limitation of Prisma Postgres. `db push` is the correct workflow for this database provider.

3. **Built API CRUD routes for Season, Game, Video** — All org-scoped under `/orgs/:organizationId/`:
   - `seasons/` — `GET /` (list), `POST /` (create, owner), `GET /:seasonId` (detail), `PATCH /:seasonId` (update, owner), `DELETE /:seasonId` (delete, owner)
   - `games/` — `GET /` (list, optional `?seasonId` filter), `POST /` (create, owner), `GET /:gameId` (detail + videos), `PATCH /:gameId` (update, owner), `DELETE /:gameId` (delete, owner)
   - `videos/` — `GET /` (list, optional `?gameId` + `?status` filters), `POST /` (create metadata, member), `GET /:videoId` (detail), `PATCH /:videoId` (update, owner), `DELETE /:videoId` (delete, owner)
   - All routes use `authPlugin` macros: `isOrgMember: true` for reads, `isOrgOwner: true` for writes.
   - Cross-entity validation: season/game must belong to same org before linking.
   - Added `@repo/db` as direct dependency of `@repo/api`.

4. **Fixed `next.config.ts`** — Replaced invalid `cacheComponents: true` with `experimental: { useCache: true }` (Next.js 16 renamed `dynamicIO` to `useCache`).

**Key decisions:**

- `authEnv` is now the only env schema using `createEnv` (lazy) — all others (`dbEnv`, `webEnv`, `apiEnv`, `sharedEnv`) still use `parseEnv` (eager) because they don't have required secrets that could be missing in client bundles.
- API route structure: `/orgs/:organizationId/{seasons,games,videos}` — resource nesting under org scope. The `organizationId` in the URL path is resolved by the `isOrgMember`/`isOrgOwner` macros for authorization.
- Video POST creates metadata only (status = PENDING) — actual file upload will be a separate endpoint when S3 integration is built.
- `prisma db push` is the canonical way to sync schema changes with Prisma Postgres. Migration files are not generated.

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 5 — 2026-02-08

**Focus:** Fix two open bugs from Session 4 + codebase cleanup audit

**Completed:**

1. **Fixed type error in `apps/web/app/invite/page.tsx`** — The `InvitationInfo` interface had `organizationSlug` and `inviterName` fields that don't exist in better-auth's `listUserInvitations()` return type. Investigated the actual return type from better-auth's organization plugin source (in `crud-invites.d.mts` and `adapter.mjs`). The API returns invitation fields + `organizationName` (flattened from an org join). Updated `InvitationInfo` to match the real shape: `id`, `organizationId`, `email`, `role`, `status`, `inviterId`, `expiresAt`, `createdAt`, `organizationName`.

2. **Fixed infinite loop in `apps/web/app/(authenticated)/settings/members/page.tsx`** — Root cause: `useCallback` for `loadData` depended on `activeOrg` (object reference from `authClient.useActiveOrganization()`). Every render produced a new object reference -> new `loadData` identity -> `useEffect` re-fired -> infinite loop.
   - **Fix:** Extracted `const activeOrgId = activeOrg?.id` (stable string primitive) and used `activeOrgId` as the dependency in `loadData`, `onInvite`, and `removeMember` callbacks instead of the full `activeOrg` object.

3. **Audited `as unknown` / `as any` casts** — Found only 1 occurrence in the entire codebase: `packages/db/src/client.ts:9` — the standard Prisma global singleton pattern (`global as unknown as { prisma: PrismaClient }`). This is the canonical Prisma approach and requires no changes.

**Key learnings:**

- **better-auth `listUserInvitations()` return type:** Each invitation in the array has all base invitation fields (`id`, `organizationId`, `email`, `role`, `status`, `inviterId`, `expiresAt`, `createdAt`) plus `organizationName` (string, flattened from org join). The `organization` object itself is destructured out. There is NO `organizationSlug` or `inviterName` field.
- **better-auth `listInvitations()` return type:** Returns raw invitation records only (no org join, no `organizationName`).
- **React dependency array gotcha:** When using reactive hooks like `authClient.useActiveOrganization()`, always extract primitive values (`.id`, `.slug`, etc.) for use in `useCallback`/`useMemo`/`useEffect` dependency arrays. Object references from reactive hooks are unstable across renders.

**Files modified:**

- `apps/web/app/invite/page.tsx` — Updated `InvitationInfo` interface to match better-auth's actual return type
- `apps/web/app/(authenticated)/settings/members/page.tsx` — Extracted `activeOrgId`, replaced `activeOrg` with `activeOrgId` in all `useCallback` dependencies and function bodies

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 6 — 2026-02-08

**Focus:** Secure invite links — replace insecure org-slug-based invite links with cryptographic token-based system

**Problem:** The shareable invite link on the members page was `http://localhost:3000/invite?org={slug}`. This was insecure because:

1. The org slug is guessable/predictable
2. No server-side record was created when the link was shared
3. The `?org=` parameter was actually a dead end — it never created an invitation or triggered any join mechanism
4. Anyone who knew an org slug could visit the URL (though they'd see "no pending invitations" after login)

**Solution:** Token-based invite links with configurable expiry and max uses.

**Completed:**

1. **`InviteLink` model** — Added to `packages/db/prisma/schema.prisma`:
   - `token` (unique, 64-char base64url from 48 crypto-random bytes)
   - `organizationId` (FK to Organization)
   - `createdById` (user who generated the link)
   - `role` (default "member" — role assigned to users who join via this link)
   - `maxUses` (default 25, configurable 1-1000)
   - `useCount` (incremented atomically on each use)
   - `expiresAt` (configurable: 1h, 1d, 2d, 7d, 30d)
   - `revokedAt` (nullable — soft revoke)
   - Indexes on `organizationId` and `token`

2. **API routes** — `apps/api/src/routes/invite-links/routes.ts`:
   - **Org-scoped routes** (require owner auth via `isOrgOwner` macro):
     - `GET /orgs/:organizationId/invite-links` — List all links (with `active` boolean computed from expiry/revoked/uses)
     - `POST /orgs/:organizationId/invite-links` — Generate new link (configurable role, maxUses, expiresInHours)
     - `DELETE /orgs/:organizationId/invite-links/:linkId` — Revoke a link (soft delete via `revokedAt`)
   - **Public token routes** (under `/invite-links`):
     - `GET /invite-links/:token` — Validate token, return org name + role (no auth required — used by invite page to show info before login)
     - `POST /invite-links/:token/accept` — Accept the invite (auth required). Checks: token valid, not already a member, adds member via `auth.api.addMember()`, increments `useCount` atomically, sets active org.

3. **Members page update** — `apps/web/app/(authenticated)/settings/members/page.tsx`:
   - Removed old static `inviteLink` construction (was `?org={slug}`)
   - Added invite link generation form with configurable: role (member/admin), max uses (1-1000), expiry duration (1h/1d/2d/7d/30d)
   - Shows table of all invite links with: truncated token, role badge, use count / max uses, expiry date, status (Active/Revoked/Expired), Copy + Revoke buttons
   - Auto-copies new link to clipboard on generation
   - Removed unused `clientEnv` import

4. **Invite page update** — `apps/web/app/invite/page.tsx`:
   - Refactored into two separate components: `TokenInviteFlow` and `EmailInviteFlow`
   - `TokenInviteFlow` handles `?token=` param: validates token -> shows org name + role -> prompts login/register if unauthenticated -> "Join team" button -> accept -> redirect to dashboard
   - `EmailInviteFlow` handles `?id=` param (existing better-auth flow, preserved as-is)
   - Removed dead `?org=` slug flow entirely
   - Both flows properly preserve redirect params through login/register

5. **Schema synced to database** — `prisma db push` successful, `invite_link` table created.

**Key decisions:**

- Token is 48 crypto-random bytes -> base64url encoded (64 chars). Unguessable, URL-safe, no padding.
- Token validation endpoint (`GET /invite-links/:token`) does NOT require auth — this allows the invite page to show "Join {org name}" even before the user logs in.
- Token acceptance endpoint (`POST /invite-links/:token/accept`) uses `auth.api.addMember()` to add the user directly (bypassing the email invitation system). This is intentional — invite links are a separate, parallel flow to email invitations.
- Idempotent acceptance: if user is already a member, returns `{ success: true, alreadyMember: true }` and sets the org as active.
- `useCount` is incremented atomically via `{ increment: 1 }` to prevent race conditions.
- Link validity is checked at both validation and acceptance time (defense in depth).

**Files created:**

- `apps/api/src/routes/invite-links/index.ts`
- `apps/api/src/routes/invite-links/routes.ts`

**Files modified:**

- `packages/db/prisma/schema.prisma` — Added `InviteLink` model, added `inviteLinks` relation to Organization
- `apps/api/src/routes/index.ts` — Wired `inviteLinkRoutes`
- `apps/web/app/(authenticated)/settings/members/page.tsx` — Replaced static invite link with secure link management UI
- `apps/web/app/invite/page.tsx` — Refactored into TokenInviteFlow + EmailInviteFlow, removed `?org=` flow
- `AGENTS.md` — Updated current state, session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 7 — 2026-02-09

**Focus:** Design specs for three core authenticated pages

**Completed:**

1. **`designs/home.md`** — Authenticated home page (game library/feed). Key design decisions:
   - Video-first game feed layout inspired by Hudl's approach — single-column list of games, not a card grid or dashboard
   - Persistent top nav bar with slim `h-14` design, no sidebar (intentional — feature set is too small for sidebar overhead)
   - Game cards as flat horizontal rows with thumbnail, opponent, meta, and video status — no heavy card borders
   - Three game card states: completed (with AI badge), processing (inline progress bar), and no-footage (with upload CTA)
   - Skeleton loading states instead of spinners
   - Empty state using `<Empty>` component
   - Season filter via `<Select>` with URL query param persistence
   - Mobile: cards stack vertically with full-width thumbnails

2. **`designs/team-settings.md`** — Team settings page (owner/admin access). Key design decisions:
   - Replaces current `/settings/members` monolith with organized sections: Team Profile, Members, Pending Invitations, Invite Links, Danger Zone
   - Single scrollable page with clear section headings (no tabs/nested routes)
   - Inline editing for team name (click to edit pattern)
   - Member list uses `<Item>` component instead of `<Table>` for better readability and mobile support
   - Invite form collapsed by default, expands on click
   - Danger Zone with multi-step confirmation (type team name to delete)
   - Permission-denied state for non-owner/non-admin users

3. **`designs/profile-settings.md`** — Profile settings page (all users). Key design decisions:
   - Per-field save pattern (each field saves independently, no "Save all" button)
   - Narrower container (`max-w-2xl`) for intimate/personal feel
   - Avatar + identity hero section at top (display-only)
   - Password change collapsed behind `<Collapsible>` component
   - Theme switcher (Light/Dark/System) using radio group or selectable cards
   - Teams list showing all orgs the user belongs to, with Switch/Leave actions
   - Danger Zone for account deletion with ownership transfer guard

**Key architectural decisions:**

- **Shared app shell:** All three specs reference a common global nav bar pattern (defined in `home.md`). This replaces the current approach of duplicating inline headers in every page. The authenticated layout (`apps/web/app/(authenticated)/layout.tsx`) should render this shell.
- **No sidebar:** Intentional decision for now. The CSS sidebar tokens in `globals.css` are preserved for future use if the feature set grows.
- **Dark-mode first:** Sports apps are used in film rooms and sidelines. All specs are designed with dark mode as the primary context.
- **Consistent patterns across settings pages:** Both team-settings and profile-settings use the same visual patterns — back link, section headings with `<Separator>`, inline forms, `<Skeleton>` loading, danger zone with `border-destructive/50`.

**Files created:**

- `designs/home.md`
- `designs/team-settings.md`
- `designs/profile-settings.md`

**Files modified:**

- `AGENTS.md` — Updated "Placeholder / Incomplete" section to reference new design specs, added session log

### Session 8 — 2026-02-09

**Focus:** Role system, coach-gated permissions, roster page, API permission audit

**Completed:**

1. **Shared role module** — Created `packages/types/src/roles.ts` with `DbRole` type, `ROLE_DISPLAY_NAME` map (owner→Owner, admin→Coach, member→Player), helper functions (`getRoleDisplayName`, `roleBadgeVariant`, `isCoachRole`, `isOwnerRole`), and `ASSIGNABLE_ROLES` array. Exported via `packages/types/src/index.ts` and `package.json` exports.

2. **`isCoach` API middleware macro** — Added to `apps/api/src/middleware/auth.ts` between `isOrgOwner` and `isOrgMember`. Allows owner + admin access, returns 403 for regular members.

3. **API permission audit and fix** — Audited all 27 API routes. Changed 12 routes from `isOrgOwner` to `isCoach`:
   - Seasons: POST, PATCH, DELETE (3 routes)
   - Games: POST, PATCH, DELETE (3 routes)
   - Videos: POST (was `isOrgMember`), PATCH, DELETE (3 routes)
   - Invite links: GET (list), POST (create), DELETE (revoke) (3 routes)
   - Read operations remain `isOrgMember: true` (correct — players need to view data)

4. **Dashboard coach-gating** — `apps/web/app/(authenticated)/dashboard/page.tsx` now fetches the user's role and conditionally renders upload/delete/create actions only for coaches.

5. **Team settings role display** — `apps/web/app/(authenticated)/settings/team/page.tsx` uses shared role helpers. All role badges show display names (Owner/Coach/Player), role selectors use `ASSIGNABLE_ROLES`.

6. **Profile settings role display** — `apps/web/app/(authenticated)/settings/profile/page.tsx` uses shared role helpers for team role badges and ownership checks.

7. **Team roster page** — Created `apps/web/app/(authenticated)/roster/page.tsx`. Shows all members grouped by role (Coaches first, then Players), with avatars, names, emails, role badges. Skeleton loading and empty state.

8. **Roster nav link** — Added `{ href: "/roster", label: "Roster" }` to `NAV_LINKS` in `apps/web/app/(authenticated)/layout.tsx`.

**Key decisions:**

- **Display-name-only role mapping** — No schema changes or better-auth config changes needed. DB stores `"owner"/"admin"/"member"`, display layer maps to Owner/Coach/Player.
- **`isCoach` for invite link management** — Coaches can now list, create, and revoke invite links (previously owner-only). This enables coaches to independently recruit players.
- **Video POST changed from `isOrgMember` to `isCoach`** — Players should not initiate uploads; that's a coaching/admin responsibility.
- **SSE endpoint has no auth** — `GET /analysis/job/:id/stream` is public. This is a known gap that should be fixed when the analysis pipeline is built out.

**Files created:**

- `packages/types/src/roles.ts`
- `apps/web/app/(authenticated)/roster/page.tsx`

**Files modified:**

- `packages/types/src/index.ts` — Added `export * from "./roles.js"`
- `packages/types/package.json` — Added `"./roles"` export
- `apps/api/src/middleware/auth.ts` — Added `isCoach` macro
- `apps/api/src/routes/v1/seasons/routes.ts` — `isOrgOwner` → `isCoach` on POST/PATCH/DELETE
- `apps/api/src/routes/v1/games/routes.ts` — `isOrgOwner` → `isCoach` on POST/PATCH/DELETE
- `apps/api/src/routes/v1/videos/routes.ts` — `isOrgMember` → `isCoach` on POST, `isOrgOwner` → `isCoach` on PATCH/DELETE
- `apps/api/src/routes/v1/invite-links/routes.ts` — `isOrgOwner` → `isCoach` on GET/POST/DELETE
- `apps/web/app/(authenticated)/dashboard/page.tsx` — Coach-gated upload/delete actions
- `apps/web/app/(authenticated)/settings/team/page.tsx` — Role display + permission updates
- `apps/web/app/(authenticated)/settings/profile/page.tsx` — Role display updates
- `apps/web/app/(authenticated)/layout.tsx` — Added Roster nav link

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 9 — 2026-02-09

**Focus:** Extended athlete profile fields — database, auth config, shared types, and profile settings UI

**Completed:**

1. **Shared profile types** — Created `packages/types/src/profile.ts` (NEW) with:
   - `Sport` type and `SPORTS` constant array: `FLAG_FOOTBALL`, `TACKLE_FOOTBALL`, `RUGBY`, `HANDBALL`, `BJJ`
   - `SPORT_LABELS` map for display names (e.g., `BJJ` → "Brazilian Jiu-Jitsu")
   - `SPORT_OPTIONS` dropdown-friendly `{ value, label }` array
   - `POSITIONS_BY_SPORT` map with sport-specific positions (7 flag football, 10 tackle football, 10 rugby, 7 handball, 5 BJJ belt ranks)
   - `getPositionOptions()` helper and `isSport()` type guard
   - Exported via `packages/types/src/index.ts` and `package.json` `"./profile"` export

2. **Prisma schema — 11 new fields on User model** (`packages/db/prisma/schema.prisma`):
   - `sport` (String?) — stored as plain string, validated at app layer via `isSport()`
   - `city`, `country` (String?) — location
   - `heightCm` (Int?), `weightKg` (Float?) — physical measurements in metric
   - `dateOfBirth` (DateTime?) — age calculated on frontend
   - `bio` (String?) — short about text
   - `position` (String?) — sport-specific position/belt rank
   - `jerseyNumber` (Int?)
   - `instagramHandle`, `twitterHandle` (String?) — social media

3. **better-auth `user.additionalFields`** — Configured all 11 fields in `packages/auth/src/server.ts`. This makes them available through `authClient.useSession()` (read) and `authClient.updateUser()` (write) via the existing `inferAdditionalFields<typeof auth>()` on the client.

4. **Database synced** — `prisma db push` successful, all 11 columns added to the `user` table. Prisma client regenerated.

5. **Profile settings page — new "Profile Details" section** (`apps/web/app/(authenticated)/settings/profile/page.tsx`):
   - Added between "Personal Information" and "Password" sections
   - **Bio** — `<Textarea>` with per-field save
   - **Sport** — `<Select>` dropdown with all 5 sports
   - **Position** — Dynamic `<Select>` that shows sport-specific positions (or belt ranks for BJJ). Only visible when a sport is selected. Label changes to "Belt Rank" for BJJ.
   - **Jersey Number** — Number input (0-999)
   - **Height & Weight** — Side-by-side number inputs (cm / kg)
   - **Date of Birth** — Date input
   - **City & Country** — Side-by-side text inputs
   - **Social Media** — Instagram and X/Twitter handle inputs
   - All fields use the existing `SaveButton` component with per-field dirty/saving/saved state
   - Sport change auto-clears position if the current position isn't valid for the new sport
   - Generic `saveProfileField()` helper handles the update → original reset → saved flash pattern
   - Skeleton loading state while session is pending

**Key decisions:**

- **Plain string for sport, not Prisma enum** — Avoids a migration every time a new sport is added. Validation happens at the app layer via `isSport()`.
- **`dateOfBirth` stored as string in better-auth** — better-auth's `additionalFields` only supports `"string"`, `"number"`, and `"boolean"` types. The DB column is `DateTime?`, but better-auth reads/writes it as an ISO string. The UI uses `type="date"` input and slices to `YYYY-MM-DD` for display.
- **No custom API route needed** — `authClient.updateUser()` handles all additional fields natively through better-auth's built-in user update endpoint. No custom Elysia route was necessary.
- **Auth client unchanged** — `inferAdditionalFields<typeof auth>()` automatically picks up the new fields from the server config at type level.
- **Session user cast to `Record<string, unknown>`** — The session type from `inferAdditionalFields` should include the new fields, but to avoid any runtime issues with the initial null state, values are accessed via a safe cast.

**Files created:**

- `packages/types/src/profile.ts`

**Files modified:**

- `packages/types/src/index.ts` — Added `export * from "./profile"`
- `packages/types/package.json` — Added `"./profile"` export path
- `packages/db/prisma/schema.prisma` — Added 11 profile fields to User model
- `packages/auth/src/server.ts` — Added `user.additionalFields` with all 11 fields
- `apps/web/app/(authenticated)/settings/profile/page.tsx` — Added Profile Details section with all fields + per-field save

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 10 — 2026-02-10

**Focus:** Server component migration — convert all remaining `"use client"` pages/layouts to async server components

**Completed:**

1. **Server-side auth helpers** — Created `apps/web/app/lib/auth.ts` with reusable helpers wrapping `auth.api.*` calls from `@repo/auth/server`:
   - `getServerSession()` — Returns session or null
   - `requireAuth()` — Returns session, redirects to `/login` if none
   - `getServerOrg()` — Returns full org (members, invitations) or null
   - `getActiveMember()` — Returns `{ role, ... }` or null
   - `listUserOrgs()` — Returns org array or null
   - `requireAuthWithOrg()` — Returns `{ session, org }`, redirects if missing

2. **Dashboard page** — `apps/web/app/(authenticated)/dashboard/page.tsx` rewritten as async server component. Calls `requireAuthWithOrg()`, passes session + org data to extracted `<DashboardContent>` client component (`dashboard-content.tsx`).

3. **Profile settings page** — `apps/web/app/(authenticated)/settings/profile/page.tsx` rewritten as server component. Calls `requireAuth()` + `listUserOrgs()`, extracts 11 profile fields from `session.user`, passes `ProfileInitialData` to `<ProfileSettingsContent>` client component (`profile-content.tsx`).

4. **Team settings page** — `apps/web/app/(authenticated)/settings/team/page.tsx` rewritten as server component. Calls `requireAuth()`, `getServerOrg()`, `getActiveMember()` in parallel, fetches invite links from Elysia API with cookie forwarding, maps members/invitations to serializable format, passes to `<TeamSettingsContent>` client component (`team-content.tsx`).

5. **Members page redirect** — `apps/web/app/(authenticated)/settings/members/page.tsx` converted to server component that just calls `redirect("/settings/team")`.

6. **Authenticated layout** — `apps/web/app/(authenticated)/layout.tsx` converted to async server component with server-side session/org resolution.

7. **Roster page** — Already a pure server component (renders HTML only, no client interactivity).

**Migration pattern applied:**

- Page becomes an async server component that fetches data server-side via `auth.api.*` helpers
- Interactive logic extracted into a `"use client"` component in the same directory (e.g., `team-content.tsx`)
- Data passed as serializable props (dates converted to ISO strings, objects mapped to plain shapes)
- Client components handle mutations via `authClient` and have `reloadData()` for client-side refresh after mutations

**Pages intentionally kept as `"use client"`:**

- `invite/page.tsx` — Dynamic flow based on URL params, handles both authenticated and unauthenticated states
- `setup/page.tsx` — Form-driven org creation flow
- `(auth)/login/page.tsx` and `(auth)/register/page.tsx` — Auth forms

**Key learnings:**

- **`auth.api.getFullOrganization()` member shape:** Each member has nested `user: { id, name, email, image }` — NOT flat `userName`/`userEmail`. The mapping in `team/page.tsx` uses `(m as Record<string, unknown>).user` cast because the TypeScript type doesn't expose `user` directly.
- **Date serialization:** `Date` objects from better-auth must be converted to ISO strings via `toISOString()` before passing as props to client components.
- **Cookie forwarding for API calls:** When calling the Elysia API from server components, forward cookies via `const reqHeaders = await headers(); const cookie = reqHeaders.get("cookie") || ""; fetch(url, { headers: { cookie } })`.

**Files created:**

- `apps/web/app/lib/auth.ts`
- `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx`
- `apps/web/app/(authenticated)/settings/profile/profile-content.tsx`
- `apps/web/app/(authenticated)/settings/team/team-content.tsx`

**Files modified:**

- `apps/web/app/(authenticated)/layout.tsx` — Converted to async server component
- `apps/web/app/(authenticated)/dashboard/page.tsx` — Rewritten as server component
- `apps/web/app/(authenticated)/settings/profile/page.tsx` — Rewritten as server component
- `apps/web/app/(authenticated)/settings/team/page.tsx` — Rewritten as server component
- `apps/web/app/(authenticated)/settings/members/page.tsx` — Converted to redirect

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 11 — 2026-02-10

**Focus:** Fix Turbopack crashes preventing dev server from serving pages

**Problem:** The dev server started fine (`Ready in 2.2s`) but crashed with a `FATAL: An unexpected Turbopack error occurred` panic on every page request. Two separate issues were discovered and fixed.

**Completed:**

1. **Fixed Turbopack `@source` panic** — `packages/ui/src/styles/globals.css` had incorrect relative paths in `@source` directives:
   - `@source "../../../apps/**/*.{ts,tsx}"` resolved to `packages/apps/` (nonexistent) — fixed to `@source "../../../../apps/**/*.{ts,tsx}"` (4 levels up from `packages/ui/src/styles/`)
   - Removed `@source "../../../components/**/*.{ts,tsx}"` entirely (pointed to nonexistent `packages/components/` directory)
   - These bad glob paths caused Turbopack's CSS/glob scanner to panic internally

2. **Windows symlink permission error** — After fixing the `@source` panic, a second crash appeared: `TurbopackInternalError: create symlink to .../pg@8.16.3.../node_modules/pg — A required privilege is not held by the client (os error 1314)`. Root cause: Bun uses symlinks in `node_modules/.bun/` for package hoisting, and Turbopack follows these symlinks, trying to create its own in `.next/`. Windows requires either admin privileges or Developer Mode for symlink creation.
   - **Mitigation:** Added `serverExternalPackages: ["pg", "@prisma/adapter-pg"]` to `apps/web/next.config.ts` — prevents Turbopack from bundling these native packages
   - **Resolution:** Running the terminal as Administrator grants symlink privileges. Alternatively, enabling Windows Developer Mode would also work.

3. **Fixed `@repo/email` module resolution error** — After the symlink issue was resolved, pages that import `@repo/auth/server` (which imports `@repo/email`) failed with `Can't resolve './templates.js'`. Root cause: `packages/email/src/index.ts` used `.js` extensions in imports (`from "./templates.js"`), which is correct for `NodeNext` module resolution but incompatible with Turbopack's bundler resolution.
   - Changed imports to extensionless: `from "./templates"` (matching the pattern used by `@repo/types` and other workspace packages)
   - Updated `packages/email/tsconfig.json` to override `module`/`moduleResolution` to `ESNext`/`Bundler` (since the package is consumed directly as raw TypeScript by Turbopack, not compiled to JS)

**Key learnings:**

- **`@source` paths in Tailwind v4:** These are relative to the CSS file location, not the project root. Count directory levels carefully — `packages/ui/src/styles/globals.css` needs 4 levels of `../` to reach monorepo root.
- **Bun + Turbopack + Windows:** Bun's `node_modules/.bun/` symlink-based hoisting is incompatible with Turbopack on Windows without admin/Developer Mode. `serverExternalPackages` helps for server-only packages but doesn't fully prevent the issue. Running as admin is the pragmatic fix.
- **Workspace packages consumed by bundlers:** When a workspace package is consumed directly as raw TypeScript (via `"exports": { ".": "./src/index.ts" }`), it should use `"moduleResolution": "Bundler"` in its tsconfig, not `"NodeNext"`. `NodeNext` requires `.js` extensions in imports, but Turbopack expects extensionless imports to resolve to `.ts` files.

**Files modified:**

- `packages/ui/src/styles/globals.css` — Fixed `@source` directive paths
- `apps/web/next.config.ts` — Added `serverExternalPackages: ["pg", "@prisma/adapter-pg"]`
- `packages/email/src/index.ts` — Changed `./templates.js` imports to extensionless `./templates`
- `packages/email/tsconfig.json` — Overrode `module`/`moduleResolution` to `ESNext`/`Bundler`

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 12 — 2026-02-10

**Focus:** Account deletion implementation — schema changes, email template, better-auth config, profile settings UI, and shared validation schemas

**Completed:**

1. **Schema changes** — `packages/db/prisma/schema.prisma`:
   - `Video.uploadedById` changed from `String` (required, `onDelete: Cascade`) to `String?` (nullable, `onDelete: SetNull`) — preserves team videos when uploader deletes account
   - `InviteLink.createdById` changed from bare `String` to `String?` with proper FK relation to `User` (`onDelete: SetNull`)
   - Added `inviteLinks InviteLink[]` relation to the `User` model

2. **Database migration** — Ran `prisma migrate reset --force` (needed due to drift from previous `db push` sessions), then created and applied migration `20260210133234_account_deletion_schema_changes`. Regenerated Prisma client.

3. **Delete account verification email** — Added `DeleteAccountEmailParams` interface and `deleteAccountVerificationEmail()` function to `packages/email/src/templates.ts`. Uses red CTA button, warns about permanence, notes user must be logged in when clicking link. Exported from `packages/email/src/index.ts`.

4. **better-auth `deleteUser` config** — In `packages/auth/src/server.ts`:
   - `enabled: true`
   - `sendDeleteAccountVerification`: sends email via Resend using the new template
   - `beforeDelete` hook: queries `member` table for orgs where user is sole owner, throws `APIError("BAD_REQUEST")` if any found — server-side safety net

5. **Server component sole-ownership check** — `apps/web/app/(authenticated)/settings/profile/page.tsx` queries `member` table via Prisma for all orgs where user is sole owner, passes `soleOwnedOrgNames: string[]` to client component. Added `@repo/db` as direct dependency of `apps/web`.

6. **Profile settings client component** — `apps/web/app/(authenticated)/settings/profile/profile-content.tsx`:
   - Updated `ProfileInitialData` interface with `soleOwnedOrgNames: string[]`
   - Delete handler calls `authClient.deleteUser({ callbackURL })`, shows success toast
   - Danger zone: disabled delete button with warning if sole owner; confirmation dialog with type-DELETE guard and email verification explanation
   - Removed broken role badge imports/display from teams list (better-auth `listOrganizations()` doesn't return roles)

7. **Shared Zod validation schemas** — Created `packages/types/src/validations.ts` with centralized schemas:
   - Auth: `loginSchema`, `registerSchema`
   - Profile: `profileSchema` (unified), `changePasswordSchema`, `validateProfilePosition()` cross-field validator
   - Team: `teamNameSchema`, `inviteSchema`, `inviteLinkSchema`
   - Domain: `createSeasonSchema`, `updateSeasonSchema`, `createGameSchema`, `updateGameSchema`, `createVideoSchema`, `updateVideoSchema`, `analysisVideoSchema`
   - Setup: `setupSchema`

8. **Profile form refactor** — Converted from per-field save pattern to unified single-form save with `react-hook-form` + `profileSchema`. Single "Save changes" button, dirty state tracking.

9. **Video API routes verified** — No changes needed. Prisma handles nullable `uploadedBy` relation gracefully — `include` returns `null` when FK is null.

**Key decisions:**

- **`Video.uploadedById` → SetNull** — Team videos are org-owned data; deleting a user shouldn't delete team content.
- **`InviteLink.createdById` → SetNull** — Preserves invite links even after creator leaves; the link remains functional.
- **`beforeDelete` hook is the real safety net** — UI guard (disabled button) is defense-in-depth; the server-side hook prevents deletion even if the UI is bypassed.
- **`prisma migrate dev` now works** — After `migrate reset`, advisory lock issues from Prisma Postgres are resolved. Future schema changes should use `db:migrate`.
- **Unified profile form** — Replaced per-field save pattern with single form + single save button. Better UX (one action to save all changes) and simpler code (one `react-hook-form` instance).

**Files created:**

- `packages/types/src/validations.ts`

**Files modified:**

- `packages/db/prisma/schema.prisma` — Nullable `uploadedById` + `createdById` with SetNull, User relations
- `packages/auth/src/server.ts` — Added `deleteUser` config with email verification and sole-owner guard
- `packages/email/src/templates.ts` — Added `deleteAccountVerificationEmail()`
- `packages/email/src/index.ts` — Exported new template
- `apps/web/app/(authenticated)/settings/profile/page.tsx` — Server-side sole-ownership query
- `apps/web/app/(authenticated)/settings/profile/profile-content.tsx` — Unified profile form, delete account UI, removed broken role imports
- `apps/web/package.json` — Added `@repo/db` dependency
- `AGENTS.md` — Updated current state, session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 15 — 2026-02-10

**Focus:** Seasons page — list, create, edit, delete

**Completed:**

1. **Exported season validation types** — Added `CreateSeasonValues` and `UpdateSeasonValues` type exports to `packages/types/src/validations.ts` (previously schemas existed but had no exported inferred types).

2. **Seasons server component page** — `apps/web/app/(authenticated)/seasons/page.tsx`:
   - Async server component using `requireAuth()`, `getServerOrg()`, `getActiveMember()` from `../../lib/auth`
   - Fetches seasons from Elysia API via `GET /orgs/${orgId}/seasons` with cookie forwarding
   - Uses `Promise.all` for parallel data fetching (seasons + activeMember)
   - Passes `initialSeasons`, `role`, `activeOrgId` to client component

3. **Seasons client component** — `apps/web/app/(authenticated)/seasons/seasons-content.tsx`:
   - **Season list** — Each row shows: calendar icon, season name, date range (formatted), game count badge
   - **Create season dialog** — `react-hook-form` + `standardSchemaResolver(createSeasonSchema)`. Fields: name, start date, end date. Coach-only.
   - **Edit season dialog** — Opens from dropdown menu, pre-fills current values, resets on open. Coach-only.
   - **Delete season** — AlertDialog confirmation explaining games are preserved. Coach-only.
   - **Empty state** — Uses `<Empty>` component with different messages for coaches vs players
   - **Coach-gating** — Create button and per-row edit/delete actions only visible to coaches (`isCoachRole(role)`)
   - **Optimistic UI** — Created seasons prepended to list, updated seasons replaced in-place, deleted seasons removed immediately
   - Season rows are clickable (navigate to `/seasons/${seasonId}`) with keyboard support

**Key learnings:**

- **`standardSchemaResolver` not `zodResolver`** — The project uses Zod v4 which implements the Standard Schema interface. `@hookform/resolvers/zod` (`zodResolver`) is for Zod v3 and throws type errors with Zod v4. All existing forms in the project use `standardSchemaResolver` from `@hookform/resolvers/standard-schema`.

**Files created:**

- `apps/web/app/(authenticated)/seasons/page.tsx`
- `apps/web/app/(authenticated)/seasons/seasons-content.tsx`

**Files modified:**

- `packages/types/src/validations.ts` — Added `CreateSeasonValues` and `UpdateSeasonValues` type exports
- `AGENTS.md` — Updated current state (added Seasons page to Implemented, updated Placeholder/Incomplete), added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 16 — 2026-02-10

**Focus:** Invite flow fix, no-team UX overhaul

**Completed:**

1. **Fixed invite redirect chain** — Registration via invite link (`/invite?token=abc123`) now preserves the token through the entire email verification flow:
   - `register-form.tsx` passes `callbackURL: redirectTo` to `authClient.signUp.email()`
   - `packages/auth/src/server.ts` `sendVerificationEmail` extracts `callbackURL` from better-auth's `url` param and appends it as `&redirect=` to the verification page URL
   - `verify-email/page.tsx` and `verify-email-content.tsx` thread `redirect` param through to login link
   - Full chain: `/invite?token=abc` → register → verification email → verify page → login → `/invite?token=abc`

2. **Removed forced `/setup` redirect** — Users without a team are no longer force-redirected:
   - `apps/web/app/(authenticated)/layout.tsx` — Removed all `redirect("/setup")` calls, fetches org data conditionally
   - `apps/web/app/lib/auth.ts` — `requireAuthWithOrg()` returns `null` instead of redirecting when no active org
   - `apps/web/app/(authenticated)/components/nav-bar.tsx` — `orgName` and `activeOrgId` now `string | null`, added `requiresOrg` field to `NAV_LINKS`, Seasons/Roster hidden when no org, Team settings link conditional

3. **No-team dashboard** — Created `apps/web/app/(authenticated)/dashboard/no-team-dashboard.tsx`:
   - Welcome message with user name
   - Two cards: "Create a team" (links to `/setup`) and "Join a team" (paste invite URL, parse token, redirect to `/invite?token=...`)
   - Uses existing UI components from `@repo/ui`

4. **Shared `<NoTeamState>` component** — Created `apps/web/app/(authenticated)/components/no-team-state.tsx`:
   - Reusable empty state for org-dependent pages
   - Shows "No team selected" message with customizable description and link to dashboard

5. **Updated org-dependent pages to handle no-org gracefully:**
   - `seasons/page.tsx` — Shows `<NoTeamState>` instead of `return null`
   - `roster/page.tsx` — Shows `<NoTeamState>` instead of `return null`
   - `settings/team/page.tsx` — Shows `<NoTeamState>` instead of `redirect("/setup")`

**Key decisions:**

- **Invite URL parsing in no-team dashboard** — The "Join a team" card accepts a full URL (e.g., `http://localhost:3000/invite?token=abc`), parses the `token` param, and redirects to the invite page. This is simpler than calling the accept API directly and allows the existing invite flow to handle auth state.
- **Shared `<NoTeamState>` component** — Server component (no "use client"), uses `<Empty>` from `@repo/ui` for consistent empty state styling. Accepts optional `message` prop for page-specific messaging.
- **No redirect from team settings** — Previously redirected to `/setup` which was confusing. Now shows an informative empty state with a link back to the dashboard.

**Files created:**

- `apps/web/app/(authenticated)/dashboard/no-team-dashboard.tsx`
- `apps/web/app/(authenticated)/components/no-team-state.tsx`

**Files modified:**

- `apps/web/app/components/auth/register-form.tsx` — Passes `callbackURL` on signup
- `packages/auth/src/server.ts` — Extracts `callbackURL` from verification URL
- `apps/web/app/verify-email/page.tsx` — Reads and passes `redirect` param
- `apps/web/app/verify-email/verify-email-content.tsx` — Threads `redirect` to login link
- `apps/web/app/(authenticated)/layout.tsx` — Removed forced redirect, conditional org fetch
- `apps/web/app/(authenticated)/components/nav-bar.tsx` — Org-aware nav links
- `apps/web/app/lib/auth.ts` — `requireAuthWithOrg()` returns null instead of redirecting
- `apps/web/app/(authenticated)/dashboard/page.tsx` — Renders `<NoTeamDashboard>` when no org
- `apps/web/app/(authenticated)/seasons/page.tsx` — Shows `<NoTeamState>` when no org
- `apps/web/app/(authenticated)/roster/page.tsx` — Shows `<NoTeamState>` when no org
- `apps/web/app/(authenticated)/settings/team/page.tsx` — Shows `<NoTeamState>` instead of redirect
- `AGENTS.md` — Updated current state, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 17 — 2026-02-10

**Focus:** Ownership transfer implementation

**Completed:**

1. **Transfer ownership action in Team Settings** — `apps/web/app/(authenticated)/settings/team/team-content.tsx`:
   - Added "Transfer ownership" menu item in the member dropdown, visible only to the current owner, targeting non-owner members
   - Two-step transfer: (1) promote target to `"owner"` via `authClient.organization.updateMemberRole()`, (2) demote self to `"admin"` (coach)
   - Standalone `AlertDialog` controlled by `transferTarget` state (avoids dropdown closing issues)
   - Confirmation dialog explains: target becomes owner, current user becomes coach, only reversible by new owner
   - Loading state with `Spinner` during transfer
   - After success: updates `currentMemberRole` state to `"admin"`, clears transfer target, calls `reloadData()`
   - Error handling: if promote succeeds but demote fails, reloads data to reflect partial state

2. **Profile settings danger zone guidance** — `apps/web/app/(authenticated)/settings/profile/profile-content.tsx`:
   - Added "Go to Team Settings" link below the sole-owner warning message
   - Links to `/settings/team` so users know where to transfer ownership to unblock account deletion

**Key decisions:**

- **No custom API route needed** — `authClient.organization.updateMemberRole()` with `role: "owner"` works natively through better-auth's organization plugin. Only an existing owner can promote to owner.
- **Two-step transfer (promote + demote)** — Rather than atomic transfer, this uses two sequential `updateMemberRole` calls. If the second call fails, the org temporarily has two owners, which is a safe partial state.
- **Standalone AlertDialog** — Used controlled `open` prop instead of `AlertDialogTrigger` inside the dropdown menu. This prevents the dialog from closing when the dropdown unmounts.

**Files modified:**

- `apps/web/app/(authenticated)/settings/team/team-content.tsx` — Added transfer ownership action with AlertDialog
- `apps/web/app/(authenticated)/settings/profile/profile-content.tsx` — Added Team Settings link in sole-owner warning
- `AGENTS.md` — Updated Implemented section, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅
