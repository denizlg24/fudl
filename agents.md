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
- **Prisma schema with auth + org + domain models (14 tables):** User, Session, Account, Verification, Organization, Member, Invitation, InviteLink, Season, Game, Video, Tag, TagsOnGames, TagsOnVideos
- **Domain models (lean):** Season, Game, Video with `VideoStatus` enum (PENDING → UPLOADING → UPLOADED → PROCESSING → COMPLETED → FAILED); Tag with `TagCategory` enum (OPPONENT, FIELD, CAMERA_ANGLE, GENERAL)
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
- **Video upload system (full stack)** — S3 multipart upload with chunking, 4-concurrent-part uploads, retry with exponential backoff, resume support, cancel/abort. Backend: `UploadSession` model, 6 upload API endpoints (init, sign-part, complete-part, complete, abort, status), S3 helpers, BullMQ `video-processing` queue. Frontend: `UploadManager` class, `UploadStoreProvider` context with `useSyncExternalStore`, `extractVideoThumbnail` utility, upload page with 3-step flow (select files, game info, uploading), floating `UploadIndicator` widget.
- **Upload page** — `/upload` with drag-and-drop file selection, client-side thumbnail extraction, game creation or existing game selection, per-file upload progress. Coach-only access.
- **Nav bar Upload link** — Coach-only "Upload" link in the nav bar, visible when user has an active org and is a coach.
- **Dashboard upload integration** — All "Video upload coming soon" toast stubs replaced with actual navigation to `/upload` (header button, game card dropdown, empty state buttons, inline "Upload" links in no-footage game rows).
- **Games API includes videos relation** — `GET /orgs/:orgId/games` now returns `videos: [{ id, status, thumbnailUrl }]` alongside `_count`, so the dashboard can display footage status per game.
- **Dashboard auto-refresh after upload** — Dashboard detects when active upload count drops to 0 and re-fetches games from the API. Also syncs with server-rendered `initialGames` on navigation.
- **Upload indicator action buttons** — Per-entry cancel (active uploads), retry (failed uploads), and dismiss (completed/failed/cancelled) buttons. Global "clear all" when no uploads are active. Tooltips on all actions. No nested `<button>` elements (uses `<div role="button">`).
- **Upload store retry support** — `UploadEntry` stores the `File` reference. `retryUpload(videoId)` method re-invokes the upload manager with the stored file. Exposed via `useUploadActions()` hook. Upload state is ephemeral (session-only via React context) — no localStorage persistence.
- **No automatic job scheduling on upload** — Upload `/complete` endpoint finalizes the S3 multipart upload and sets video status to `UPLOADED`. No BullMQ job is queued — coaches will manually trigger analysis later.
- **Tag system (full stack)** — Categorized, org-scoped tags with `TagCategory` enum (`OPPONENT`, `FIELD`, `CAMERA_ANGLE`, `GENERAL`). `Tag` model with unique `[organizationId, category, name]` constraint. `TagsOnGames` and `TagsOnVideos` join tables for many-to-many relationships. API CRUD routes (`GET/POST/DELETE /orgs/:orgId/tags`) with lazy auto-seeding of default camera angle tags per org. Game and Video API routes accept `tagIds` on create/update with org validation. Tags flattened in all API responses. Old `opponent` field removed from Game model — opponents are now tags with `category=OPPONENT`.
- **TagCombobox component** — Reusable `Popover` + `Command` combobox for tag selection. Supports single and multi-select modes, lazy loading on popover open, create-on-fly for new tags, badge display for multi-select with remove buttons. Used across upload form for opponent, field, general tags, and per-video camera angles.
- **Upload form tag integration** — Upload form step 2 includes `TagCombobox` for opponent (single), field/location (single), general tags (multi), and per-video camera angle (single). Tag IDs passed to game and video create API calls. `GameOption` updated to use `tags[]` instead of `opponent` string.
- **Dashboard tag integration** — `GameData` interface updated to use `tags[]` instead of `opponent`. `GameCard` displays opponent tag name via `getOpponentName()` helper, falls back to game `title`. Delete confirmation dialog references opponent tag or title.
- **Upload race condition fix** — `/complete-part` endpoint uses a Prisma interactive transaction with `Serializable` isolation level and retry logic (up to 3 attempts with random backoff for `P2034` serialization conflicts). Ensures ACID properties for concurrent part uploads without raw SQL.
- **Games require a season (`seasonId` non-nullable)** — `Game.seasonId` changed from `String?` to `String`, `onDelete: Restrict`. Validation schemas updated. Upload form always requires season selection. Season deletion restricted when games exist. Dashboard `GameData.seasonId` is `string` (not nullable).
- **Thumbnail upload to S3** — New `uploadThumbnail()` helper in `apps/api/src/lib/s3.ts` using `PutObjectCommand`. New `POST /orgs/:orgId/videos/:videoId/upload/thumbnail` endpoint accepts file upload (JPEG/PNG/WebP, max 5MB), stores to S3 at `orgs/{orgId}/videos/{videoId}/thumbnail.jpg`, updates `thumbnailUrl`/`thumbnailKey` on Video record. Frontend fires thumbnail upload as fire-and-forget after video upload completes.
- **Next.js Image S3 support** — `apps/web/next.config.ts` has `images.remotePatterns` for `*.s3.*.amazonaws.com` and `*.s3.amazonaws.com` to allow `<Image>` component to render S3-hosted thumbnails.
- **Dashboard game grouping** — "Group by" `<Select>` dropdown with 4 options: No grouping, By season, By opponent, Season + opponent. Client-side `groupGames()` function with `GameGroup` interface, memoized via `useMemo`. Section headers with group label, game count badge, and divider line. "Both" mode groups by season first, then opponent within each season.
- **Game deletion cleans up S3 objects** — Game DELETE handler finds all associated videos, deletes their S3 objects via `deletePrefix()`, aborts in-progress multipart uploads, deletes upload sessions, then deletes all video records and the game in a Prisma batch transaction. No orphaned S3 objects or video records after game deletion.
- **Thumbnail upload fix** — Replaced Elysia's `t.File()` body parsing with manual `request.formData()` for thumbnail upload endpoint. Fixed silent error swallowing in frontend thumbnail fetch (now checks `res.ok` and logs errors). Fixed `retryUpload()` to include `onComplete` and `onError` callbacks.
- **Presigned URLs for all S3 objects** — S3 bucket is private; all access (thumbnails, video playback/download) uses presigned URLs. Upload stores only S3 keys (`storageKey`, `thumbnailKey`), never public URLs. Games and Videos API endpoints generate 1-hour presigned download URLs via `getSignedDownloadUrl()` when serving responses — both `thumbnailUrl` and `storageUrl` fields contain presigned URLs. Batch-signing avoids N+1 per-video overhead. No S3 bucket ACL or policy changes needed.
- **Game detail page with video player** — `/games/[gameId]` server component page with full video playback. **Footage/angle architecture:** Each `Video` record is a full-length footage file (entire game recording from a specific camera angle). Multiple footage files = multiple views of the same content, switchable via angle toggle. `Clip` records (time segments within footage, created by future AI analysis) are separate from footage files. Custom `usePlayer` hook wrapping HTML5 `<video>` API (play/pause, seek, volume, playback rate, fullscreen, buffered progress). `VideoPlayer` component with layered architecture: `<video>` → `<canvas>` overlay (pointer-events: none, ready for future drawing/annotation) → click interaction layer → auto-hiding controls (3s timeout). `PlayerControls` with seek bar (buffer indicator), camera angle switcher (syncs playback time across angles via `pendingSeekRef`), playback speed (0.25x–2x), volume popover with vertical slider. Full keyboard shortcuts: Space/K (play/pause), J/L/arrows (skip ±5s), Shift+arrows (reserved for future clip nav), Up/Down (volume), M (mute), F (fullscreen). `GameSidebar` with three collapsible sections: game directory (all org games grouped by opponent/season/both/none), footage list (uploaded angles with active highlighting, click to switch), and clips (empty state — clips will appear when footage is analyzed). Desktop: sidebar always visible (w-80, right side). Mobile: sidebar renders vertically below the 16:9 video player (no Sheet overlay). Game switching via full page navigation. Camera angle indicator always visible in controls when angles exist.
- **Games API enhancements** — `GET /orgs/:orgId/games/:gameId` now returns presigned `thumbnailUrl` and `storageUrl` for each video, plus per-video `tags` (for camera angle detection). `GET /orgs/:orgId/games` supports `?tagId=` query filter for filtering by any tag (enables sidebar opponent filtering).
- **Season detail page** — `/seasons/[seasonId]` async server component page with full game list. Enhanced `GET /orgs/:orgId/seasons/:seasonId` API endpoint returns games with videos, tags, and batch-signed presigned thumbnail URLs (same shape as the games list endpoint). Back link to `/seasons`, season header with name/date range/calendar icon, edit/delete actions (coach-only, delete restricted when games exist), stats bar (game count, footage files, analyzed count), game list with thumbnails/opponent/date/video status, group-by-opponent selector, delete game support with S3 cleanup, auto-refresh after uploads complete, empty state for coaches vs players.
- **Manual clip cutting system (full stack)** — Coaches can create, edit, and delete time-segmented clips from game footage. `Clip` model CRUD via REST API (`GET/POST/PATCH/DELETE /orgs/:orgId/clips`). Validation schemas (`createClipSchema`, `updateClipSchema`) in `@repo/types/validations`. Coach-only write operations via `isCoach` middleware; all members can read/play clips. **Mark-in/mark-out UI** in video player: `ClipMarkControls` component with `[` / `]` buttons (keyboard: `I` for mark-in, `O` for mark-out), `Scissors` save button opens `ClipCreateDialog` with time fine-tune, labels. **Seek bar indicators**: green/red lines for mark positions, translucent range preview, existing clip ranges shown as muted bars (active clip highlighted). **Clip playback**: selecting a clip seeks to `startTime`, auto-pauses at `endTime`, `Escape` exits clip mode, seeking outside clip range exits clip mode. **Clip navigation**: `Shift+Left/Right` arrows navigate between plays. **ClipList** in sidebar: groups by `playNumber`, shows "Play N" with angle count badges, time ranges, duration, label badges (max 3 + overflow), coach-only dropdown with edit/delete actions. **ClipEditDialog** for updating clip details. **Delete confirmation** via `AlertDialog`. Optimistic UI updates for create/update/delete. `metadata.source = "manual"` set automatically for manual clips (AI worker will use `"ai"`). Clips fetched in parallel on game detail page server component.
- **Play-scoped clip system (multi-angle)** — Clips are "plays" auto-numbered (Play 1, Play 2, ...) with no custom titles. `playNumber` field on Clip model with `@@unique([videoId, playNumber])` constraint (one clip per angle per play). **Play-scoped control bar**: when a play is active, seek bar shows only that play's duration (0 to clipDuration), time display shows clip-relative time, skip ±5s clamped to play boundaries, mark controls hidden. **Multi-angle plays**: same play number can have clips on different footage files with different time ranges. Selecting a play prefers the variant on the current angle, falls back to first available. Switching angles during play mode loads the clip variant for the new angle. **Smart play number selector**: `ClipCreateDialog` defaults to `clipsOnThisAngle.length + 1`, shows existing plays without a clip on the current angle as options. **Prev/next play navigation**: SkipBack/SkipForward buttons in clip mode, `Shift+Left/Right` keyboard shortcuts. **Play list**: groups clips by `playNumber`, shows one row per play with angle count indicator, deleting a play removes ALL angle variants. API enforces uniqueness (409 Conflict for duplicate `videoId + playNumber`).

