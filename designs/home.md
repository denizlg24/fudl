# Authenticated Home Page — Design Spec

> **Route:** `/dashboard`
> **Access:** All authenticated users with an active organization
> **Purpose:** The central hub. A game library where coaches and players can browse games, watch clips, and access AI analysis. This page should feel like Hudl's home feed — video-first, scannable, action-oriented — but with a cleaner, more minimalist aesthetic unique to FUDL.

---

## Design Philosophy

- **Video-first.** The home page is a library of games, not a settings dashboard. Every element should serve the goal of getting the user to their footage as fast as possible.
- **Density without clutter.** Show many games in a scannable format, but use whitespace and hierarchy to keep it breathable. No card borders or heavy shadows — rely on spacing and subtle background shifts.
- **Dark-mode native.** Design for dark mode first (sports apps are used in film rooms, sidelines, low-light environments). Light mode is secondary.
- **Warm, athletic palette.** Use the existing FUDL primary (warm orange/amber `oklch(0.67 0.137 49)`) as the accent color. It should appear sparingly — on CTAs, active states, and AI-related badges — not painted everywhere.

---

## Global App Shell

The current implementation has no shared app shell — each page re-renders its own inline header. This must change. A persistent shell wraps all authenticated pages.

### Top Navigation Bar

A slim, fixed-to-top bar (`h-14`, `bg-background/80 backdrop-blur-sm`, bottom border `border-border`).

```
┌────────────────────────────────────────────────────────────────────────┐
│  [FUDL logo]          [Home]  [Seasons]              [? ] [  Avatar ▾]│
└────────────────────────────────────────────────────────────────────────┘
```

**Left section:**

- FUDL wordmark or logo. Small, understated. No heavy branding. Clicking it navigates to `/dashboard`.

**Center/main navigation:**

- **Home** — Active when on `/dashboard`. The game feed.
- **Seasons** — Links to `/seasons`. A separate page for managing season/game hierarchy (not covered in this spec).

These are simple text links, not buttons. The active link uses `text-foreground font-medium`, inactive uses `text-muted-foreground`. An active indicator is a 2px bottom border in `primary` color, aligned to the bottom of the nav bar.

**Right section:**

- A subtle icon button for quick actions (e.g., upload, or a `?` help icon). Ghost variant, `size="icon"`.
- **User avatar** — Circular, 32px. Clicking opens a dropdown menu:
  - User name + email (label, non-clickable)
  - Separator
  - "Profile settings" — links to `/settings/profile`
  - "Team settings" — links to `/settings/team` (visible only to owners/admins)
  - Separator
  - Active organization name with a small badge. If the user belongs to multiple orgs, this section shows a list of orgs to switch between.
  - Separator
  - "Sign out" — destructive text color

The nav bar does NOT contain the organization name prominently. The org context is implicit — it's shown in the avatar dropdown and (subtly) in the page content below.

### Why No Sidebar

Hudl uses a left sidebar. FUDL intentionally does not, for now. Reasons:

1. The feature set is small (games, seasons, settings). A sidebar would be empty padding.
2. Flag football teams are small — there's no need for complex navigation hierarchies.
3. A top nav is more mobile-friendly and feels more modern/minimal for a small app.

If the feature set grows (playbooks, scouting reports, messaging), a sidebar can be introduced later. The CSS tokens for sidebar are already defined in `globals.css`.

---

## Page Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│  Top Nav Bar (fixed)                                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Page Header                                                      │  │
│  │  "Games"                   [Season filter ▾]  [Upload video]      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Game Card (full width)                                           │  │
│  │  ┌────────────┐                                                   │  │
│  │  │  Thumbnail  │  vs. Opponent Name                               │  │
│  │  │  (16:9)     │  Oct 14, 2025 · Home · Season Name               │  │
│  │  │             │  3 clips · AI analysis complete                   │  │
│  │  └────────────┘                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Game Card                                                        │  │
│  │  ┌────────────┐                                                   │  │
│  │  │  Thumbnail  │  vs. Rival Team                                  │  │
│  │  │  (16:9)     │  Oct 7, 2025 · Away · Fall 2025                  │  │
│  │  │  ░░░░░░░░░░ │  1 clip · Processing...  [██████░░░] 65%         │  │
│  │  └────────────┘                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Game Card (no videos yet)                                        │  │
│  │                                                                   │  │
│  │  vs. Some Team                                                    │  │
│  │  Sep 30, 2025 · Home · Fall 2025                                  │  │
│  │  No footage yet  [Upload video]                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ... more games ...                                                    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Container

