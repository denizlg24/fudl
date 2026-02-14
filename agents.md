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
- **Video annotation system (full stack)** — Coaches and players can annotate game footage with drawings, shapes, and text overlays at specific video timestamps. `Annotation` model with JSON `data` field containing `AnnotationElement[]` (stroke, arrow, circle, rectangle, text). Privacy: coach annotations are public (visible to all), player annotations are private (creator-only). API routes (`GET/POST/DELETE /orgs/:orgId/annotations`) with role-based privacy filtering and deletion permissions. **Drawing tools**: `useAnnotationCanvas` hook with full drawing state machine (pen, arrow, circle, rectangle, text), normalized 0-1 coordinates, live preview during drag, undo/clear. **Annotation toolbar**: floating toolbar with 5 tool buttons, 5 color presets (red, blue, yellow, white, green), 3 line width presets, undo/clear/save/cancel. **Canvas overlay**: `VideoPlayer` toggles canvas between `pointer-events-none` (playback) and `pointer-events-auto cursor-crosshair` (drawing mode). **Playback auto-pause**: video pauses at annotation keyframes (±0.3s tolerance), shows annotation on canvas with "Click to continue" overlay, tracks shown IDs to prevent re-triggering. **Keyframe indicators**: amber diamond markers on seek bar in both non-clip and clip modes. **Sidebar annotation list**: scrollable list with diamond icon, timestamp, creator name, privacy badge, delete button, click-to-seek. **Keyboard shortcuts**: `A` enters annotation mode, `Escape` exits/dismisses, `Ctrl+Z` undo in annotation mode. Annotations fetched in parallel for all game videos on server page.

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
- [x] Build coaching tools (annotations, drawing on video frames)

### Phase 5: Production Readiness

- [ ] Set up CI/CD pipeline
- [ ] Add comprehensive test coverage (unit, integration, e2e)
- [ ] Performance optimization (follow vercel-react-best-practices)
- [ ] Accessibility audit (use web-design-guidelines skill)
- [ ] Production deployment configuration

---

## Post-Session Instructions

**After every coding session, the agent MUST update this `agents.md` file by replacing the last session with:**

1. **New learnings** — Any architectural decisions made, patterns discovered, or gotchas encountered during the session.
2. **Updated "What Remains to Develop"** — Check off completed items, add new items discovered during development, reprioritize if needed.
3. **Updated "Current State"** — Move items from "Placeholder/Incomplete" to "Implemented" as they are completed.
4. **Session notes** — A brief summary of what was accomplished in the session, appended to a "Session Log" section at the bottom of this file.

This ensures continuity across sessions and prevents redundant work.

---

## Latest Session

### Session 32 — 2026-02-13

**Focus:** Video annotation system — full-stack implementation (database, API, canvas drawing, toolbar, playback integration, sidebar)

**Completed:**

1. **Database schema** — Added `Annotation` model to `packages/db/prisma/schema.prisma`:
   - Fields: `id`, `videoId`, `organizationId`, `createdById`, `timestamp` (Float), `data` (Json), `isPrivate` (Boolean), `createdAt`, `updatedAt`
   - Relations to Video (Cascade), Organization (Cascade), User (Cascade)
   - Indexes on `[videoId, timestamp]` and `[organizationId]`
   - Added `annotations` relation arrays to `User`, `Organization`, and `Video` models

2. **Shared types** — `packages/types/src/annotations.ts` (NEW):
   - `AnnotationTool` type: `"pen" | "arrow" | "circle" | "rectangle" | "text"`
   - `AnnotationElement` union type for 5 element kinds with normalized 0-1 coordinates
   - `AnnotationData` interface for API response shape
   - Exported from `packages/types/src/index.ts`, added `"./annotations"` export to `package.json`
   - Added `createAnnotationSchema` to `packages/types/src/validations.ts`

3. **API routes** — `apps/api/src/routes/v1/annotations/routes.ts` (NEW):
   - `GET /orgs/:orgId/annotations?videoId=` — Returns public + user's private annotations, includes creator name
   - `POST /orgs/:orgId/annotations` — Auto-sets `isPrivate` based on membership role (member=private, owner/admin=public)
   - `DELETE /orgs/:orgId/annotations/:annotationId` — Permission-based: coaches delete public, players delete own private only
   - Wired into `apps/api/src/routes/v1/index.ts`

4. **Annotation renderer** — `apps/web/.../games/components/annotation-renderer.ts` (NEW):
   - `clearCanvas()` and `renderAnnotation()` pure functions
   - Handles all 5 element types with coordinate denormalization from 0-1 to canvas pixels
   - Arrow with arrowhead triangle, text with semi-transparent background rectangle

5. **Drawing hook** — `apps/web/.../games/components/use-annotation-canvas.ts` (NEW):
   - Full drawing state machine with pointerdown/pointermove/pointerup handlers
   - Tool-specific logic: pen (incremental points), arrow/circle/rectangle (start→preview→commit), text (floating input position)
   - Live preview during drag, coordinate normalization, undo/clear
   - Returns `tool`, `color`, `lineWidth`, `elements`, `textInput`, `undo`, `clear`, `commitText`, `cancelText`, `isEmpty`

6. **Annotation toolbar** — `apps/web/.../games/components/annotation-toolbar.tsx` (NEW):
   - 5 tool buttons (pen, arrow, circle, rectangle, text) as toggle group
   - 5 color presets (red, blue, yellow, white, green), 3 line width presets
   - Undo, Clear, Cancel, Save buttons with loading state
   - Uses `@repo/ui` Button, Tooltip, Separator components