### Placeholder / Incomplete

- `process_video()` in Python worker is a stub (returns empty results after 2s sleep)
- `video_frame.py` has incomplete OpenCV frame extraction
- No ML models for route detection implemented
- No actual analytics dashboards or visualizations
- No video list/management page (videos are accessed through game detail page)
- Season detail page exists but has no season-specific analytics or visualizations yet
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
- [x] Build video upload flow (file upload endpoint, cloud storage integration — S3 or similar)
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

- [x] Build game review interface with video playback + route overlays
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

### Session 18 — 2026-02-11

**Focus:** Wire up video upload frontend — nav bar, layout, and dashboard integration

**Completed:**

1. **Nav bar Upload link** — `apps/web/app/(authenticated)/components/nav-bar.tsx`:
   - Added `coachOnly?: boolean` field to `NAV_LINKS` type
   - Added `{ href: "/upload", label: "Upload", requiresOrg: true, coachOnly: true }` entry
   - `NavLinks` component now accepts a `role: string | null` prop
   - Coach-only links filtered out for non-coach users via `isCoachRole()` from `@repo/types`
   - `NavBarProps` interface extended with `role: string | null`

2. **Authenticated layout** — `apps/web/app/(authenticated)/layout.tsx`:
   - Added `getActiveMember()` to the parallel fetch alongside `getServerOrg()` and `listUserOrgs()`
   - Extracts `role` from active member and passes to `<NavBar>`
   - Wraps children with `<UploadStoreProvider>` for global upload state
   - Renders `<UploadIndicator>` floating widget inside the provider

3. **Dashboard upload integration** — `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx`:
   - Replaced all `toast.info("Video upload coming soon.")` stubs with actual navigation:
     - Header "Upload video" button → `router.push("/upload")`
     - GameCard dropdown "Upload video" → `router.push("/upload?gameId=${game.id}")`
     - Empty state "Upload video" button → `router.push("/upload")`
     - Empty state "Create a game" button → `router.push("/upload")`
   - `VideoStatusLine` "Upload" inline link (no-footage games) → `<Link href="/upload?gameId=${gameId}">` with `stopPropagation` to prevent game card click
   - Added `gameId` prop to `VideoStatusLine` component
   - Added `Link` import from `next/link`

**Files modified:**

- `apps/web/app/(authenticated)/components/nav-bar.tsx` — Added Upload link, role prop, coach-only filtering
- `apps/web/app/(authenticated)/layout.tsx` — UploadStoreProvider, UploadIndicator, role prop
- `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx` — Replaced toast stubs with upload navigation

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 19 — 2026-02-11

**Focus:** Fix remaining upload flow bugs — games API, dashboard refresh, video status, upload indicator actions

**Completed:**

1. **Games API includes videos relation** — `apps/api/src/routes/v1/games/routes.ts`:
   - `GET /orgs/:orgId/games` now includes `videos: { select: { id: true, status: true, thumbnailUrl: true }, orderBy: { createdAt: "desc" } }` alongside the existing `_count`
   - Dashboard can now display footage status, thumbnails, and clip counts per game

2. **Dashboard auto-refresh after upload** — `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx`:
   - Added `reloadGames()` function that re-fetches games from the API client-side
   - Added `useActiveUploadCount()` hook from upload store to detect when uploads finish
   - Uses `useRef` to track previous active count — when it transitions from >0 to 0, triggers `reloadGames()`
   - Also syncs with server-rendered `initialGames` via `useEffect` so `router.refresh()` propagates

3. **Video status interim fix** — `apps/api/src/routes/v1/uploads/routes.ts`:
   - Upload `/complete` endpoint now keeps video status as `UPLOADED` instead of transitioning to `PROCESSING`
   - Still queues the BullMQ job and stores the `jobId` on the video record
   - The worker will handle `UPLOADED` -> `PROCESSING` -> `COMPLETED` transitions when implemented
   - This prevents videos from being permanently stuck in `PROCESSING` with the stub worker

4. **Upload store retry support** — `apps/web/app/lib/upload-store.tsx`:
   - `UploadEntry` now includes a `file: File` field storing the original file reference
   - `startUpload()` stores the file immediately on the entry before invoking the upload manager
   - `updateProgress()` preserves the existing file reference when updating progress
   - Added `retryUpload(videoId)` method: retrieves stored file, re-invokes `uploadManager.upload()` with resume support
   - Exposed `retryUpload` via `useUploadActions()` hook

5. **Upload indicator action buttons** — `apps/web/app/(authenticated)/components/upload-indicator.tsx`:
   - **Cancel** button on active uploads (uploading/initializing/completing) — calls `cancelUpload(orgId, videoId)`
   - **Retry** button on failed uploads — calls `retryUpload(videoId)` with stored file reference
   - **Dismiss** button on completed/failed/cancelled entries — calls `dismissUpload(videoId)`
   - **Clear all** button in header — visible when no uploads are active, dismisses all entries
   - All action buttons use `<div role="button">` via `RowAction` component to avoid nested `<button>` hydration warnings
   - Tooltips on all actions via `@repo/ui/components/tooltip`
   - Status icons: `Check` (completed), `AlertCircle` (failed), `Ban` (cancelled), percentage (active)

**Key decisions:**

- **`UPLOADED` not `PROCESSING` after upload** — Since the Python worker is a stub, setting status to `PROCESSING` creates a permanently stuck state. `UPLOADED` is the correct intermediate status — the dashboard's `VideoStatusLine` handles it naturally (shows clip count without "AI analysis complete" badge).
- **File reference in UploadEntry** — Storing `File` in the store is just a JS object reference (not a copy of file data). This enables retry without asking the user to re-select the file. The reference persists as long as the upload entry exists.
- **`useRef` for previous count tracking** — Avoids the `useEffect` pitfall of using state for previous value tracking, which would cause unnecessary re-renders.

**Files modified:**

- `apps/api/src/routes/v1/games/routes.ts` — Added `videos` relation to list query
- `apps/api/src/routes/v1/uploads/routes.ts` — Changed `/complete` to keep status as `UPLOADED`
- `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx` — Added auto-refresh after uploads, initialGames sync
- `apps/web/app/lib/upload-store.tsx` — Added `file` to UploadEntry, `retryUpload` method, exposed in hook
- `apps/web/app/(authenticated)/components/upload-indicator.tsx` — Added per-entry action buttons (cancel, retry, dismiss), tooltips

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 20 — 2026-02-11

**Focus:** Tag system — full-stack categorized tagging for games and videos

**Completed:**

1. **Database schema** — Added `TagCategory` enum (`OPPONENT`, `FIELD`, `CAMERA_ANGLE`, `GENERAL`), `Tag` model with unique `[organizationId, category, name]` constraint, `TagsOnGames` and `TagsOnVideos` join tables. Removed `opponent` field from `Game` model. Schema pushed via `prisma db push`.

2. **Tag API routes** — `apps/api/src/routes/v1/tags/routes.ts`:
   - `GET /orgs/:orgId/tags?category=X` — List/search with lazy auto-seeding of default camera angle tags per org
   - `POST /orgs/:orgId/tags` — Create (idempotent: returns existing if name+category+org already exists)
   - `DELETE /orgs/:orgId/tags/:tagId` — Delete with cascade to join tables

3. **Game & Video API updates** — Both routes now accept `tagIds` on create/update, validate tag org ownership, include tags in all responses (flattened from join tables via `.map(entry => entry.tag)`).

4. **Validation schema updates** — `packages/types/src/validations.ts`: Removed `opponent` from game schemas, added `tagIds: z.array(z.string()).optional()` to game and video schemas.

5. **TagCombobox component** — `apps/web/app/(authenticated)/components/tag-combobox.tsx`:
   - Composes `Popover` + `Command` from `@repo/ui`
   - Fetches tags on popover open (lazy loading), filtered by category
   - "Create [query]" option when search has no exact match
   - Multi-select mode with badges + remove buttons, single-select mode with auto-close

6. **Upload form tag integration** — `upload-content.tsx`:
   - Opponent (single), field/location (single), general tags (multi) via `TagCombobox`
   - Per-video camera angle (single) via `TagCombobox`
   - Tag IDs passed to game and video create API calls
   - `GameOption` updated to use `tags[]` instead of `opponent`

