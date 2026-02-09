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

The goal of FUDL is to provide flag football coaches and players with:

1. **Video Upload & Management** — Upload game footage, organize by team/game/season.
2. **AI Route Detection** — Automatically detect and classify receiver routes from video.
3. **Player Tracking** — Track individual player movements across frames.
4. **Game Analytics** — Provide stats, tendencies, and visualizations for game review.
5. **Team/Organization Management** — Multi-tenant org support (already scaffolded via better-auth).
6. **Real-time Processing Feedback** — Show job progress as videos are analyzed.

### Design Principles

- **Type-safe end-to-end:** Shared types in `@repo/types`, Zod validation for env/forms, Prisma for DB types.
- **Separation of concerns:** API server handles auth + job queuing, Python worker handles ML, web app handles presentation.
- **Progressive enhancement:** Start with polling for job status, evolve to SSE (endpoint already exists).
- **Monorepo cohesion:** Shared packages for UI, types, auth, DB, env — no code duplication.
- **Performance-first:** Follow Vercel React best practices (see Skills section).

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
- **Domain models synced to database** via `prisma db push` (Prisma Postgres doesn't support `migrate dev` advisory locks)
- **API CRUD routes for Season, Game, Video** — org-scoped REST endpoints with auth/membership checks
- **Next.js caching enabled** — `experimental: { useCache: true }` in `apps/web/next.config.ts` (Next.js 16 renamed `dynamicIO` to `useCache`)

### Placeholder / Incomplete

- `process_video()` in Python worker is a stub (returns empty results after 2s sleep)
- `video_frame.py` has incomplete OpenCV frame extraction
- No ML models for route detection implemented
- No file/video upload infrastructure (S3, cloud storage)
- No actual analytics dashboards or visualizations
- No web pages for domain models (game list, video upload, etc.)
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
- **`project-overview`** — LobeChat-specific project structure. Not directly applicable — use the FUDL-specific structure documented in this file instead.
- **`update-docs`** — Next.js documentation updater. Use if contributing to `apps/docs`.
- **`agent-md-refactor`** — For refactoring this `agents.md` file if it grows too large.

---

## Development Guidelines

### Frontend (apps/web)

- All pages currently use `"use client"` — evaluate whether Server Components can be leveraged for data fetching and initial page loads.
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
