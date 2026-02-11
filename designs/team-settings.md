# Team Settings — Design Spec

> **Route:** `/settings/team`
> **Access:** Organization owners and admins only. Members without owner/admin role should not see this link in navigation and should be redirected if they navigate here directly.
> **Purpose:** A single, focused settings page where team managers configure their organization, manage members, and control invite access. This replaces the current `/settings/members` page and expands it into a proper settings hub.

---

## Design Philosophy

- **Settings, not a dashboard.** This page is for configuration, not daily use. It should be clean, functional, and straightforward. No decorative elements.
- **Single page with sections.** No tab navigation or nested routes. All team settings live on one scrollable page, organized by clear section headings. This reduces navigation friction — coaches want to get in, change something, and get out.
- **Destructive actions require confirmation.** Removing members, revoking links, and deleting the organization all use `<AlertDialog>` confirmations.
- **Inline editing where possible.** Avoid modals for simple field edits. Use inline forms that appear on click and collapse on save/cancel.

---

## Page Layout

The page uses the same global app shell (top nav bar) described in `home.md`. The nav bar's avatar dropdown highlights "Team settings" as the active item.

### Container

- `max-w-3xl mx-auto` — narrower than the home page. Settings pages don't need width.
- `px-4 sm:px-6` horizontal padding.
- `pt-6 pb-16` vertical padding.

### Page Header

```
← Back to games

Team Settings
Manage your team, members, and invite links.
```

- **Back link:** `text-sm text-muted-foreground hover:text-foreground` with a `ChevronLeft` icon. Links to `/dashboard`. Positioned above the title.
- **Title:** `text-2xl font-semibold tracking-tight`. "Team Settings".
- **Subtitle:** `text-sm text-muted-foreground mt-1`. One line describing the page purpose.

---

## Sections

The page is divided into clearly labeled sections, separated by `<Separator>` components with generous spacing (`space-y-10` between sections).

### Section 1: Team Profile

The organization's identity. This is the top section because it's the least-changed but most important context.

```
Team Profile
─────────────────────────────────────────────

  Team name          [  Thunderbolts Flag Football  ] [Save]

  Team slug          thunderbolts
                     https://fudl.app/t/thunderbolts

  Created            January 15, 2025
```

**Fields:**

| Field     | Type       | Editable          | Notes                                                                                                                                                                                    |
| --------- | ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team name | Text input | Yes (owner only)  | Inline edit. Shows current name as text; clicking reveals an input + Save/Cancel buttons. Uses `react-hook-form` + zod (min 2 chars). On save, calls `authClient.organization.update()`. |
| Team slug | Text       | No (display only) | Shown as plain text with the full URL below it in `text-xs text-muted-foreground`. Slugs are immutable after creation.                                                                   |
| Created   | Text       | No                | Formatted date. `text-sm text-muted-foreground`.                                                                                                                                         |

**Layout:** Each field is a horizontal row on desktop (`flex items-center justify-between`):

- Label on the left: `text-sm font-medium w-32 flex-shrink-0`
- Value/input on the right: `flex-1`

On mobile (`< 640px`), stack vertically: label above, value below.

---

### Section 2: Members

The roster of people in the organization. This is the most interactive section.

```
Members (4)
─────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────┐
│  [DT]  Deniz Turkmen          Owner        Joined Jan 15     — │
│  [JK]  Jake Kim               Admin        Joined Feb 1    [⋯] │
│  [SR]  Sarah Rodriguez        Member       Joined Feb 3    [⋯] │
│  [MC]  Mike Chen              Member       Joined Feb 5    [⋯] │
└─────────────────────────────────────────────────────────────────┘

                                              [+ Invite member]
```

**Section header:**

- "Members" with the count in parentheses. `text-lg font-semibold`.
- The count uses `text-muted-foreground` within the heading.

**Member list:**

Each member is a row (not a table — a flat list with consistent alignment). Use the `<Item>` component from `@repo/ui` for each row.

```
[Avatar]  Name / Email          Role Badge       Joined Date      Actions
```

- **Avatar:** 36px, circular. `<Avatar>` with `<AvatarFallback>` showing initials. No images for now (no profile photo upload exists).
- **Name:** `text-sm font-medium`. Below it, the email in `text-xs text-muted-foreground`. These are stacked vertically within the same cell.
- **Role badge:** `<Badge>` component.
  - Owner: `variant="default"` (primary orange background). Text: "Owner".
  - Admin: `variant="secondary"` (teal background). Text: "Admin".
  - Member: `variant="outline"`. Text: "Member".
- **Joined date:** `text-sm text-muted-foreground`. Format: "Joined MMM D" (short, no year unless different from current year).
- **Actions:** A `<DropdownMenu>` triggered by `MoreHorizontal` icon button (`variant="ghost" size="icon-sm"`).
  - For the current user's own row: no actions (you can't remove yourself if you're the owner).
  - For other members (owner can modify all; admin can modify members only):
    - "Change role" → submenu with role options (Admin, Member). Uses `authClient.organization.updateMemberRole()`.
    - Separator
    - "Remove from team" → destructive. Triggers `<AlertDialog>`: "Remove {name}? They will lose access to all team data."