7. **Dashboard tag integration** — `dashboard-content.tsx`:
   - `GameData` interface: removed `opponent`, added `title` and `tags: TagData[]`
   - `getOpponentName()` helper finds `OPPONENT` category tag
   - `GameCard` shows `vs. {opponent}` or falls back to `game.title`
   - Delete confirmation dialog references opponent tag or game title

8. **Fixed spread type error** — `apps/api/src/routes/v1/tags/routes.ts`: Replaced `...(query.category && { category })` spread (which TypeScript rejects for union types) with explicit `where` object construction.

**Key decisions:**

- **`opponent` field removed** — Opponents are now tags with `category=OPPONENT`. This unifies the tagging model and enables reuse (same opponent across multiple games without string typos).
- **Camera angles are per-video** — Different clips of the same game can have different angles, so camera angle tags attach to `TagsOnVideos`, not `TagsOnGames`.
- **Lazy auto-seeding** — Default camera angle tags (Front View, Side View, End Zone, Press Box, Aerial/Drone) are created per-org on first `GET /tags` call that includes `CAMERA_ANGLE` category.
- **Idempotent tag creation** — `POST /tags` with an existing name+category+org returns the existing tag instead of erroring. This simplifies the "create on fly" UX in the combobox.

**Files created:**

- `apps/api/src/routes/v1/tags/routes.ts`
- `apps/api/src/routes/v1/tags/index.ts`
- `apps/web/app/(authenticated)/components/tag-combobox.tsx`

**Files modified:**

- `packages/db/prisma/schema.prisma` — Added Tag, TagsOnGames, TagsOnVideos models; removed `opponent` from Game
- `apps/api/src/routes/v1/index.ts` — Wired tagRoutes
- `apps/api/src/routes/v1/games/routes.ts` — Removed opponent, added tagIds, includes tags
- `apps/api/src/routes/v1/videos/routes.ts` — Added tagIds, includes tags
- `packages/types/src/validations.ts` — Removed opponent, added tagIds to game/video schemas
- `apps/web/app/(authenticated)/upload/upload-content.tsx` — Tag comboboxes for all categories
- `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx` — GameData interface + GameCard tag display

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 21 — 2026-02-11

**Focus:** Tag system (full stack), upload race condition fix, games require season (seasonId non-nullable)

**Completed:**

1. **Tag system — database schema** — Added `TagCategory` enum (`OPPONENT`, `FIELD`, `CAMERA_ANGLE`, `GENERAL`), `Tag` model with unique `[organizationId, category, name]` constraint, `TagsOnGames` and `TagsOnVideos` join tables. Removed `opponent` field from `Game` model. Schema pushed via `prisma db push`.

2. **Tag API routes** — `apps/api/src/routes/v1/tags/routes.ts`:
   - `GET /orgs/:orgId/tags?category=X` — List/search with lazy auto-seeding of default camera angle tags per org
   - `POST /orgs/:orgId/tags` — Create (idempotent: returns existing if name+category+org already exists)
   - `DELETE /orgs/:orgId/tags/:tagId` — Delete with cascade to join tables

3. **Game & Video API updates** — Both routes now accept `tagIds` on create/update, validate tag org ownership, include tags in all responses (flattened from join tables via `.map(entry => entry.tag)`). Removed `opponent` from game routes.

4. **Validation schema updates** — `packages/types/src/validations.ts`: Removed `opponent` from game schemas, added `tagIds: z.array(z.string()).optional()` to game and video schemas.

5. **TagCombobox component** — `apps/web/app/(authenticated)/components/tag-combobox.tsx`: Reusable `Popover` + `Command` combobox for tag selection. Supports single and multi-select modes, lazy loading on popover open, create-on-fly for new tags, badge display for multi-select with remove buttons.

6. **Upload form tag integration** — Upload form step 2 includes `TagCombobox` for opponent (single), field/location (single), general tags (multi), and per-video camera angle (single). Tag IDs passed to game and video create API calls. `GameOption` updated to use `tags[]` instead of `opponent` string.

7. **Dashboard tag integration** — `GameData` interface updated to use `tags[]` instead of `opponent`. `GameCard` displays opponent tag name via `getOpponentName()` helper, falls back to game `title`. Delete confirmation dialog references opponent tag or title.

8. **Upload race condition fix** — `/complete-part` endpoint in `apps/api/src/routes/v1/uploads/routes.ts` replaced Prisma `$transaction` read-modify-write with raw SQL atomic `jsonb` array append (`UPDATE ... SET "completedParts" = "completedParts" || ...::jsonb`) with a `NOT ... @> ...` idempotency check. Prevents concurrent part uploads from overwriting each other.

9. **Games require a season (`seasonId` non-nullable)** — Full-stack change:
   - Schema: `Game.seasonId` changed from `String?` to `String`, `onDelete: Restrict`. Pushed via `prisma db push --force-reset`.
   - Validation schemas: `createGameSchema.seasonId` is now required (`z.string().min(1, "Season is required")`).
   - Game API POST: `seasonId` is required, always validated against org.
   - Season API DELETE: Added restrict-delete logic — returns 400 if season has games.
   - Dashboard: `GameData.seasonId` changed from `string | null` to `string`.
   - Upload form: Season field always shown, "Start upload" button disabled when no seasons exist. Removed "No season" option.
   - Seasons page: Delete button disabled when season has games, confirmation dialog text is dynamic.

**Key decisions:**

- **`opponent` replaced by tag** — Opponents are now tags with `category=OPPONENT`. Unifies tagging model, enables reuse across games without string typos.
- **Camera angles are per-video** — Different clips of the same game can have different angles, so camera angle tags attach to `TagsOnVideos`, not `TagsOnGames`.
- **Lazy auto-seeding** — Default camera angle tags (Front View, Side View, End Zone, Press Box, Aerial/Drone) created per-org on first `GET /tags` call with `CAMERA_ANGLE` category.
- **Idempotent tag creation** — `POST /tags` with existing name+category+org returns the existing tag. Simplifies "create on fly" UX.
- **Raw SQL for race condition** — Prisma `$transaction` with read-modify-write is not atomic for JSON array appends under concurrency. Raw SQL `||` operator with `@>` idempotency check is the correct approach.
- **`onDelete: Restrict` for Season→Game** — Prevents accidental data loss. Users must move/delete games before deleting a season.
- **`prisma db push --force-reset`** — Required because making `seasonId` non-nullable fails with existing NULL values. Acceptable in dev (all data is lost).

**Key learnings:**

- **Elysia `t` name collision** — When mapping over arrays in Elysia route handlers, the callback parameter cannot be named `t` because it shadows Elysia's `t` import (typebox). Use `entry` instead.
- **TypeScript spread type error with unions** — `...(condition && { key: value })` fails when the conditional expression produces a union type. Use explicit `if` statement with object mutation instead.
- **Prisma `db push` limitations** — Making a nullable column non-nullable requires `--force-reset` (drops and recreates DB) when existing NULL values exist. `--accept-data-loss` is not sufficient.

**Files created:**

- `apps/api/src/routes/v1/tags/routes.ts`
- `apps/api/src/routes/v1/tags/index.ts`
- `apps/web/app/(authenticated)/components/tag-combobox.tsx`

**Files modified:**

- `packages/db/prisma/schema.prisma` — Added Tag system models, removed `opponent` from Game, made `seasonId` non-nullable with `onDelete: Restrict`
- `apps/api/src/routes/v1/index.ts` — Wired tagRoutes
- `apps/api/src/routes/v1/games/routes.ts` — Removed opponent, added tagIds, includes tags, seasonId required
- `apps/api/src/routes/v1/videos/routes.ts` — Added tagIds, includes tags
- `apps/api/src/routes/v1/uploads/routes.ts` — Fixed race condition in complete-part with raw SQL
- `apps/api/src/routes/v1/seasons/routes.ts` — Added restrict-delete logic
- `packages/types/src/validations.ts` — Removed opponent, added tagIds, made seasonId required
- `apps/web/app/(authenticated)/upload/upload-content.tsx` — Tag comboboxes for all categories, season required
- `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx` — GameData uses tags[], seasonId non-nullable
- `apps/web/app/(authenticated)/seasons/seasons-content.tsx` — Restrict-delete UX

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 22 — 2026-02-11

**Focus:** Replace raw SQL with Prisma transaction for upload race condition, create proper migration for tag system

**Completed:**

1. **Replaced raw SQL with Prisma interactive transaction** — `apps/api/src/routes/v1/uploads/routes.ts` `/complete-part` endpoint:
   - Removed raw SQL `$executeRaw` with `jsonb` array append
   - Replaced with Prisma `$transaction()` using `Serializable` isolation level
   - Transaction reads current `completedParts`, checks idempotency (part already recorded?), appends the new part, and updates `uploadedBytes` atomically
   - Retry logic: up to 3 attempts for `P2034` serialization conflicts with random exponential backoff (`Math.random() * 50 * attempt` ms)
   - `maxWait: 5000` (wait for transaction slot), `timeout: 10000` (transaction timeout)
   - Ensures ACID properties without bypassing Prisma's type safety

2. **Created proper migration for tag system + seasonId changes** — `packages/db/prisma/migrations/20260211180000_tag_system_and_season_required/migration.sql`:
   - Previously these schema changes were applied via `prisma db push --force-reset` without migration files
   - Resolved migration history drift: marked all 4 existing migrations as applied (they were orphaned after `db push --force-reset` wiped the `_prisma_migrations` table)
   - Created migration SQL covering: `TagCategory` enum, `tag`/`tags_on_games`/`tags_on_videos` tables with indexes and foreign keys, `game.opponent` column drop, `game.seasonId` nullable→required with FK change from `SET NULL` to `RESTRICT`
   - Marked migration as applied via `prisma migrate resolve --applied`
   - Verified: `prisma migrate status` shows "Database schema is up to date!", `prisma migrate diff` shows empty diff

**Key decisions:**