- `max-w-4xl mx-auto` for the main content area.
- `px-4 sm:px-6` horizontal padding.
- `pt-6 pb-12` vertical padding (below the fixed nav bar, accounting for `h-14` nav height with `pt-14` on the body/main wrapper, then `pt-6` for content spacing).

---

## Page Header

A row with the page title and primary actions.

```
Games                                   [Season ▾]   [+ Upload video]
```

- **"Games"** — `text-2xl font-semibold tracking-tight`. No subtitle. The word "Games" alone; no "Your games" or "Game library."
- **Season filter** — A `<Select>` dropdown (from `@repo/ui`). Options: "All seasons" (default), then each season by name. Filtering narrows the game list. Compact size (`h-9`).
- **Upload video button** — `<Button variant="default">` (primary/orange). Icon: `Upload` from lucide-react, left-aligned. Text: "Upload video". This is the most important CTA on the page.

When no games or seasons exist yet (fresh organization), the header still shows but the filter is hidden.

---

## Game List

The core of the page. A vertical list of game cards, ordered by date (most recent first). This is NOT a grid — it's a single-column feed, similar to how Hudl shows a timeline of events.

### Game Card

Each game is a single row-like card. It is not wrapped in a `<Card>` with borders — instead it uses a subtle `hover:bg-accent/50` background transition and a thin bottom border (`border-b border-border`) to separate items. This keeps the design flat and clean.

**Layout: Horizontal, left-to-right.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐                                                   │
│  │              │  vs. Opponent Name                        [►] [⋯] │
│  │  Thumbnail   │  Oct 14, 2025 · Home · Fall 2025                  │
│  │  160×90      │  3 clips · AI analysis complete ✓                 │
│  │              │                                                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Thumbnail (left):**

- 160px wide, 90px tall (16:9 aspect ratio). Rounded corners (`rounded-lg`).
- If video exists and has a thumbnail URL: show the thumbnail with a subtle dark overlay gradient at the bottom.
- If video exists but no thumbnail: show a dark placeholder with a `Film` icon (lucide) centered, `text-muted-foreground`.
- If no video: show a lighter placeholder (`bg-muted`) with a dashed border and `Video` icon, indicating "no footage."
- On hover, show a semi-transparent play button overlay (circle with triangle) in the center.

**Content (middle, flex-1):**

- **Line 1 — Opponent:** `text-base font-medium text-foreground`. Format: `vs. {opponent}`. If no opponent is set, show the game's title or "Untitled game" in `text-muted-foreground italic`.
- **Line 2 — Meta:** `text-sm text-muted-foreground`. Segments separated by `·` (middle dot). Includes:
  - Date: formatted as `MMM D, YYYY` (e.g., "Oct 14, 2025")
  - Location: "Home" / "Away" / omitted if not set
  - Season name: if the game is linked to a season
- **Line 3 — Video status:** `text-sm`. This line adapts based on state:
  - **Has completed videos:** `"{n} clips"` in `text-muted-foreground`. If AI analysis is complete, append a check icon and `"AI analysis complete"` in `text-primary` (orange).
  - **Video processing:** `"Processing..."` with a small inline `<Progress>` bar component (from `@repo/ui`). Shows percentage. Use `text-muted-foreground` for text, primary color for the progress bar fill.
  - **No videos:** `"No footage yet"` in `text-muted-foreground`, followed by an inline text button `"Upload"` in `text-primary` that triggers the upload flow.

**Actions (right, flex-shrink-0):**

- **Play button:** Only visible if the game has at least one completed video. A circular `<Button variant="ghost" size="icon">` with a `Play` icon. Clicking navigates to the game detail/video player page.
- **More menu:** A `<DropdownMenu>` triggered by a vertical `MoreVertical` icon button (`variant="ghost" size="icon"`). Items:
  - "View game" — navigates to game detail
  - "Edit game" — opens edit modal (owner/admin only)
  - "Upload video" — triggers upload flow
  - Separator
  - "Delete game" — destructive, owner only. Confirms via `<AlertDialog>`.