The owner row does NOT show the more menu — the owner cannot be removed or demoted.

**Invite button:**

Below the member list, right-aligned:

- `<Button variant="outline" size="sm">` with `UserPlus` icon. Text: "Invite member".
- Clicking opens an inline form (not a modal) that slides in below the button:

```
┌─────────────────────────────────────────────────────────────────┐
│  Email address     [                         ]                  │
│  Role              [Member ▾]                                   │
│                                       [Cancel]  [Send invite]   │
└─────────────────────────────────────────────────────────────────┘
```

- Email: `<Input type="email">` with zod validation.
- Role: `<Select>` with options: "Member" (default), "Admin".
- Send invite: `<Button variant="default" size="sm">`. Calls `authClient.organization.inviteMembers()`.
- On success: toast notification "Invitation sent to {email}", form collapses, pending invitations section updates.
- On error: inline error message below the email field.

---

### Section 3: Pending Invitations

Only shown when there are active pending invitations. Collapses entirely when empty.

```
Pending Invitations (2)
─────────────────────────────────────────────

  sarah@example.com     Admin     Expires Feb 15     [Cancel]
  mike@example.com      Member    Expires Feb 20     [Cancel]
```

**Layout:** Same row-based list as Members.

- **Email:** `text-sm font-medium`.
- **Role:** `<Badge variant="outline">`.
- **Expires:** `text-sm text-muted-foreground`. Format: "Expires MMM D". If expired, show "Expired" in `text-destructive`.
- **Cancel button:** `<Button variant="ghost" size="icon-sm">` with `X` icon. No confirmation dialog (canceling an invitation is low-risk). Calls `authClient.organization.cancelInvitation()`.

---

### Section 4: Invite Links

Shareable links for onboarding new members without email invitations.

```
Invite Links
─────────────────────────────────────────────

Generate a shareable link that lets anyone join your team.

  ┌─ New Link ─────────────────────────────────────────────────┐
  │  Role        [Member ▾]                                     │
  │  Max uses    [  25  ]                                       │
  │  Expires in  [7 days ▾]                                     │
  │                                          [Generate link]    │
  └─────────────────────────────────────────────────────────────┘

  Active Links

  ┌───────────────────────────────────────────────────────────────┐
  │  fudl.app/invite?token=a8f3...    Member   5/25 used         │
  │  Expires Feb 20                   Active   [Copy] [Revoke]   │
  ├───────────────────────────────────────────────────────────────┤
  │  fudl.app/invite?token=k9d2...    Admin    12/25 used        │
  │  Expires Feb 14                   Expired                    │
  └───────────────────────────────────────────────────────────────┘
```

**Section header:**

- "Invite Links" — `text-lg font-semibold`.
- One-line description below: `text-sm text-muted-foreground`.

**Generation form:**

A compact inline form with a subtle border (`border border-border rounded-lg p-4`). NOT a `<Card>` — just a bordered area.

| Field      | Component               | Options                                | Default |
| ---------- | ----------------------- | -------------------------------------- | ------- |
| Role       | `<Select>`              | Member, Admin                          | Member  |
| Max uses   | `<Input type="number">` | 1-1000                                 | 25      |
| Expires in | `<Select>`              | 1 hour, 1 day, 2 days, 7 days, 30 days | 7 days  |

- "Generate link" button: `<Button variant="default" size="sm">`.
- On success: The new link appears at the top of the active links list. The link URL is automatically copied to clipboard. A toast confirms: "Link copied to clipboard."

**Active links list:**

Each link is a row with two lines:

Line 1:

- **URL (truncated):** `text-sm font-mono`. Show first 30 chars of the token, truncated with `...`. The full URL is copied on the "Copy" button click.
- **Role badge:** `<Badge variant="outline">`.
- **Usage:** `text-sm text-muted-foreground`. Format: "{useCount}/{maxUses} used".

Line 2:

- **Expiry:** `text-sm text-muted-foreground`. Format: "Expires MMM D" or "Expired" in `text-destructive`.
- **Status:** `<Badge>` — "Active" in green-ish outline, or "Revoked" / "Expired" in muted/destructive.
- **Actions:**
  - "Copy" — `<Button variant="ghost" size="icon-sm">` with `Copy` icon. Copies full URL to clipboard, shows toast.
  - "Revoke" — `<Button variant="ghost" size="icon-sm">` with `Ban` icon. Only shown for active links. Triggers `<AlertDialog>`: "Revoke this link? It will no longer be usable." Calls `DELETE /orgs/:orgId/invite-links/:linkId`.