- **Serializable isolation over raw SQL** — While raw SQL `jsonb ||` was atomic at the SQL level, it bypassed Prisma's type system and wouldn't work with non-PostgreSQL databases. The Serializable transaction approach is database-agnostic, type-safe, and handles concurrency through PostgreSQL's built-in serialization conflict detection.
- **P2034 retry pattern** — Serializable transactions can fail with `P2034` when concurrent transactions conflict. Retry with random backoff (up to 3 attempts) is the standard Prisma pattern for handling this. With 4 concurrent part uploads, at most 1-2 retries are expected per request.
- **Migration resolution via `migrate resolve`** — Since the DB was already in the correct state from `db push`, creating the migration file and marking it as applied (without re-running the SQL) was the correct approach. This brings the migration history back in sync with the actual DB state.

**Key learnings:**

- **`prisma migrate resolve --applied`** — When `db push` has been used and you need to bring migration history back in sync, use `migrate resolve --applied <migration_name>` to mark migrations as already applied without re-running their SQL.
- **`prisma migrate diff --from-config-datasource --to-schema`** — Useful for checking drift between the live database and the schema file. Returns "empty migration" when everything is in sync.
- **Prisma interactive transactions with adapters** — The `@prisma/adapter-pg` adapter supports Serializable isolation level transactions. The `isolationLevel` option is passed directly to the transaction options object.

**Files created:**

- `packages/db/prisma/migrations/20260211180000_tag_system_and_season_required/migration.sql`

**Files modified:**

- `apps/api/src/routes/v1/uploads/routes.ts` — Replaced raw SQL with Prisma Serializable transaction + retry logic
- `AGENTS.md` — Updated Implemented section, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 23 — 2026-02-11

**Focus:** Thumbnail upload to S3, Next.js Image config, dashboard game grouping

**Completed:**

1. **Thumbnail upload to S3** — `apps/api/src/lib/s3.ts` + `apps/api/src/routes/v1/uploads/routes.ts`:
   - Added `PutObjectCommand` import to S3 helpers
   - New `uploadThumbnail(key, body, contentType)` helper using `PutObjectCommand`
   - New `POST /orgs/:orgId/videos/:videoId/upload/thumbnail` endpoint: accepts `t.File()` body (JPEG/PNG/WebP, max 5MB), validates video ownership + org membership, uploads to S3 at `orgs/{orgId}/videos/{videoId}/thumbnail.jpg`, updates `thumbnailUrl` and `thumbnailKey` on Video record
   - Returns the S3 URL in the response

2. **Frontend thumbnail upload** — `apps/web/app/(authenticated)/upload/upload-content.tsx`:
   - Modified `onComplete` callback to POST the extracted thumbnail blob via `FormData` to the new `/upload/thumbnail` endpoint
   - Fire-and-forget: thumbnail upload failures don't block or fail the video upload
   - Uses the `thumbnailBlob` already extracted during file selection via `extractVideoThumbnail()`

3. **Next.js Image S3 support** — `apps/web/next.config.ts`:
   - Added `images.remotePatterns` array with two entries:
     - `*.s3.*.amazonaws.com` (regional S3 URLs)
     - `*.s3.amazonaws.com` (legacy S3 URLs)
   - Enables `<Image>` component to render S3-hosted thumbnails without "hostname not configured" errors

4. **Dashboard game grouping** — `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx`:
   - Added `GroupBy` type: `"none" | "season" | "opponent" | "both"`
   - Added `GameGroup` interface: `{ label: string; games: GameData[] }`
   - Added `groupGames(games, groupBy)` function implementing 4 grouping strategies:
     - `none`: single group with all games
     - `season`: groups by `season.name`, sorted alphabetically
     - `opponent`: groups by opponent tag name (falls back to "No opponent")
     - `both`: groups by season first, then opponent within season (label format: "Season — vs. Opponent")
   - Added "Group by" `<Select>` dropdown in the dashboard header (next to existing season filter)
   - Groups memoized via `useMemo` with `[games, groupBy]` deps
   - Section headers render group label + game count `<Badge>` + `<Separator>` divider
   - `Layers` icon from lucide-react for the group-by selector

**Key decisions:**

- **Fire-and-forget thumbnail upload** — Thumbnail upload is best-effort. If it fails, the video record simply has no thumbnail. The dashboard already handles null `thumbnailUrl` gracefully (shows a placeholder). This avoids blocking the upload completion flow.
- **Client-side grouping** — All data needed for grouping (season name, opponent tags) is already returned by the Games API. No additional API calls or server-side logic needed. `useMemo` prevents re-grouping on every render.
- **"Both" grouping format** — Uses "Season Name — vs. Opponent" label to clearly indicate the two-level grouping in a flat section list. Alternative approaches (nested accordion, tree view) were considered but rejected for simplicity.

**Files modified:**

- `apps/api/src/lib/s3.ts` — Added `PutObjectCommand` import, `uploadThumbnail()` helper
- `apps/api/src/routes/v1/uploads/routes.ts` — Added `POST /thumbnail` endpoint
- `apps/web/app/(authenticated)/upload/upload-content.tsx` — Thumbnail upload in `onComplete` callback
- `apps/web/next.config.ts` — Added `images.remotePatterns` for S3 domains
- `apps/web/app/(authenticated)/dashboard/dashboard-content.tsx` — GroupBy type, groupGames function, group-by Select UI, section headers
- `AGENTS.md` — Updated Implemented section, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 24 — 2026-02-11

**Focus:** Fix thumbnail upload system — diagnose why thumbnails never reach S3, fix silent error swallowing, fix retry flow

**Problem:** Video thumbnails are extracted client-side during upload but never appear in S3 or the database. The video files themselves upload successfully. The S3 bucket only contains video files, not thumbnails.

**Completed:**

1. **Diagnosed root cause** — The original thumbnail upload `fetch()` in `upload-content.tsx` had a `.catch(() => {})` that silently swallowed ALL errors. The `.then()` handler also never checked `response.ok`, so HTTP 400/500 responses from the API were treated as success. This made the failure completely invisible.

2. **Added client-side error logging** — `apps/web/app/(authenticated)/upload/upload-content.tsx`:
   - The `.then()` now checks `res.ok` and logs HTTP status + response body via `console.error` on failure
   - The `.catch()` now logs network errors via `console.error` instead of silently ignoring them

3. **Replaced Elysia `t.File()` body parsing with manual FormData** — `apps/api/src/routes/v1/uploads/routes.ts`:
   - Elysia's `t.File()` body validation was likely rejecting the multipart upload silently (returning 400 "Validation failed")
   - Replaced with manual `request.formData()` parsing: reads raw request, calls `formData.get("file")`, validates manually (instanceof Blob, size check, content type)
   - Removed `body` schema entirely from the route config — only `params` schema remains
   - Added `console.log` debug statements at received/uploading/success stages for diagnosis

4. **Fixed `retryUpload()` missing callbacks** — `apps/web/app/lib/upload-store.tsx`:
   - Previously `retryUpload()` only passed `onProgress` to `uploadManager.upload()` — no `onComplete` or `onError`
   - This meant retried uploads never triggered thumbnail upload and never logged errors
   - Now passes `onComplete` callback that re-extracts thumbnail from stored `File` via `extractVideoThumbnail()` and uploads to S3
   - Now passes `onError` callback that logs the failure
   - Added imports for `extractVideoThumbnail` and `clientEnv`

**Key decisions:**

- **Manual FormData parsing over `t.File()`** — Elysia's `t.File()` relies on internal multipart parsing that may have compatibility issues with browser-generated FormData. Manual `request.formData()` is the standard Web API and works reliably across all runtimes.
- **Debug logging retained** — The `console.log` statements in the thumbnail endpoint should be removed after confirming the fix works end-to-end in a manual test.
- **Thumbnail re-extraction on retry** — Since the `UploadEntry` stores the `File` reference but not the thumbnail blob, `retryUpload` re-runs `extractVideoThumbnail()` from the stored file on completion. This is slightly slower than caching the blob but avoids storing large blobs in the store indefinitely.

**Files modified:**

- `apps/api/src/routes/v1/uploads/routes.ts` — Replaced `t.File()` body with manual `request.formData()` parsing, added debug logging
- `apps/web/app/(authenticated)/upload/upload-content.tsx` — Added `res.ok` check and `console.error` logging to thumbnail fetch
- `apps/web/app/lib/upload-store.tsx` — Fixed `retryUpload()` to include `onComplete` (with thumbnail upload) and `onError` callbacks

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 25 — 2026-02-11

**Focus:** Fix game deletion to clean up S3 objects, thumbnail upload fixes, presigned URLs for S3 thumbnails

**Completed:**

1. **Game deletion S3 cleanup** — `apps/api/src/routes/v1/games/routes.ts`:
   - Previously, `DELETE /orgs/:orgId/games/:gameId` did a bare `prisma.game.delete()` — due to `onDelete: SetNull` on Video.gameId, videos were orphaned with their S3 objects (video files, thumbnails) left in the bucket forever
   - Now finds all videos associated with the game, cleans up each video's S3 objects via `deletePrefix(getVideoPrefix(...))`, aborts in-progress multipart uploads, deletes upload sessions
   - Deletes all video records + the game in a Prisma batch `$transaction` to ensure atomicity
   - S3 cleanup failures are caught and don't block the deletion (same pattern as video DELETE handler)
   - Added imports for `deletePrefix`, `getVideoPrefix`, `abortMultipartUpload` from `../../../lib/s3`

2. **Thumbnail upload endpoint fix** — `apps/api/src/routes/v1/uploads/routes.ts`:
   - Restored `body: t.Object({ file: t.File() })` schema — the previous manual `request.formData()` approach caused "Body already used" error because Elysia consumes the request body stream before the handler runs
   - Handler now accesses `body.file` directly (Elysia-parsed)
   - No longer stores `thumbnailUrl` (public URL) — only stores `thumbnailKey` (S3 key)