**Click behavior:** Clicking anywhere on the card (except action buttons) navigates to the game detail page.

**Hover state:** `bg-accent/50` background, smooth transition (`transition-colors duration-150`).

### Game Card — Processing State

When a video is being processed by the ML pipeline, the card shows real-time progress:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐                                                   │
│  │              │  vs. Crosstown Rivals                      [⋯]    │
│  │  Thumbnail   │  Oct 7, 2025 · Away · Fall 2025                   │
│  │  (animated   │  Processing: Detecting routes...                  │
│  │   pulse)     │  [████████████████░░░░░░░░] 65%                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

- The thumbnail gets a subtle `animate-pulse` overlay (a slow-pulsing semi-transparent layer).
- Line 3 shows the current processing step (from job progress data): "Extracting frames...", "Detecting players...", "Classifying routes...", etc.
- Below the text, a `<Progress>` bar spanning the width of the content area.
- No play button shown during processing.

### Game Card — Video Upload In Progress

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐                                                   │
│  │  ░░░░░░░░░░░ │  vs. East Side Eagles                    [✕]     │
│  │  Uploading   │  Oct 1, 2025 · Home                               │
│  │  ░░░░░░░░░░░ │  Uploading video...                               │
│  │              │  [██████░░░░░░░░░░░░░░░░░░] 28%                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

- Thumbnail shows an upload icon with a pulsing background.
- Progress bar uses `primary` fill.
- Cancel button (`X` icon) replaces the more menu.

---

## Empty State

When the organization has zero games:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                          ┌──────────────┐                            │
│                          │    (icon)     │                            │
│                          │   Football    │                            │
│                          └──────────────┘                            │
│                                                                      │
│                    No games yet                                      │
│                                                                      │
│           Upload your first game footage to get started.             │
│           FUDL will automatically detect routes and                  │
│           provide AI-powered analysis.                               │
│                                                                      │
│                      [+ Upload video]                                │
│                       [Create a game]                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Use the `<Empty>` component from `@repo/ui`:

- `<EmptyMedia>` — A large (64px) `Football` or `Video` icon from lucide, in `text-muted-foreground`.
- `<EmptyTitle>` — "No games yet"
- `<EmptyDescription>` — Brief explanation of what FUDL does.
- `<EmptyContent>` — Two buttons stacked:
  - Primary: "Upload video" (full primary button)
  - Secondary: "Create a game" (outline/ghost button)

---

## Quick Stats Bar (Optional Enhancement)

Below the page header and above the game list, a subtle horizontal strip showing aggregate numbers. Only shown when the org has data.

```
┌──────────────────────────────────────────────────────────────────────┐
│   12 games   ·   34 clips   ·   8 analyzed   ·   Fall 2025          │
└──────────────────────────────────────────────────────────────────────┘
```

- `text-sm text-muted-foreground`. Not styled as cards — just a plain text line.
- Shows: total games, total video clips, number with completed AI analysis, active season name.
- This is subtle context, not a dashboard. No charts, no heavy visuals.

---

## Mobile Responsiveness

### Breakpoints

- **Desktop (>= 1024px):** Full layout as described above. Thumbnail 160x90.
- **Tablet (640px - 1023px):** Same layout, thumbnail shrinks to 128x72.
- **Mobile (< 640px):** Game card stacks vertically:
  - Thumbnail goes full-width at top of card (16:9 aspect ratio, max height ~180px).
  - Content below thumbnail.
  - Actions row below content (play button left, more menu right).

### Mobile Navigation

The top nav bar remains fixed. On mobile (`< 640px`):

- Logo stays left.
- Navigation links collapse into a hamburger menu (Sheet/Drawer from right).
- Avatar stays right.
- The "Upload video" button in the page header becomes icon-only (just the `Upload` icon, no text).

---

## Interaction Details

### Upload Flow (Future)

The "Upload video" button will eventually trigger one of:

1. A file picker dialog (for local file upload to S3).
2. A modal/sheet with upload options (drag-and-drop zone, URL input, device camera).