Links are ordered: active first (newest at top), then expired/revoked (collapsed by default, expandable via "Show expired links" text button).

---

### Section 5: Danger Zone

The final section, visually distinct to indicate irreversible actions.

```
Danger Zone
─────────────────────────────────────────────

┌─── border-destructive ────────────────────────────────────────┐
│                                                                │
│  Delete team                                                   │
│  Permanently delete this team and all its data.                │
│  This action cannot be undone.                                 │
│                                                [Delete team]   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- Section title: `text-lg font-semibold text-destructive`.
- Container: `border border-destructive/50 rounded-lg p-6`. Subtle destructive border, not a loud red background.
- Description: `text-sm text-muted-foreground`. Two lines explaining consequences.
- Delete button: `<Button variant="destructive" size="sm">`. Text: "Delete team".
- Clicking triggers a multi-step `<AlertDialog>`:
  1. Title: "Delete {team name}?"
  2. Description: "This will permanently delete all games, videos, seasons, and analysis data for this team. All members will lose access. This cannot be undone."
  3. Input: "Type the team name to confirm:" — text input that must exactly match the org name.
  4. Buttons: "Cancel" (outline) and "Delete team" (destructive, disabled until name matches).

Only visible to the organization owner. Admins cannot see the Danger Zone.

---

## Mobile Layout

On mobile (`< 640px`):

- All sections stack vertically with `space-y-8` (slightly tighter than desktop).
- Member rows: avatar + name/email stack left, role badge and date move below the name (still on one row), actions stay right.
- Invite form fields stack vertically instead of horizontal grid.
- Invite link rows: URL on first line (full width), meta + actions on second line.
- Danger Zone card: full width with no change.

---

## Loading State

- Page title and "Back" link render immediately (static).
- Each section shows `<Skeleton>` placeholders:
  - Team Profile: 3 skeleton lines.
  - Members: 3-4 skeleton rows matching member row height.
  - Pending Invitations: 1-2 skeleton rows (or hidden if none).
  - Invite Links: skeleton form + 1-2 skeleton rows.
- Loading completes when all API calls resolve (fetched in parallel).

---

## Error States

- **No permission:** If a non-owner/non-admin navigates here, show a full-page message:

  ```
  You don't have permission to access team settings.
  Contact your team owner for access.
  [← Back to games]
  ```

  Uses `<Empty>` component with `ShieldAlert` icon.

- **API errors:** Inline error messages below the section header. Format: `text-sm text-destructive` with a `AlertCircle` icon. Include a "Retry" text button.

- **Network failure:** Toast notification via Sonner: "Failed to load team settings. Check your connection."

---

## Data Requirements

All calls are org-scoped (using `activeOrg.id`):

| Data                | Endpoint                                        | Notes                               |
| ------------------- | ----------------------------------------------- | ----------------------------------- |
| Org details         | `authClient.useActiveOrganization()`            | Already available from auth context |
| Members             | `authClient.organization.listMembers()`         | Includes user details               |
| Current user role   | `authClient.organization.getActiveMemberRole()` | For permission checks               |
| Pending invitations | `authClient.organization.listInvitations()`     | Filter to status = "pending"        |
| Invite links        | `GET /orgs/:orgId/invite-links`                 | Custom API endpoint                 |

### Fetching Strategy

- Fetch all data in parallel on mount (`Promise.all`).
- After mutations (invite, remove, revoke), re-fetch only the affected section.
- No polling needed — this page is not real-time.

---

## Components Used from `@repo/ui`

- `Button` — primary, outline, ghost, destructive variants
- `Input` — team name edit, email invite, max uses
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` — role selectors, expiry duration
- `Badge` — role indicators, link status
- `Avatar`, `AvatarFallback` — member avatars
- `DropdownMenu` + subcomponents — member actions
- `AlertDialog` + subcomponents — destructive action confirmations
- `Separator` — section dividers
- `Skeleton` — loading state
- `Empty`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription` — permission denied state
- `Label` — form field labels
- `Tooltip`, `TooltipTrigger`, `TooltipContent` — icon button hints

---

## Differences from Current Implementation

The current `/settings/members` page is a monolithic 743-line client component. Key changes:

| Current                                                  | New Design                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| No back navigation                                       | "Back to games" link at top                                               |
| Duplicated inline header/nav                             | Uses shared app shell from `home.md`                                      |
| Members, invitations, invite links all in one dense page | Same content, but organized into clearly separated sections with headings |
| Table layout for members                                 | Flat list with `<Item>` component — more readable, better mobile          |
| Invite form always visible                               | Invite form collapsed by default, expands on click                        |
| No org profile editing                                   | Team Profile section with inline name editing                             |
| No danger zone                                           | Explicit danger zone for org deletion                                     |
| No permission denied state                               | Full-page permission guard                                                |
| Spinner for loading                                      | Skeleton placeholders                                                     |
| `getInitials()` duplicated                               | Extract to shared utility                                                 |