3. **Presigned URLs for S3 thumbnails** — Fixed 403 Forbidden on thumbnail images:
   - Root cause: S3 objects are private by default, and the app was storing/serving direct public URLs that require either ACLs or bucket policies
   - Games API (`GET /orgs/:orgId/games`) now selects `thumbnailKey` instead of `thumbnailUrl`, generates 1-hour presigned download URLs via `getSignedDownloadUrl()` for each video with a thumbnail
   - Videos API (`GET /orgs/:orgId/videos` and `GET /orgs/:orgId/videos/:videoId`) also generate presigned URLs from `thumbnailKey`
   - Frontend unchanged — `thumbnailUrl` field in API responses now contains a presigned URL instead of a public URL
   - No S3 bucket ACL or policy changes needed

**Key decisions:**

- **`Promise.all` for parallel S3 cleanup** — Each video's S3 cleanup runs in parallel since they're independent operations. This is much faster than sequential cleanup for games with many videos.
- **Batch `$transaction` for DB deletes** — `prisma.video.deleteMany({ where: { gameId } })` + `prisma.game.delete()` run atomically. If either fails, neither is committed.
- **Presigned URLs over public ACLs** — Presigned URLs work with any S3 bucket configuration (no ACL/policy changes). 1-hour TTL is long enough for page viewing but short enough for security. The dashboard re-fetches games on navigation, so expired URLs are naturally refreshed.
- **`t.File()` body schema restored** — The "Body already used" error confirmed that Elysia always consumes the request body internally. Using Elysia's native `t.File()` parsing is the correct approach — the original silent failure was caused by the frontend's `.catch(() => {})` swallowing errors, not by `t.File()` itself.

**Files modified:**

- `apps/api/src/routes/v1/games/routes.ts` — Added S3 imports (`getSignedDownloadUrl`), rewrote DELETE handler with S3 cleanup, games list generates presigned thumbnail URLs
- `apps/api/src/routes/v1/videos/routes.ts` — Added `getSignedDownloadUrl` import, list and detail endpoints generate presigned thumbnail URLs
- `apps/api/src/routes/v1/uploads/routes.ts` — Restored `t.File()` body schema, stores only `thumbnailKey` (not `thumbnailUrl`)
- `AGENTS.md` — Updated Implemented section, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 26 — 2026-02-12

**Focus:** Fix 4 consistency/cleanup issues — presigned URLs for videos, localStorage removal, remove auto job scheduling, thumbnail validation

**Completed:**

1. **Presigned URLs for video playback** — `apps/api/src/routes/v1/videos/routes.ts` and `apps/api/src/routes/v1/uploads/routes.ts`:
   - Video list endpoint now batch-signs both `thumbnailKey` and `storageKey` S3 keys, returning presigned URLs in `thumbnailUrl` and `storageUrl` response fields
   - Video detail endpoint generates presigned `storageUrl` from `storageKey` (was previously only doing thumbnails)
   - Upload `/complete` endpoint no longer stores a public URL in `storageUrl` — the `storageKey` (set during `/init`) is the only S3 reference needed; presigned URLs are generated on read
   - Deprecated `getPublicUrl()` helper in `apps/api/src/lib/s3.ts` with JSDoc `@deprecated` tag
   - Removed `CacheControl: "public, ..."` from `uploadThumbnail()` since bucket is private

2. **Removed localStorage persistence** — `apps/web/app/lib/upload-store.tsx`:
   - Deleted the `persistActiveIds()` function entirely and all 3 call sites (`updateProgress`, `cancelUpload`, `dismissUpload`)
   - Upload state was written to `localStorage` under `fudl:active-uploads` but never read back — dead code
   - Upload state remains ephemeral (session-only via React context). Resuming interrupted uploads is handled by the UploadManager checking the `/upload/status` API endpoint

3. **Removed automatic job scheduling from `/complete`** — `apps/api/src/routes/v1/uploads/routes.ts`:
   - Removed `videoProcessingQueue.add()` call and subsequent `prisma.video.update()` for `jobId`
   - Removed `videoProcessingQueue` import from `../../../lib/queues`
   - Removed `S3_BUCKET` and `S3_REGION` imports (were only used for job data)
   - Video status stays at `UPLOADED` — coaches will manually trigger analysis when ready
   - Response no longer includes `storageUrl` or `jobId` — just `{ completed: true }`

4. **Thumbnail upload schema validation** — `apps/api/src/routes/v1/uploads/routes.ts`:
   - Changed `t.File()` to `t.File({ maxSize: "5m", type: ["image/jpeg", "image/png", "image/webp"] })` — Elysia now rejects oversized or wrong-type files at the framework level before the handler runs
   - Removed redundant manual size check (`data.length > 5 * 1024 * 1024`) and MIME type check from the handler body — these are now enforced by the schema
   - Kept the empty-file check (`data.length === 0`) as a handler-level safety net

**Key decisions:**

- **`getPublicUrl()` deprecated, not removed** — It may still be useful for non-auth contexts (e.g., admin debugging). Marked `@deprecated` with a note to use `getSignedDownloadUrl()`.
- **No localStorage at all** — The original intent was "diagnostic purposes" but diagnostic data that's never read serves no purpose. If cross-device upload awareness is needed in the future, it should be API-driven (query the `/upload/status` endpoint for in-progress uploads).
- **No job on upload completion** — The processing pipeline (clip splitting, AI analysis, etc.) will be triggered explicitly by coaches in a future feature. This prevents the stub worker from creating permanently stuck `PROCESSING` states and gives coaches control over when/what to analyze.
- **Schema-level validation for thumbnails** — Elysia's `t.File()` supports `maxSize` and `type` constraints natively. This provides a cleaner error response (422 Validation Error) and prevents the handler from even executing for invalid files.

**Files modified:**

- `apps/api/src/lib/s3.ts` — Deprecated `getPublicUrl()`, removed `CacheControl` from `uploadThumbnail()`, simplified return type
- `apps/api/src/routes/v1/uploads/routes.ts` — Removed job scheduling, removed `getPublicUrl`/queue imports, schema-validated thumbnail upload, simplified `/complete` response
- `apps/api/src/routes/v1/videos/routes.ts` — Batch-sign `storageKey` in list endpoint, sign `storageKey` in detail endpoint
- `apps/web/app/lib/upload-store.tsx` — Removed `persistActiveIds()` and all localStorage interaction

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 27 — 2026-02-12

**Focus:** Game detail page with full video playback system — custom player, sidebar, clip navigation

**Completed:**

1. **API: Enhanced `GET /orgs/:orgId/games/:gameId`** — `apps/api/src/routes/v1/games/routes.ts`:
   - Now returns presigned `thumbnailUrl` and `storageUrl` for each video via batch `Promise.all` signing
   - Includes per-video `tags` (needed for camera angle detection/display)
   - Videos are fully detailed: id, title, status, mimeType, fileSize, durationSecs, thumbnailKey, storageKey, createdAt, tags

2. **API: Added `?tagId=` filter to `GET /orgs/:orgId/games`** — `apps/api/src/routes/v1/games/routes.ts`:
   - New optional `tagId` query parameter filters games via `tags: { some: { tagId } }` Prisma where clause
   - Enables sidebar to filter games by opponent tag for scouting workflow

3. **Custom `usePlayer` hook** — `apps/web/app/(authenticated)/games/components/use-player.ts`:
   - Wraps HTML5 `<video>` API with React state management
   - Tracks: `isPlaying`, `currentTime`, `duration`, `volume`, `isMuted`, `playbackRate`, `isFullscreen`, `bufferedPercent`, `isWaiting`
   - Actions: `play`, `pause`, `togglePlay`, `seek`, `skip`, `setVolume`, `toggleMute`, `setPlaybackRate`, `toggleFullscreen`
   - Full keyboard shortcuts: Space/K (play/pause), J/Left (skip -5s), L/Right (skip +5s), Up/Down (volume ±5%), M (mute), F (fullscreen)
   - `resetState()` for when video source changes (camera angle switch)

4. **`VideoPlayer` component** — `apps/web/app/(authenticated)/games/components/video-player.tsx`:
   - Layered architecture: `<video>` → `<canvas>` overlay (pointer-events: none, ready for annotations) → click interaction layer → auto-hiding controls
   - Canvas resizes via `ResizeObserver` to match video dimensions
   - Controls auto-hide after 3s of mouse inactivity when playing, reappear on mouse move or pause
   - Click-to-play/pause, double-click-to-fullscreen on the interaction layer
   - Camera angle switching syncs playback time via `pendingSeekRef` — when switching angles, seeks to the same timestamp
   - Computes camera angles from video tags (filters for `CAMERA_ANGLE` category)
   - Shows `<Spinner>` during loading/waiting

5. **`PlayerControls` component** — `apps/web/app/(authenticated)/games/components/player-controls.tsx`:
   - Full control bar: prev/next clip, skip ±5s, play/pause, seek `<Slider>` with buffer indicator
   - Camera angle switcher via `<DropdownMenu>` (visible only when multiple angles exist)
   - Playback speed selector (0.25x, 0.5x, 1x, 1.25x, 1.5x, 2x) via `<DropdownMenu>`
   - Volume `<Popover>` with vertical `<Slider>` + mute `<Toggle>`
   - Fullscreen toggle
   - Mobile sidebar trigger button (visible on `md:hidden`)
   - All buttons have `<Tooltip>` with `<Kbd>` showing keyboard shortcuts
   - Time display in monospace font (`current / duration`)

6. **`ClipList` component** — `apps/web/app/(authenticated)/games/components/clip-list.tsx`:
   - Scrollable list of video clips for the current game
   - Each clip shows: thumbnail (S3 presigned URL via `<img>`), title or camera angle tag name, duration (mm:ss), clip index
   - Active clip highlighted with accent background
   - Click calls `onVideoChange(index)` to switch playback

7. **`GameSidebar` component** — `apps/web/app/(authenticated)/games/components/game-sidebar.tsx`:
   - Two collapsible sections via `<Collapsible>`: "Game Directory" and "Clips" (for current game)
   - Game directory lists all org games with opponent name, date, video count
   - Independent "Group by" `<Select>` control (none, season, opponent, both) — defaults to "by opponent"
   - Reuses grouping logic pattern from dashboard (groupGames function adapted locally)
   - Current game highlighted in the directory
   - Each game is a `<Link>` for full page navigation (`/games/${gameId}`)
   - Embeds `<ClipList>` for current game's videos

