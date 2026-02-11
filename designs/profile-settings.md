# Profile Settings — Design Spec

> **Route:** `/settings/profile`
> **Access:** All authenticated users
> **Purpose:** A personal settings page where a user manages their own account — name, email, password, and preferences. This is user-scoped, not org-scoped. Changes here affect the user across all organizations they belong to.

---

## Design Philosophy

- **Personal and quiet.** This is the user's private space. No team data, no org context. The design should feel calm and personal — generous whitespace, simple forms, no information density.
- **Save-per-field, not save-all.** Each editable field has its own inline save button. No "Save all changes" button at the bottom. This is more forgiving (users don't lose partial changes) and matches modern SaaS patterns (GitHub, Vercel, Linear).
- **Progressive disclosure.** Password change and account deletion are collapsed by default. Users expand them intentionally.

---

## Page Layout

Uses the same global app shell (top nav bar) described in `home.md`. The nav bar's avatar dropdown highlights "Profile settings" as the active item.

### Container

- `max-w-2xl mx-auto` — even narrower than team settings. Profile pages are intimate.
- `px-4 sm:px-6` horizontal padding.
- `pt-6 pb-16` vertical padding.

### Page Header

```
← Back to games

Profile
Your personal account settings.
```

- **Back link:** Same pattern as team settings. `ChevronLeft` + "Back to games". Links to `/dashboard`.
- **Title:** `text-2xl font-semibold tracking-tight`. "Profile".
- **Subtitle:** `text-sm text-muted-foreground mt-1`.

---

## Sections

Organized vertically with `space-y-10` between sections, divided by `<Separator>`.

### Section 1: Avatar & Identity

The top section establishes who the user is. It combines the avatar with the user's display name.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│     ┌──────┐                                                     │
│     │      │                                                     │
│     │  DT  │   Deniz Turkmen                                     │
│     │      │   deniz@example.com                                 │
│     └──────┘   Member of 2 teams                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- **Avatar:** 72px circular. Uses `<Avatar>` with `<AvatarFallback>` showing initials. No upload functionality for now (no file storage exists). When profile photo upload is implemented, overlay a camera/pencil icon on hover.
- **Name:** `text-xl font-semibold`. The display name.
- **Email:** `text-sm text-muted-foreground`. The primary email.
- **Team count:** `text-sm text-muted-foreground`. Format: "Member of {n} team(s)". Clickable — could link to a team switcher in the future, but for now just plain text.

This section is display-only. Editing name/email happens in the fields below.

---

### Section 2: Personal Information

Editable fields for the user's core account data.

```
Personal Information
─────────────────────────────────────────────

  Display name
  ┌──────────────────────────────────┐
  │  Deniz Turkmen                   │  [Save]
  └──────────────────────────────────┘

  Email address
  ┌──────────────────────────────────┐
  │  deniz@example.com               │  [Save]
  └──────────────────────────────────┘
  Changing your email will require re-verification.
```

**Layout:** Vertical stack. Each field is a group:

- **Label:** `text-sm font-medium` above the input.
- **Input:** Full-width `<Input>` component.
- **Save button:** `<Button variant="outline" size="sm">` aligned to the right of the input, on the same row. Disabled when value hasn't changed. Shows a `<Spinner>` during save. After saving, briefly shows a `Check` icon with `text-primary` for 2 seconds, then reverts to "Save" text.
- **Helper text (optional):** `text-xs text-muted-foreground` below the input.

**Fields:**

| Field         | Input Type | Validation        | Save API                               | Notes                                                       |
| ------------- | ---------- | ----------------- | -------------------------------------- | ----------------------------------------------------------- |
| Display name  | `text`     | Min 2 chars (zod) | `authClient.updateUser({ name })`      | Updates across all orgs                                     |
| Email address | `email`    | Valid email (zod) | `authClient.changeEmail({ newEmail })` | Triggers verification email. Show warning text below input. |

**Email change flow:**

1. User types new email → clicks Save.
2. API sends verification email to new address.
3. Toast: "Verification email sent to {newEmail}. Please check your inbox."
4. Email does NOT change until verified. Current email stays displayed.
5. If a pending email change exists, show an inline notice below the field:
   ```
   Pending: verification sent to new@example.com. [Resend] [Cancel]
   ```

---

### Section 3: Password

Password management. Collapsed by default behind a disclosure trigger.

```
Password
─────────────────────────────────────────────

  [Change password ▸]
```

Clicking "Change password" expands the section:

```
Password
─────────────────────────────────────────────

  Change password                                              [▾]

  Current password
  ┌──────────────────────────────────┐
  │  ••••••••                        │
  └──────────────────────────────────┘

  New password
  ┌──────────────────────────────────┐
  │                                  │
  └──────────────────────────────────┘
  Must be at least 8 characters.

  Confirm new password
  ┌──────────────────────────────────┐
  │                                  │
  └──────────────────────────────────┘

                              [Cancel]  [Update password]
```

**Implementation:**

- Use `<Collapsible>` from `@repo/ui` for the expand/collapse behavior.
- Trigger: `<CollapsibleTrigger>` styled as a text button with `ChevronRight` icon (rotates to `ChevronDown` when open).
- Content: `<CollapsibleContent>` containing the password form.

**Fields:**

| Field                | Input Type | Validation              |
| -------------------- | ---------- | ----------------------- |
| Current password     | `password` | Required                |
| New password         | `password` | Min 8 chars             |
| Confirm new password | `password` | Must match new password |

- **Cancel:** Collapses the section and resets the form.
- **Update password:** `<Button variant="default" size="sm">`. Calls `authClient.changePassword({ currentPassword, newPassword })`.
- On success: toast "Password updated", section collapses, form resets.
- On error: inline error message below the relevant field. Common errors:
  - "Current password is incorrect" — below current password field.
  - "New password is too weak" — below new password field.

**Password strength indicator (optional enhancement):**

Below the "New password" input, a thin horizontal bar showing strength:

- Weak: single red segment
- Fair: two orange segments
- Strong: three green segments

Uses plain `<div>` elements with `bg-destructive`, `bg-primary`, or a green color. Not a critical feature — implement if time allows.

---

### Section 4: Appearance

Theme and display preferences.

```
Appearance
─────────────────────────────────────────────

  Theme
  ○ Light    ○ Dark    ● System

```

- **Theme switcher:** Three `<RadioGroup>` items from `@repo/ui`.
  - "Light" — forces light mode.
  - "Dark" — forces dark mode.
  - "System" (default) — follows OS preference.
- Implementation: Toggle the `.dark` class on `<html>` via `next-themes` (already a peer dependency of `@repo/ui`). Store preference in `localStorage`.
- Each radio option includes a small preview icon:
  - Light: `Sun` icon from lucide
  - Dark: `Moon` icon from lucide
  - System: `Monitor` icon from lucide

**Layout:** Horizontal on desktop (three options in a row), vertical on mobile.

**Alternative design (if radio feels too plain):** Three selectable cards in a row, each showing a mini-preview of the UI theme. The active card has a `ring-2 ring-primary` outline.

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  ☀ Light │  │  ☾ Dark  │  │  🖥 Auto │
│  ░░░░░░░ │  │  ▓▓▓▓▓▓▓ │  │  ░▓░▓░▓ │
│  ░░░░░░░ │  │  ▓▓▓▓▓▓▓ │  │  ░▓░▓░▓ │
└──────────┘  └──────────┘  └──────────┘
     ○              ●              ○
```

---

### Section 5: Teams

A read-only list of organizations the user belongs to, with the ability to leave a team.

```
Teams
─────────────────────────────────────────────

  ┌───────────────────────────────────────────────────────────────┐
  │  Thunderbolts Flag Football       Owner          [Active ✓]  │
  │  thunderbolts                                                 │
  ├───────────────────────────────────────────────────────────────┤
  │  Eastside Eagles                  Member         [Switch]     │
  │  eastside-eagles                                  [Leave]     │
  └───────────────────────────────────────────────────────────────┘
```

Each team row:

- **Team name:** `text-sm font-medium`.
- **Slug:** `text-xs text-muted-foreground` below the name.
- **Role badge:** `<Badge>` with the same variant scheme as team settings (Owner=default, Admin=secondary, Member=outline).
- **Actions (right side):**
  - If this is the active org: Show `<Badge variant="outline">` with a `Check` icon: "Active". No further actions.
  - If this is not the active org:
    - "Switch" — `<Button variant="ghost" size="sm">`. Calls `authClient.organization.setActive({ organizationId })`. On success, the page reloads with the new active org context.
    - "Leave" — `<Button variant="ghost" size="sm" className="text-destructive">`. Only shown for non-owner members. Triggers `<AlertDialog>`: "Leave {team name}? You'll lose access to all team data. You can rejoin if invited again."

The owner of a team CANNOT leave it. The "Leave" button is hidden for owners.

---

### Section 6: Danger Zone

Account-level destructive actions.

```
Danger Zone
─────────────────────────────────────────────

┌─── border-destructive ────────────────────────────────────────┐
│                                                                │
│  Delete account                                                │
│  Permanently delete your account and all personal data.        │
│  You will be removed from all teams. Teams you own will        │
│  need a new owner before deletion.                             │
│                                                [Delete account]│
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- Same visual pattern as the team settings danger zone: `border border-destructive/50 rounded-lg p-6`.
- **Delete account flow:**
  1. Click "Delete account" button (`<Button variant="destructive" size="sm">`).
  2. `<AlertDialog>` opens:
     - Title: "Delete your account?"
     - Description: Lists consequences — data deletion, team removal, owned teams warning.
     - If the user owns any teams: show a blocking warning: "You must transfer ownership of {team names} before deleting your account." Delete button is disabled.
     - If no owned teams: show confirmation input: "Type DELETE to confirm".
     - Buttons: "Cancel" (outline), "Delete account" (destructive, disabled until confirmation is valid).
  3. On confirm: calls account deletion API, signs out, redirects to `/login` with a toast: "Your account has been deleted."

---

## Form Behavior

### Per-Field Save Pattern

Each field operates independently:

1. **Idle state:** Input shows current value. Save button is `disabled` (grayed out).
2. **Dirty state:** User modifies the input. Save button becomes enabled (full contrast).
3. **Saving state:** User clicks Save. Button shows `<Spinner>` icon + "Saving..." text (or just spinner for small buttons). Input is `disabled` during save.
4. **Success state:** Button briefly shows `Check` icon with "Saved" text in `text-primary` for 2 seconds. Input re-enables with the new value.
5. **Error state:** Inline error message appears below the input in `text-destructive text-xs`. Save button reverts to enabled. The field value is NOT reset — the user can fix and retry.

### Validation

All fields use `react-hook-form` with zod schemas. Validation runs on:

- `onBlur` — show errors when the user leaves the field.
- `onSubmit` — final check before API call.
- NOT `onChange` — too aggressive for settings pages where the user is editing existing values.

---

## Mobile Layout

On mobile (`< 640px`):

- Avatar section: Avatar centered above name/email (stacked vertically).
- Form fields: Full width. Save buttons move below the input (full width `<Button>`).
- Theme selector: Vertical stack of radio options (or theme cards).
- Teams list: Same layout but team name and actions stack vertically.
- Danger Zone: Full width, no change.

---

## Loading State

- Page header renders immediately (static content).
- Avatar & Identity section: `<Skeleton>` circle (72px) + 3 skeleton text lines.
- Personal Information: 2 skeleton input groups.
- Password section: single skeleton line (just the collapsed trigger).
- Appearance: 3 skeleton rectangles (theme cards) or radio skeleton.
- Teams: 1-2 skeleton rows.
- Danger Zone: renders immediately (static content, no API dependency).

---

## Components Used from `@repo/ui`

- `Button` — save, cancel, destructive, ghost, outline variants
- `Input` — name, email, password fields
- `Avatar`, `AvatarFallback` — user avatar
- `Badge` — role indicators, "Active" team indicator
- `RadioGroup`, `RadioGroupItem` — theme switcher
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` — password section
- `AlertDialog` + subcomponents — delete account, leave team confirmations
- `Separator` — section dividers
- `Skeleton` — loading state
- `Label` — form field labels
- `Tooltip`, `TooltipTrigger`, `TooltipContent` — icon explanations

---

## Data Requirements

| Data                 | Source                               | Notes                  |
| -------------------- | ------------------------------------ | ---------------------- |
| User session         | `authClient.useSession()`            | Name, email, image, id |
| User's organizations | `authClient.useListOrganizations()`  | List of orgs with role |
| Active organization  | `authClient.useActiveOrganization()` | For the "Active" badge |
| Theme preference     | `localStorage` via `next-themes`     | No API call            |

### Mutations

| Action          | API                                                           | Notes                 |
| --------------- | ------------------------------------------------------------- | --------------------- |
| Update name     | `authClient.updateUser({ name })`                             |                       |
| Change email    | `authClient.changeEmail({ newEmail })`                        | Triggers verification |
| Change password | `authClient.changePassword({ currentPassword, newPassword })` |                       |
| Switch org      | `authClient.organization.setActive({ organizationId })`       |                       |
| Leave org       | `authClient.organization.removeMember({ memberIdOrUserId })`  | Pass own user ID      |
| Delete account  | `authClient.deleteUser()`                                     | Full account deletion |

---

## Relationship to Other Pages

| Link                                  | Source                                     | Target              |
| ------------------------------------- | ------------------------------------------ | ------------------- |
| Avatar dropdown → "Profile settings"  | Any page (nav bar)                         | `/settings/profile` |
| "Team settings" link in Teams section | This page (per-team row, owner/admin only) | `/settings/team`    |
| "Back to games"                       | This page (header)                         | `/dashboard`        |
| Post-delete redirect                  | This page (danger zone)                    | `/login`            |
