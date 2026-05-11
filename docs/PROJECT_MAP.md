# Project Map

A practical index of the codebase so you can jump from a feature/route directly to the file you need to edit in VS Code.

> Nothing in the platform's concept or content is changed by this document — it only documents what already exists.

---

## 1. Top-level layout

```
src/
├── App.tsx                # Route table + providers (QueryClient, Auth, Tooltip, Toaster, MaintenanceGuard)
├── main.tsx               # Vite entry, mounts <App />
├── index.css              # Design tokens (HSL), Georgia serif base, blockquote/story-content styles
├── pages/                 # One file per route (see §2)
├── components/            # Reusable UI (see §3)
│   ├── admin/             # Admin dashboard tabs/managers
│   ├── settings/          # Settings sub-tabs
│   └── ui/                # shadcn primitives — DO NOT modify
├── hooks/                 # Data fetching, mutations, business logic (see §4)
├── lib/                   # Pure utilities (see §5)
└── integrations/supabase/ # Auto-generated client + types — DO NOT modify

supabase/
├── migrations/            # All schema/RLS changes
├── functions/             # Edge functions
│   ├── cleanup-old-drafts/
│   └── manage-registration/
└── config.toml            # Project config (do not change project_id)

docs/
├── PROJECT_MAP.md         # ← this file
├── DATABASE.md            # Tables, RLS, triggers
├── DECISIONS.md           # Why-we-did-it notes
├── MOBILE.md              # Capacitor / PWA notes
└── MOBILE_TROUBLESHOOTING.md
```

---

## 2. Routes → Page files

All routes are declared in `src/App.tsx`. The `/` route conditionally renders `Landing` for guests and redirects authenticated users to `/read`.

| Route                                | Page file                          | Notes                                      |
|--------------------------------------|------------------------------------|--------------------------------------------|
| `/`                                  | `pages/Landing.tsx`                | Guest-only (logged-in → `/read`)           |
| `/read`                              | `pages/Index.tsx`                  | Published stories feed, paginated          |
| `/auth`                              | `pages/Auth.tsx`                   | Personal Key login (no Google OAuth)       |
| `/waitlist`                          | `pages/Waitlist.tsx`               | Signup waitlist                            |
| `/setup-account`                     | `pages/SetupAccount.tsx`           | Post-approval account setup                |
| `/:username` (e.g. `/@name`)         | `pages/Profile.tsx`                | Public profile                             |
| `/profile/:username`                 | redirect → `/@username`            | Legacy redirect in `App.tsx`               |
| `/write`                             | `pages/Write.tsx`                  | Editor (toolbar, blockquote, image upload) |
| `/story/:id`                         | `pages/StoryDetail.tsx`            | Reading mode + skeleton on prefetch        |
| `/admin`                             | `pages/Admin.tsx`                  | Admin dashboard shell (tabs)               |
| `/settings`                          | `pages/Settings.tsx`               | Account / drafts / personal key tabs       |
| `/bookmarks`                         | `pages/Bookmarks.tsx`              |                                            |
| `/inner-circle`                      | `pages/InnerCircle.tsx`            | Plan info                                  |
| `/inner-circle/payment`              | `pages/InnerCirclePayment.tsx`     | Voucher + payment flow                     |
| `/page/:slug`                        | `pages/FooterPage.tsx`             | Admin-managed footer pages                 |
| `/notifications`                     | `pages/Notifications.tsx`          |                                            |
| `/whisper/new`                       | `pages/CreateWhisper.tsx`          | Audio note upload/record                   |
| `/:username/whisper/:folderId`       | `pages/WhisperFolder.tsx`          | Owner-only listing                         |
| `*`                                  | `pages/NotFound.tsx`               |                                            |

---

## 3. Key components

### Layout & chrome
- `components/Header.tsx` — top nav, search trigger (Cmd/Ctrl+K), notifications bell
- `components/Footer.tsx` — footer links pulled from admin-managed pages
- `components/MaintenanceGuard.tsx` — wraps `<Routes>`, blocks UI when maintenance mode is on
- `components/HomepagePopup.tsx` — admin-managed promo modal on `/read`

### Story / feed
- `components/StoryCard.tsx` — feed card; **prefetches** next story on hover/intersect
- `components/RoleBadge.tsx` — gated by `showIdentityBadges = !!user`; returns `null` if no role
- `components/VerifiedBadge.tsx` — Inner Circle / verification mark

### Editor
- `components/EditorImageOverlay.tsx` — selected-image controls (resize, alt, delete)
- `components/EditorLinkPopover.tsx` — link insert/edit popover
- `components/KaomojiPicker.tsx` — kaomoji-only picker (no emoji)

### Search & notifications
- `components/SearchDialog.tsx` — Cmd/Ctrl+K global search (articles + users)
- `components/NotificationBell.tsx` — realtime notification dropdown

### Misc
- `components/AchievementList.tsx` — Output / Reach / Special badges
- `components/AnalyticsTab.tsx` — personal analytics (views, devices, growth)
- `components/MusicBoxPlayer.tsx` — ambient player on reading view
- `components/WhisperList.tsx` — Whisper folder/items list

### Admin (`components/admin/`)
| File                          | Purpose                                |
|-------------------------------|----------------------------------------|
| `MaintenanceToggle.tsx`       | Toggle maintenance wall                |
| `ConfidentialRegistData.tsx`  | Sensitive registration data view       |
| `AchievementBadgeManager.tsx` | CRUD achievement badges                |
| `FooterPagesManager.tsx`      | CRUD footer pages                      |
| `PaymentMethodManager.tsx`    | Payment methods for Inner Circle       |
| `PopupManager.tsx`            | Homepage popup                         |
| `ToolbarSettingsManager.tsx`  | Toggle editor toolbar buttons          |
| `VoucherManager.tsx`          | Discount vouchers                      |
| `WhisperManager.tsx`          | Admin view over Whisper                |