8. **Server component page** — `apps/web/app/(authenticated)/games/[gameId]/page.tsx`:
   - Async server component following canonical pattern
   - Uses `requireAuth()`, `getServerOrg()`, `getActiveMember()` from `../../lib/auth`
   - Parallel data fetching via `Promise.all`: game detail, all org games (for sidebar), seasons
   - Shows `<NoTeamState>` when no org, `notFound()` when game doesn't exist
   - Maps API data to `SidebarGameData[]` interface for sidebar consumption
   - Passes everything to `<GamePlayback>` client component

9. **Client layout component** — `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx`:
   - Layout: flex row with player area (flex-1) + sidebar (w-80, hidden on mobile)
   - Game info header: title (opponent name or game title), season badge, date, location, field tag
   - Filters videos to only playable ones (`storageUrl` exists AND status is `UPLOADED` or `COMPLETED`)
   - "No playable videos" empty state when no videos have been uploaded
   - Mobile: sidebar renders vertically below the 16:9 video player (scrollable, no Sheet overlay)
   - Full viewport height layout: `h-[calc(100vh-3.5rem)]` to fill below the nav bar

**Key decisions:**

- **Canvas overlay from day one** — Even though drawing/annotation tools aren't built yet, the `<canvas>` sits on top of the `<video>` with `pointer-events: none` from the start. This avoids a future refactor when coaching tools are implemented.
- **Independent sidebar group-by** — The sidebar's grouping control is separate from the dashboard's. Coaches scouting opponents want "by opponent" grouping (the default), while the dashboard might use "by season."
- **Full page navigation for game switching** — Rather than SPA-style video swapping, clicking a game in the sidebar navigates to `/games/${newGameId}`. This keeps the URL in sync, supports browser back/forward, and avoids stale data issues. The tradeoff is a page load, but server components make this fast.
- **No `useEffect` for keyboard shortcuts** — Keyboard shortcuts are registered via a single `useEffect` in `usePlayer` that attaches a `keydown` listener to the document. All handlers use `useCallback` with stable deps to avoid re-registration.
- **Slider `onValueChange` safety** — Radix Slider's callback provides `number[]` where elements can be `undefined`. All handlers use `values[0] ?? 0` fallback to prevent NaN propagation.

**Key learnings:**

- **Presigned URL batch-signing** — The game detail endpoint generates presigned URLs for all videos' `thumbnailKey` and `storageKey` in a single `Promise.all`. This avoids N+1 signing overhead when a game has many videos/angles.
- **`durationSecs` is always null** — The Python worker is a stub, so video metadata (duration, dimensions, fps, codec) is never populated. The `ClipList` handles this gracefully by showing "--" for unknown durations.
- **Camera angle detection** — Camera angles are determined by filtering a video's tags for `category === "CAMERA_ANGLE"`. If a video has no camera angle tag, the player still works — it just doesn't show the angle switcher UI.
- **`ResizeObserver` for canvas** — The canvas overlay needs to match the video's rendered dimensions exactly. A `ResizeObserver` on the video container updates canvas width/height whenever the layout changes (window resize, fullscreen toggle, sidebar collapse).

**Files created:**

- `apps/web/app/(authenticated)/games/[gameId]/page.tsx` — Server component page
- `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx` — Client layout component
- `apps/web/app/(authenticated)/games/components/use-player.ts` — Custom video player hook
- `apps/web/app/(authenticated)/games/components/video-player.tsx` — Video player with canvas overlay
- `apps/web/app/(authenticated)/games/components/player-controls.tsx` — Full control bar
- `apps/web/app/(authenticated)/games/components/clip-list.tsx` — Video clip list
- `apps/web/app/(authenticated)/games/components/game-sidebar.tsx` — Game directory sidebar

**Files modified:**

- `apps/api/src/routes/v1/games/routes.ts` — Enhanced game detail endpoint (presigned URLs, video tags), added `?tagId=` query filter
- `AGENTS.md` — Updated Implemented section, Placeholder/Incomplete section, What Remains to Develop, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 28 — 2026-02-12

**Focus:** Footage/angle/clip architecture redesign — correct the mental model of videos vs clips in the game player

**Problem:** The game detail page treated each `Video` record as a "clip" in a playlist. `activeVideoIndex` navigated between video records like clips. The `ClipList` component displayed raw `Video` records. This was architecturally wrong:

1. Each `Video` record is a **footage file** — a full-length recording of the entire game from a specific camera angle
2. Multiple footage files = multiple views of the **same** content, not separate clips
3. **Clips** (from the DB `Clip` model) are time segments within a footage file, created by future AI analysis
4. The `ClipList` should show `Clip` records, not `Video` records

**Completed:**

1. **Redesigned `GamePlayback`** — `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx`:
   - Replaced `activeVideoIndex` (integer) with `activeVideoId` (string) — tracks footage by ID, not position
   - Renamed `playableVideos` to `footageFiles` — semantically clear
   - Passes `footageFiles`/`activeVideoId`/`onAngleChange` to child components instead of `videos`/`activeVideoIndex`/`onVideoChange`
   - Empty state text changed from "No playable videos" to "No playable footage"

2. **Redesigned `VideoPlayer`** — `apps/web/app/(authenticated)/games/components/video-player.tsx`:
   - Props changed: `footageFiles`/`activeVideoId`/`onAngleChange` replace `videos`/`activeVideoIndex`/`onVideoChange`
   - Removed all clip navigation logic (prev/next clip, Shift+Arrow keyboard handlers)
   - Active video found by ID (`footageFiles.find(v => v.id === activeVideoId)`)
   - `AngleOption` now uses `videoId` (string) instead of `videoIndex` (integer), `tagId` is nullable
   - Angle switching passes `videoId` to parent, not index — syncs playback time via existing `pendingSeekRef`
   - All angles computed from footage files with `useMemo` — no per-render allocation
   - Falls back to video title when no `CAMERA_ANGLE` tag exists on a footage file

3. **Redesigned `PlayerControls`** — `apps/web/app/(authenticated)/games/components/player-controls.tsx`:
   - Removed `SkipBack`/`SkipForward` prev/next clip buttons entirely
   - Removed `hasPrevClip`/`hasNextClip`/`onPrevClip`/`onNextClip` props
   - `AngleOption.tagId` is now `string | null` (nullable for footage without angle tags)
   - `activeAngle` prop is an `AngleOption | null` object (replaces `activeAngleTagId: string | null`)
   - Angle switcher uses `videoId` for radio group value (not `tagId`)
   - Active angle display uses `activeAngle?.tagName` directly

4. **Redesigned `ClipList`** — `apps/web/app/(authenticated)/games/components/clip-list.tsx`:
   - No longer shows `Video` records — shows `Clip` records from the DB `Clip` model
   - New `ClipData` interface: `id`, `title`, `startTime`, `endTime`, `videoId`, `thumbnailUrl`, `labels`
   - Empty state with `Scissors` icon: "No clips yet — Clips will appear here once footage is analyzed and split into plays"
   - Props: `clips: ClipData[]`, `activeClipId`, `onClipSelect` (future-ready)
   - Non-empty render branch returns `null` for now (unreachable since no clips are created)

5. **Redesigned `GameSidebar`** — `apps/web/app/(authenticated)/games/components/game-sidebar.tsx`:
   - Props changed: `footageFiles`/`activeVideoId`/`onAngleChange` replace `videos`/`activeVideoIndex`/`onVideoChange`
   - **Three collapsible sections** (was two):
     1. **Games** — Game directory with grouping (unchanged)
     2. **Footage** — NEW section showing uploaded footage files (camera angles) with thumbnails, active highlighting, click to switch angle. Badge shows footage count. Camera icon for no-thumbnail placeholder.
     3. **Clips** — Shows `<ClipList>` with empty clips array (always empty for now). Badge shows "0". Collapsed by default.
   - Footage section replaces the old "Clips" section that was incorrectly showing Video records
   - Footage section uses `footageOpen` state (default: open), clips section uses `clipsOpen` state (default: closed)

6. **Updated `usePlayer` hook** — `apps/web/app/(authenticated)/games/components/use-player.ts`:
   - Updated Shift+Arrow keyboard shortcut comments from "previous/next clip (handled by parent)" to "reserved for future clip navigation"
   - No logic changes — the hook was already correct

**Key decisions:**

- **`videoId` not `videoIndex` for angle switching** — Using IDs instead of array indices is more robust. Array order could change if the API returns videos in a different order across requests.
- **`AngleOption.tagId` nullable** — A footage file might not have a `CAMERA_ANGLE` tag assigned. In this case, the video title is used as the angle display name. The switcher still works via `videoId`.
- **Clips section collapsed by default** — Since no clips exist, the section would just show an empty state. Keeping it collapsed reduces visual noise while still being discoverable.
- **Footage section separate from clips** — These are fundamentally different concepts. Footage files are full game recordings (the raw material). Clips are analyzed segments (the output). Mixing them in one section was the original mistake.
- **No prev/next buttons in controls** — Without clips, there's nothing to navigate between. The buttons will return when clip navigation is implemented. Shift+Arrow keyboard shortcuts are reserved but no-op.

**Files modified:**

- `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx` — Footage-centric props, ID-based tracking
- `apps/web/app/(authenticated)/games/components/video-player.tsx` — Footage-centric props, removed clip nav
- `apps/web/app/(authenticated)/games/components/player-controls.tsx` — Removed clip nav buttons, nullable tagId
- `apps/web/app/(authenticated)/games/components/clip-list.tsx` — Shows Clip records (empty state), not Video records
- `apps/web/app/(authenticated)/games/components/game-sidebar.tsx` — Three sections: games, footage, clips
- `apps/web/app/(authenticated)/games/components/use-player.ts` — Updated keyboard shortcut comments
- `AGENTS.md` — Updated Implemented section, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 29 — 2026-02-12