7. **VideoPlayer modifications** — `apps/web/.../games/components/video-player.tsx`:
   - Canvas toggles: `annotationMode ? "z-30 pointer-events-auto cursor-crosshair" : "z-10 pointer-events-none"`
   - Interaction layer gets `pointer-events-none` during annotation mode
   - Saved annotation rendering: renders elements on canvas when `activeAnnotation` is set
   - "Click to continue" overlay when paused at annotation keyframe
   - Annotation toolbar and text input slots
   - Pauses video when entering annotation mode, keeps controls visible

8. **PlayerControls keyframe indicators** — `apps/web/.../games/components/player-controls.tsx`:
   - Amber diamond markers (rotated 45deg, `bg-amber-400`) at annotation timestamps on seek bar
   - Works in both non-clip mode (absolute positions) and clip mode (clip-relative positions, filtered to range)

9. **GamePlayback state hub** — `apps/web/.../games/[gameId]/game-playback.tsx`:
   - Annotation state: `annotations`, `annotationMode`, `activeAnnotation`, `isSavingAnnotation`, `shownAnnotationIds` ref
   - `useAnnotationCanvas` hook integration with `canvasRef` and `playerContainerRef`
   - Auto-pause at keyframes: checks ±0.3s tolerance in `handleTimeUpdate`, tracks shown IDs
   - Save handler POSTs to API, adds to state sorted by timestamp
   - Delete handler DELETEs from API, removes from state
   - Seek handler resets `shownAnnotationIds` so annotations can re-trigger
   - Keyboard shortcuts: `A` (annotation mode), `Escape` (exit/dismiss), `Ctrl+Z` (undo in annotation mode)
   - Toolbar and text input React nodes built inline, passed as slots to VideoPlayer
   - All annotation props threaded to both GameSidebar instances (mobile and desktop)

10. **Server page & sidebar** — `apps/web/.../games/[gameId]/page.tsx` and sidebar components:
    - `fetchGameAnnotations()` fetches annotations for all video IDs in parallel via `Promise.all`
    - Passes `initialAnnotations` and `userId` to `<GamePlayback>`
    - `annotation-list.tsx` (NEW): scrollable list with diamond icon, timestamp, creator name ("You" for own), privacy badge, delete button with permission check, click-to-seek
    - `game-sidebar.tsx`: new "Annotations" collapsible section between Plays and Footage

11. **TypeScript fix** — Annotation state declarations (`useState`, `useRef`, `useAnnotationCanvas`, `useMemo`) were placed after the keyboard handler `useEffect` that referenced them. Moved all annotation state declarations before the keyboard handler to fix "variable used before declaration" errors.

**Key decisions:**

- **Normalized 0-1 coordinates** — All annotation element coordinates are in the 0-1 range, denormalized at render time by canvas dimensions. This ensures annotations scale correctly with video size and window resizing.
- **Privacy auto-determined by role** — Coach annotations are always public, player annotations always private. No UI choice needed — simplifies the UX and prevents accidental privacy mistakes.
- **`shownAnnotationIds` ref Set** — Tracks which annotations have been displayed during a playback session. Prevents re-triggering the same annotation when the time cursor passes through the same region. Reset on manual seek so annotations can trigger again.
- **Canvas overlay approach** — The canvas sits on top of the video element. In playback mode it's `pointer-events-none` (transparent to clicks). In annotation mode it captures all pointer events with `pointer-events-auto cursor-crosshair`. This is cleaner than toggling event handlers.
- **Annotation state before keyboard handler** — React hooks must be declared before they're referenced in other hooks/effects. The keyboard handler `useEffect` references `annotationMode`, `activeAnnotation`, and `annotationCanvas`, so all annotation state must be declared first.

**Files created (7):**

- `packages/types/src/annotations.ts` — Shared annotation types
- `apps/api/src/routes/v1/annotations/routes.ts` — CRUD API
- `apps/api/src/routes/v1/annotations/index.ts` — Barrel export
- `apps/web/app/(authenticated)/games/components/annotation-renderer.ts` — Canvas rendering
- `apps/web/app/(authenticated)/games/components/use-annotation-canvas.ts` — Drawing hook
- `apps/web/app/(authenticated)/games/components/annotation-toolbar.tsx` — Tool UI
- `apps/web/app/(authenticated)/games/components/annotation-list.tsx` — Sidebar list

**Files modified (9):**

- `packages/db/prisma/schema.prisma` — Annotation model + relations
- `packages/types/src/index.ts` — Export annotations
- `packages/types/package.json` — Add `"./annotations"` export
- `packages/types/src/validations.ts` — Annotation Zod schema
- `apps/api/src/routes/v1/index.ts` — Wire annotation routes
- `apps/web/app/(authenticated)/games/[gameId]/page.tsx` — Fetch annotations, pass userId
- `apps/web/app/(authenticated)/games/[gameId]/game-playback.tsx` — Annotation state hub, keyboard shortcuts, canvas integration
- `apps/web/app/(authenticated)/games/components/video-player.tsx` — Canvas mode, annotation rendering, toolbar slot
- `apps/web/app/(authenticated)/games/components/player-controls.tsx` — Keyframe diamond indicators
- `apps/web/app/(authenticated)/games/components/game-sidebar.tsx` — Annotations section

**Type-check status:** `apps/web` ✅ | `apps/api` ✅ | `apps/docs` ✅ | `@repo/ui` ✅