### Settings (`components/settings/`)
- `PersonalKeySettings.tsx` — rotate/view personal key

### `components/ui/`
shadcn primitives. **Do not modify**; extend via variants in consuming components.

---

## 4. Hooks (`src/hooks/`)

| Hook                     | Responsibility                                                 |
|--------------------------|----------------------------------------------------------------|
| `useAuth.tsx`            | Auth context/provider, session, user                           |
| `useStories.ts`          | Published feed, story queries; cache key includes user id      |
| `useBookmarks.ts`        | Bookmark add/remove + list                                     |
| `useHighFives.ts`        | Respectful greetings / high-five reactions                     |
| `useNotifications.ts`    | Notifications query + realtime subscription                    |
| `usePublishCooldown.ts`  | Surfaces server-enforced cooldown (6d / 3d IC)                 |
| `useRecordView.ts`       | Records story views (drives milestones)                        |
| `useEditorImages.ts`     | Editor image upload (calls `lib/image-compress.ts`)            |
| `useToolbarSettings.ts`  | Reads `site_settings.editor_toolbar` for button visibility     |
| `useFooterPages.ts`      | Footer pages from DB                                           |
| `useICMembership.ts`     | Inner Circle plan/state                                        |
| `useInnerCircle.ts`      | IC checkout/voucher flow                                       |
| `useWhisper.ts`          | Whisper folders/items query                                    |
| `useCreateWhisper.ts`    | Whisper upload/record + transcode                              |
| `use-mobile.tsx`         | Viewport breakpoint helper                                     |
| `use-toast.ts`           | Toast wrapper (sonner)                                         |

---

## 5. Libraries (`src/lib/`)

| File                          | Purpose                                                       |
|-------------------------------|---------------------------------------------------------------|
| `types.ts`                    | Domain types + `ROLE_PRIORITY`, `getPrimaryRoleForDisplay`    |
| `utils.ts`                    | `cn()` and small helpers                                      |
| `sanitize-html.ts`            | Allowed tag/attr list (preserves `<blockquote>`)              |
| `html-normalize.ts`           | Reading-mode normalizer (strip inline styles, `<br>`→`<p>`)   |
| `editor-content-classes.ts`   | Shared class names between editor & reader                    |
| `image-compress.ts`           | Client-side image compression before upload                   |
| `audio-transcode.ts`          | Cross-device audio transcoding for Whisper                    |
| `audio-remux.ts`              | Container remux helpers                                       |
| `mic-permission.ts`           | Mic permission UX                                             |
| `pdf-export.ts`               | Block-aware HTML → PDF for IC                                 |
| `achievements.ts`             | Achievement definitions/helpers                               |
| `auth-redirect.ts`            | Post-login redirect helper                                    |
| `mock-data.ts`                | Fixtures for local/dev only                                   |

---

## 6. Backend

### Supabase tables & RLS
See `docs/DATABASE.md`. Highlights:
- `user_roles` is **separate** from `profiles`; `SELECT` restricted to authenticated users.
- `site_settings.key = 'editor_toolbar'` controls toolbar visibility.
- `whisper_folders`, `whispers` are owner-only.

### Edge functions (`supabase/functions/`)
- `manage-registration/` — waitlist approval & account provisioning
- `cleanup-old-drafts/` — scheduled draft pruning

### Migrations
All schema/RLS changes live in `supabase/migrations/` (timestamped). Never edit historical migrations — add a new one.

### Auto-generated (do NOT edit)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`

---

## 7. Common edit recipes

| I want to…                                       | Open                                                                 |
|--------------------------------------------------|----------------------------------------------------------------------|
| Change a route or add a new page                 | `src/App.tsx` (+ new file in `src/pages/`)                           |
| Tweak feed card layout / prefetch behavior       | `src/components/StoryCard.tsx`                                       |
| Adjust reading-mode typography                   | `src/index.css` (`.story-content`) + `src/pages/StoryDetail.tsx`     |
| Add/remove an editor toolbar button              | `src/pages/Write.tsx` + `src/hooks/useToolbarSettings.ts` + `src/components/admin/ToolbarSettingsManager.tsx` |
| Allow a new HTML tag in saved content            | `src/lib/sanitize-html.ts`                                           |
| Change role-badge visibility rules               | `src/components/RoleBadge.tsx` + `src/lib/types.ts` (`getPrimaryRoleForDisplay`) |
| Edit cooldown surfacing (not the rule itself)    | `src/hooks/usePublishCooldown.ts`                                    |
| Modify an admin tab                              | `src/components/admin/<Manager>.tsx` (mounted in `pages/Admin.tsx`)  |
| Update Whisper upload/record flow                | `src/pages/CreateWhisper.tsx` + `src/hooks/useCreateWhisper.ts` + `src/lib/audio-transcode.ts` |
| Change DB schema / RLS                           | New file in `supabase/migrations/`                                   |
| Update design tokens (colors, fonts)             | `src/index.css` + `tailwind.config.ts`                               |

---

## 8. Conventions reminder

- **Semantic tokens only** in components (no raw colors). Define HSL tokens in `src/index.css`.
- **Kaomoji only** in copy: `(◕ᴗ◕✿)`.
- **Destructive actions** must use `AlertDialog` with text-confirmation rituals.
- **Roles** live in `user_roles`; check via `has_role()`. No `"writer"` fallback in UI.
- **Notifications & derived state** are produced by Postgres triggers, not the client.