**Focus:** Season detail page — full game list, edit/delete season, game management, group-by-opponent

**Completed:**

1. **Enhanced `GET /orgs/:orgId/seasons/:seasonId` API** — `apps/api/src/routes/v1/seasons/routes.ts`:
   - Now returns full game data with `videos: { id, status, thumbnailKey }`, flattened `tags`, season relation, `_count`
   - Batch-signs all `thumbnailKey` values via `Promise.all` to generate presigned URLs
   - Response shape matches `GET /orgs/:orgId/games` so frontend can reuse the same `GameCard` pattern
   - Added `getSignedDownloadUrl` import from `../../../lib/s3`

2. **Season detail server component** — `apps/web/app/(authenticated)/seasons/[seasonId]/page.tsx`:
   - Async server component using `requireAuth()`, `getServerOrg()`, `getActiveMember()` from `../../../lib/auth`
   - Parallel data fetching via `Promise.all`: season detail + active member
   - Shows `<NoTeamState>` when no org, `notFound()` when season doesn't exist or API returns non-200
   - Maps API data to serializable props for client component

3. **Season detail client component** — `apps/web/app/(authenticated)/seasons/[seasonId]/season-detail-content.tsx`:
   - **Season header** — Back link to `/seasons`, calendar icon, season name, date range, edit/delete actions (coach-only)
   - **Edit season dialog** — `react-hook-form` + `standardSchemaResolver(updateSeasonSchema)`, pre-fills current values, resets on open
   - **Delete season** — AlertDialog with restrict-guard (disabled button + warning when games exist), redirects to `/seasons` on success
   - **Stats bar** — Game count, total footage files, analyzed footage count (videos with `COMPLETED` status)
   - **Game list** — Reuses dashboard's `GameCard` pattern: thumbnail, opponent tag, date/location meta, video status line, play button, dropdown menu (view game, upload footage, delete game)
   - **Group-by-opponent selector** — Two options: No grouping, By opponent. Section headers with group label + game count badge
   - **Delete game** — AlertDialog confirmation, calls `DELETE /orgs/:orgId/games/:gameId`, optimistic removal from list
   - **Auto-refresh after uploads** — Uses `useActiveUploadCount()` + `useRef` to detect when active uploads drop to 0, re-fetches season data
   - **Empty state** — Different messaging for coaches ("Upload your first game footage") vs players ("No games have been added yet")

**Key decisions:**

- **Same GameCard pattern as dashboard** — Reused the exact same visual structure (thumbnail, opponent/meta/status lines) to maintain consistency. Omitted season from the meta line since the page is already scoped to one season.
- **Group-by limited to "none" and "opponent"** — No "by season" option since the page is already season-scoped. No "both" option since it would be identical to "by opponent" in this context.
- **Restrict-delete for seasons with games** — Same pattern as the seasons list page. Delete button is disabled with a warning message when the season has games. Users must move/delete games first.
- **Batch presigned URL signing** — Collects all unique `thumbnailKey` values into a `Set`, signs them all via `Promise.all`, builds a `Map<key, signedUrl>`, maps results back. Same efficient pattern used in the games list endpoint.

**Key learnings:**

- **`UpdateSeasonValues` type already existed** — At `packages/types/src/validations.ts:227`, ready to use for the edit season form. No new types needed.
- **Season list already navigated to `/seasons/${id}`** — `seasons-content.tsx` line 439 had the click handler wired up. The detail page just needed to exist at the right route.
- **API response shape alignment matters** — By making the season detail endpoint return games in the same shape as the games list endpoint (with videos, tags, presigned URLs), the frontend could reuse the same `GameCard` rendering logic without any adapter layer.

**Files created:**

- `apps/web/app/(authenticated)/seasons/[seasonId]/page.tsx` — Server component page
- `apps/web/app/(authenticated)/seasons/[seasonId]/season-detail-content.tsx` — Client component with full season detail UI

**Files modified:**

- `apps/api/src/routes/v1/seasons/routes.ts` — Enhanced `GET /:seasonId` with videos, tags, presigned URLs
- `AGENTS.md` — Updated Implemented section, Placeholder/Incomplete section, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 30 — 2026-02-12

**Focus:** Manual clip cutting — full-stack CRUD for game clips with mark-in/mark-out UI

**Completed:**

1. **Clip validation schemas** — `packages/types/src/validations.ts`:
   - Added `createClipSchema` with `.refine()` for `endTime > startTime` cross-field validation
   - Added `updateClipSchema` with optional/nullable fields
   - Exported `CreateClipValues` and `UpdateClipValues` types
   - Fixed `z.record(z.unknown())` → `z.record(z.string(), z.unknown())` for Zod v4 compatibility

2. **Clip API routes** — `apps/api/src/routes/v1/clips/routes.ts`:
   - `GET /orgs/:orgId/clips?gameId=&videoId=` — List clips (required `gameId`, optional `videoId`), ordered by `startTime` asc, batch-signs `thumbnailKey`
   - `POST /orgs/:orgId/clips` — Create clip with `isCoach` auth, validates video belongs to org, sets `metadata.source = "manual"`
   - `GET /orgs/:orgId/clips/:clipId` — Get single clip with presigned URLs
   - `PATCH /orgs/:orgId/clips/:clipId` — Update with cross-field `endTime > startTime` validation
   - `DELETE /orgs/:orgId/clips/:clipId` — Delete (no S3 cleanup for manual clips)
   - Wired into `apps/api/src/routes/v1/index.ts`

3. **Server component clip fetch** — `apps/web/app/(authenticated)/games/[gameId]/page.tsx`:
   - Added `fetchGameClips()` function
   - Added to existing `Promise.all` for parallel fetching
   - Passes `initialClips` and `orgId` to `<GamePlayback>`

4. **GamePlayback clip state hub** — `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx`:
   - Added `clips`, `activeClipId`, `markIn`, `markOut` state
   - `currentTimeRef` updated via `onTimeUpdate` callback from `VideoPlayer`
   - Optimistic mutation handlers: `handleClipCreated` (insert sorted), `handleClipUpdated` (replace + re-sort), `handleClipDeleted` (remove + clear active)
   - Clip selection with footage switching: `handleClipSelect` changes `activeVideoId` if clip is on a different footage file
   - Clip navigation: `navigateClip("prev"/"next")` walks through sorted clip array
   - Keyboard shortcuts (separate `useEffect`, does NOT modify `usePlayer`): `I` (mark in), `O` (mark out), `Escape` (clear clip/marks), `Shift+Arrow` (navigate clips)
   - `handleSeek` exits clip mode when seeking outside active clip range
   - Threads all clip props to `VideoPlayer` and `GameSidebar` (both mobile and desktop)

5. **ClipMarkControls** — `apps/web/app/(authenticated)/games/components/clip-mark-controls.tsx`:
   - `[` / `]` buttons showing green/red timestamps when marks are set
   - `Scissors` button opens `ClipCreateDialog` when both marks are valid
   - `X` button clears marks
   - Tooltips with keyboard shortcut hints

6. **ClipCreateDialog** — `apps/web/app/(authenticated)/games/components/clip-create-dialog.tsx`:
   - `react-hook-form` + `standardSchemaResolver(createClipSchema)`
   - Time range display with duration badge
   - Fine-tune start/end number inputs (±0.1s step)
   - Optional title and comma-separated labels
   - POSTs to `/orgs/${orgId}/clips`, calls `onClipCreated` on success

7. **ClipEditDialog** — `apps/web/app/(authenticated)/games/components/clip-edit-dialog.tsx`:
   - Same fields as create, pre-filled from existing clip
   - PATCHes to `/orgs/${orgId}/clips/${clipId}`, calls `onClipUpdated`
   - Form resets when clip prop changes

8. **ClipList (full rendering)** — `apps/web/app/(authenticated)/games/components/clip-list.tsx`:
   - Each row: index badge, title (or "Clip N"), time range, duration badge, label badges (max 3 + overflow)
   - Active clip highlighted with accent bg + ring
   - Coach-only dropdown menu with Edit and Delete actions
   - Delete confirmation via `AlertDialog`
   - Context-aware empty state: coaches see "Press I to mark in…", players see "Clips will appear…"

9. **VideoPlayer clip playback** — `apps/web/app/(authenticated)/games/components/video-player.tsx`:
   - `onTimeUpdate` callback reports `state.currentTime` to parent
   - `activeClip` prop: seeks to `startTime` when clip changes (tracked via `prevClipIdRef`), auto-plays
   - Auto-pause at `endTime` via `useEffect` watching `state.currentTime`
   - `onSeek` callback wrapper for exiting clip mode
   - Builds `clipMarkControlsNode` (coach-only) and passes as slot to `PlayerControls`

10. **PlayerControls seek bar enhancements** — `apps/web/app/(authenticated)/games/components/player-controls.tsx`:
    - Clip range indicators: muted bars for each clip's time range, active clip uses brighter primary color
    - Mark range preview: translucent primary band between mark-in and mark-out
    - Mark-in indicator: thin green vertical line
    - Mark-out indicator: thin red vertical line
    - `clipMarkControls` React node slot rendered between play controls and time display
    - New props: `onSeek`, `markIn`, `markOut`, `clips`, `activeClipId`, `clipMarkControls`

11. **GameSidebar clip integration** — `apps/web/app/(authenticated)/games/components/game-sidebar.tsx`:
    - Accepts `clips`, `activeClipId`, `onClipSelect`, `onClipUpdated`, `onClipDeleted`, `orgId` props
    - Passes all to `<ClipList>` with `isCoach` and `orgId`
    - Clip badge count shows `clips.length` (not hardcoded `0`)
    - `clipsOpen` defaults to `true` when clips exist

**Key decisions:**