For now (before S3 integration), the button should exist but show a toast: "Video upload coming soon." This keeps the design intentional without dead-ending the user.

### Season Filter

- Default: "All seasons" (shows all games, grouped chronologically).
- When a season is selected, the game list filters to only games in that season.
- The filter state should be preserved in the URL as a query param: `?season={seasonId}`.
- Uses the `<Select>` component from `@repo/ui`.

### Keyboard Navigation

- `Tab` moves focus through game cards sequentially.
- `Enter` on a focused game card navigates to its detail page.
- `Escape` closes any open dropdown menus.
- The more menu (`⋯`) is reachable via `Tab` and operable via `Enter`/`Arrow keys`.

### Loading State

While games are being fetched:

- Show 3-4 skeleton cards using the `<Skeleton>` component from `@repo/ui`.
- Each skeleton mirrors the game card layout: a rectangle for the thumbnail, three lines for text.
- No spinner. Skeletons are more informative and feel faster.

---

## Color & Typography Reference

| Element               | Light Mode                           | Dark Mode                            |
| --------------------- | ------------------------------------ | ------------------------------------ |
| Page background       | `bg-background` (white)              | `bg-background` (near-black)         |
| Card hover            | `bg-accent/50` (light gray)          | `bg-accent/50` (dark gray)           |
| Card separator        | `border-border`                      | `border-border`                      |
| Primary text          | `text-foreground`                    | `text-foreground`                    |
| Secondary text        | `text-muted-foreground`              | `text-muted-foreground`              |
| AI badge / accent     | `text-primary` (warm orange)         | `text-primary` (warm orange)         |
| Upload button         | `bg-primary text-primary-foreground` | `bg-primary text-primary-foreground` |
| Progress bar fill     | `bg-primary`                         | `bg-primary`                         |
| Thumbnail placeholder | `bg-muted`                           | `bg-muted`                           |

| Element           | Style                                    |
| ----------------- | ---------------------------------------- |
| Page title        | `text-2xl font-semibold tracking-tight`  |
| Game opponent     | `text-base font-medium`                  |
| Game meta         | `text-sm text-muted-foreground`          |
| Video status      | `text-sm`                                |
| Empty state title | `text-lg font-semibold`                  |
| Empty state desc  | `text-sm text-muted-foreground max-w-md` |
| Quick stats       | `text-sm text-muted-foreground`          |

---

## Components Used from `@repo/ui`

- `Button` — primary CTA ("Upload video"), ghost (icon buttons), outline (secondary)
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` — season filter
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel` — avatar menu, game more menu
- `Avatar`, `AvatarImage`, `AvatarFallback` — user avatar in nav
- `Progress` — video processing progress bar
- `Skeleton` — loading state
- `AlertDialog` — delete confirmation
- `Badge` — AI analysis status, role indicators
- `Separator` — visual dividers
- `Empty`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` — empty state
- `Tooltip`, `TooltipTrigger`, `TooltipContent` — icon button hints

---

## Data Requirements

The page fetches from the API:

1. **Games list** — `GET /orgs/:orgId/games` (with optional `?seasonId` filter). Needs to include:
   - Game fields: id, opponent, date, location, notes, seasonId
   - Related season name (via join or separate fetch)
   - Video count per game
   - Latest video status per game (for showing processing state)
   - AI analysis completion flag per game

2. **Seasons list** — `GET /orgs/:orgId/seasons` (for the filter dropdown).

3. **Active job status** — For games with videos in `PROCESSING` state, poll or SSE for real-time progress updates.

### Fetching Strategy

- Initial page load: Fetch games + seasons in parallel (`Promise.all`).
- Season filter change: Re-fetch games with `?seasonId` query param.
- Processing updates: Poll every 3 seconds for games with `PROCESSING` status, or subscribe to SSE endpoint.
- Consider migrating to React Query / SWR for caching, deduplication, and optimistic updates.

---

## What This Is NOT

- This is NOT an analytics dashboard. No charts, no stats panels, no KPI cards.
- This is NOT a calendar view. Games are listed chronologically, not in a calendar grid.
- This is NOT a video player. Clicking a game navigates to a separate game detail page with the player.
- This is NOT a file manager. Videos are attached to games, not listed independently.