- **Clip keyboard shortcuts in parent, not `usePlayer`** — `I`, `O`, `Escape`, `Shift+Arrow` are handled in a separate `useEffect` in `GamePlayback`. The `usePlayer` hook remains untouched (single responsibility — video element API only). The existing `usePlayer` handler already returns early on `Shift+Arrow`, so no conflict.
- **`currentTimeRef` pattern** — `VideoPlayer` reports time via `onTimeUpdate` callback, parent stores it in a `useRef`. This avoids re-rendering the parent on every `timeupdate` event while still giving keyboard shortcut handlers access to the current time.
- **`metadata.source = "manual"` on API** — Set server-side, not client-side. This ensures all manual clips are tagged consistently. The AI worker will set `metadata.source = "ai"` when it creates clips.
- **No S3 operations for clips** — Manual clips are pure time markers (`startTime`/`endTime`). `storageKey`/`thumbnailKey` remain null. Future AI-generated clips may have their own extracted video segments.
- **Auto-play on clip select** — When a clip is selected, the player seeks to `startTime` and auto-plays. This is the expected behavior for film review (click a play → watch it immediately).

**Key learnings:**

- **Zod v4 `z.record()` signature** — `z.record(valueSchema)` (1 arg) is not valid in Zod v4. Must use `z.record(keySchema, valueSchema)` (2 args): `z.record(z.string(), z.unknown())`.
- **`prevClipIdRef` prevents re-seeking** — Without tracking the previous clip ID, every re-render that includes `activeClip` in the dependency array would re-trigger the seek. The ref ensures seeking only happens when the clip actually changes.

**Files created:**

- `apps/api/src/routes/v1/clips/routes.ts` — Clip CRUD endpoints
- `apps/api/src/routes/v1/clips/index.ts` — Barrel export
- `apps/web/app/(authenticated)/games/components/clip-mark-controls.tsx` — Mark-in/mark-out buttons
- `apps/web/app/(authenticated)/games/components/clip-create-dialog.tsx` — Clip save dialog
- `apps/web/app/(authenticated)/games/components/clip-edit-dialog.tsx` — Clip edit dialog

**Files modified:**

- `packages/types/src/validations.ts` — Added clip schemas, fixed `z.record()` for Zod v4
- `apps/api/src/routes/v1/index.ts` — Wired `clipRoutes`
- `apps/web/app/(authenticated)/games/[gameId]/page.tsx` — Fetch clips in parallel, pass `initialClips` + `orgId`
- `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx` — Clip state hub, mutation handlers, keyboard shortcuts, prop threading
- `apps/web/app/(authenticated)/games/components/video-player.tsx` — `activeClip` prop, seek-to-start, auto-pause, `onTimeUpdate`, clip mark controls slot
- `apps/web/app/(authenticated)/games/components/player-controls.tsx` — Seek bar indicators, `clipMarkControls` slot, new props
- `apps/web/app/(authenticated)/games/components/game-sidebar.tsx` — Clip props, badge count, default open state
- `apps/web/app/(authenticated)/games/components/clip-list.tsx` — Full clip rendering, coach actions, edit/delete
- `AGENTS.md` — Updated Implemented section, added session log

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅

### Session 31 — 2026-02-12

**Focus:** Play-scoped clip redesign — multi-angle plays with `playNumber`, play-scoped controls, smart play number selector

**Completed:**

1. **Schema change** — `packages/db/prisma/schema.prisma`:
   - Added `playNumber Int` field to Clip model
   - Added `@@unique([videoId, playNumber])` constraint (one clip per angle per play)
   - Removed redundant `@@index([videoId])` (covered by the unique constraint)
   - Migration run by user

2. **Validation schemas** — `packages/types/src/validations.ts`:
   - Added `playNumber: z.number().int().min(1, "Play number must be at least 1")` to `createClipSchema`
   - Added `playNumber: z.number().int().min(1).optional()` to `updateClipSchema`

3. **Clip API routes rewrite** — `apps/api/src/routes/v1/clips/routes.ts`:
   - GET: Orders by `playNumber: "asc"` instead of `startTime: "asc"`, includes `playNumber` in response
   - POST: Accepts required `playNumber` (`t.Integer({ minimum: 1 })`), validates uniqueness via `findUnique` on `videoId_playNumber`, returns 409 Conflict for duplicates
   - PATCH: Accepts optional `playNumber`, validates uniqueness if changed
   - DELETE: Returns `{ deleted: true, playNumber: clip.playNumber }`
   - All responses include `playNumber` field

4. **ClipList redesign** — `apps/web/app/(authenticated)/games/components/clip-list.tsx`:
   - Added `playNumber: number` to `ClipData` interface
   - Groups clips by `playNumber` into `PlayGroup[]` via `useMemo` with `Map`
   - Shows one row per play ("Play N"), not one per clip
   - Angle count badge when multiple variants exist
   - Prefers variant on `activeVideoId` for time/label display
   - Props changed: `activeClipId` → `activePlayNumber`, `onClipSelect` → `onPlaySelect`
   - Delete removes ALL variants for a play via `Promise.all`

5. **ClipCreateDialog redesign** — `apps/web/app/(authenticated)/games/components/clip-create-dialog.tsx`:
   - Removed title field entirely
   - Added play number `<Select>` with smart default: `clipsOnThisAngle.length + 1`, bumps to `maxPlay + 1` if collision
   - Options: "New play (Play N)" at top + existing plays without a clip on current angle
   - Sends `playNumber` to API, no `title`

6. **ClipEditDialog update** — `apps/web/app/(authenticated)/games/components/clip-edit-dialog.tsx`:
   - Removed title field
   - Dialog title shows "Edit Play {clip.playNumber}"

7. **ClipMarkControls update** — `apps/web/app/(authenticated)/games/components/clip-mark-controls.tsx`:
   - Added `existingClips: ClipData[]` prop passed through to `ClipCreateDialog`
   - Renamed tooltip: "Save play"

8. **PlayerControls play-scoped mode** — `apps/web/app/(authenticated)/games/components/player-controls.tsx`:
   - New props: `activeClip`, `hasPrevPlay`, `hasNextPlay`, `onPrevPlay`, `onNextPlay`
   - When `activeClip` is set (clip mode):
     - Seek bar: min=0, max=clipDuration, value=clipCurrentTime, translates to absolute on seek
     - Time display: clipCurrentTime / clipDuration
     - Buffer bar: mapped to clip-relative range
     - Skip ±5s: clamped to clip boundaries
     - Hides: clip range indicators, mark indicators, mark range preview, clipMarkControls
     - Shows: SkipBack/SkipForward prev/next play buttons with Shift+Arrow tooltips
   - Non-clip mode: unchanged

9. **VideoPlayer prop threading** — `apps/web/app/(authenticated)/games/components/video-player.tsx`:
   - Added `hasPrevPlay`, `hasNextPlay`, `onPrevPlay`, `onNextPlay` props
   - Passes `existingClips={clips ?? []}` to `ClipMarkControls`
   - Threads all new props to `PlayerControls`

10. **GameSidebar update** — `apps/web/app/(authenticated)/games/components/game-sidebar.tsx`:
    - Renamed "Clips" section to "Plays"
    - Badge shows unique play count: `new Set(clips.map(c => c.playNumber)).size`
    - Props changed: `activeClipId` → `activePlayNumber`, `onClipSelect` → `onPlaySelect`

11. **GamePlayback complete rewrite** — `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx`:
    - `activePlayNumber` (number | null) replaces `activeClipId` (string | null)
    - `activeClip` derived via `useMemo`: prefers clip on current angle, falls back to first variant
    - `sortedPlayNumbers` for navigation
    - `navigatePlay("prev"/"next")` with automatic angle switching when current angle lacks variant
    - `handlePlaySelect(playNumber)` with angle switching
    - `handleClipDeleted` clears `activePlayNumber` when last variant deleted
    - `handleAngleChange` keeps `activePlayNumber` set; useEffect exits play mode only if NO variants exist anywhere
    - Removed unused `API_URL` import

**Key decisions:**

- **`playNumber` groups clips across angles** — A "play" is identified by its number, not by a clip ID. Multiple clips with the same `playNumber` on different footage files are variants of the same play from different camera angles.
- **Smart default play number** — `clipsOnThisAngle.length + 1` means sequential clipping on one angle always gets the next number. When switching to another angle to add the same play, existing plays without a variant on the current angle appear as options.
- **Play-scoped seek bar** — In clip mode, the seek bar shows 0 to clipDuration (not 0 to videoDuration). All seek operations translate between clip-relative and absolute time. This matches the Hudl UX where playing a clip feels like watching a standalone video.
- **Angle switching preserves play mode** — When `handleAngleChange` fires during play mode, `activePlayNumber` stays set. The `activeClip` derivation recomputes automatically to find the variant for the new angle. Only if NO variant exists for the active play (on any angle) does play mode exit.
- **Delete removes all variants** — Deleting a play from the ClipList deletes ALL angle variants via parallel DELETE API calls. This is the expected behavior since a "play" is a logical unit, not a single clip.

**Files modified:**

- `packages/db/prisma/schema.prisma` — Added `playNumber`, `@@unique([videoId, playNumber])`
- `packages/types/src/validations.ts` — Added `playNumber` to clip schemas
- `apps/api/src/routes/v1/clips/routes.ts` — Full rewrite with `playNumber` support, 409 conflict, ordering
- `apps/web/app/(authenticated)/games/components/clip-list.tsx` — Play grouping, "Play N" display, multi-variant support
- `apps/web/app/(authenticated)/games/components/clip-create-dialog.tsx` — Removed title, smart play number selector
- `apps/web/app/(authenticated)/games/components/clip-edit-dialog.tsx` — Removed title, "Edit Play N"
- `apps/web/app/(authenticated)/games/components/clip-mark-controls.tsx` — Added `existingClips` prop
- `apps/web/app/(authenticated)/games/components/player-controls.tsx` — Play-scoped seek/time/buffer, prev/next buttons
- `apps/web/app/(authenticated)/games/components/video-player.tsx` — Threaded new props
- `apps/web/app/(authenticated)/games/components/game-sidebar.tsx` — "Plays" section, play count badge
- `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx` — `activePlayNumber`, angle-aware derivation, play navigation

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅
