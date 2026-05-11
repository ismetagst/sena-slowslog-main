# Database Reference

Catatan singkat skema utama. Untuk schema definitif lihat `src/integrations/supabase/types.ts` (auto-generated).

---

## Tabel utama

### `profiles`
Profil publik user. **Tidak menyimpan role.** Field penting:
- `user_id` — referensi ke `auth.users`
- `username`, `display_name`, `avatar_url`, `bio`
- `username_changed_at`, `display_name_changed_at` — untuk membatasi frekuensi ganti
- `notifications_last_seen_at` — penanda apakah bell harus "menyala"
- `is_setup_complete`

### `user_roles`
Tabel terpisah untuk role. **Wajib terpisah dari `profiles`** untuk mencegah privilege escalation.
- `user_id`, `role` (enum `app_role`: `founder | admin | early_adopter | contributor | writer | inner_circle`)
- Dicek lewat fungsi `has_role(_role, _user_id)` (security definer).
- **RLS**: hanya user authenticated yang boleh SELECT (policy `Authenticated users can view role badges`). Anonim tidak bisa membaca role siapa pun.

### `stories`
- `user_id`, `title`, `subtitle`, `content`
- `is_draft`, `is_pinned`, `is_hidden`, `visibility` (`public | inner_circle`)
- `views`, `published_at`, `deleted_at` (soft delete)
- Konten sensitif diakses via RPC `get_story_content(p_story_id)` — bukan SELECT langsung.

### `story_views`
- `story_id`, `viewer_id`, `viewer_ip`, `device_type`
- Diisi via RPC `record_story_view(...)`. Trigger lain memicu milestone.

### `bookmarks`, `high_fives`
- Sederhana: `user_id` + `story_id`. RLS membatasi mutasi.
- `high_fives` = "Respectful Greetings" di UI.

### `notifications`
- `user_id`, `type` (`greeting | achievement | views_milestone`)
- `story_id?`, `badge_id?`, `milestone_value?`, `count`
- Unique constraint per `(user_id, type, story_id)` agar greeting & milestone tidak menumpuk.

### `achievement_badges` & `user_achievements`
- Badge didefinisikan di DB, bukan di kode.
- `check_type` + `check_value` menentukan kondisi auto-award.

### `ic_orders` & `ic_memberships` & `vouchers`
- Flow checkout Inner Circle dengan persetujuan admin.
- `vouchers.used_count` di-increment oleh trigger / RPC `increment_voucher_usage`.

### `waitlist`, `invite_codes`, `forgot_key_requests`, `login_attempts`
- Lapisan kontrol akses di luar Supabase Auth bawaan.

### `site_settings`, `footer_pages`, `payment_methods`, `personal_key_history`
- Konfigurasi & konten yang dikelola admin.
- `site_settings.key = 'editor_toolbar'` menyimpan toggle per-tool (bold, italic, blockquote, dll).

### `whisper_folders`, `whispers`
- Audio note pribadi per-user. **Tidak masuk feed publik.**
- File audio disimpan di Supabase Storage bucket khusus; row hanya menyimpan metadata + path.
- RLS strict owner-only (`auth.uid() = user_id`). Tidak ada public read.

---

## Trigger penting

| Trigger | Tabel sumber | Apa yang terjadi |
|---|---|---|
| `trg_notify_greeting_insert` | `high_fives` | Upsert notifikasi greeting (count + 1) untuk pemilik story. |
| `trg_notify_greeting_delete` | `high_fives` | Decrement count. Hapus notifikasi jika count = 0. |
| `trg_notify_achievement` | `user_achievements` | Buat notifikasi achievement saat badge baru diberikan. |
| `trg_notify_views_milestone` | `stories` | Saat `views` melewati kelipatan 100, buat notifikasi milestone. Loop untuk multi-bucket. |

Semua notifikasi **dihasilkan oleh DB**, bukan oleh client. Ini penting agar konsisten meski user offline.

---

## RPC penting

| Function | Tujuan |
|---|---|
| `has_role(_role, _user_id)` | Security definer untuk RLS check role. |
| `get_story_content(p_story_id)` | Akses konten story dengan validasi visibility (public/IC). |
| `record_story_view(p_story_id, p_viewer_id, p_device_type?)` | Catat view + trigger milestone. |
| `mark_notifications_seen()` | Update `profiles.notifications_last_seen_at`. |
| `validate_voucher(p_code)` | Cek voucher valid + return discount info. |
| `increment_voucher_usage(p_code)` | Naikkan `used_count`. |
| `use_invite_code(p_code)` | Validasi & konsumsi invite code di waitlist flow. |
| `get_pending_waitlist_count()`, `get_today_waitlist_count()` | Stat untuk admin dashboard. |

---

## RLS pattern

- Public read: `stories WHERE is_draft = false AND deleted_at IS NULL AND is_hidden = false` + visibility check.
- Writer mutation: `auth.uid() = user_id`.
- Admin: `has_role('admin', auth.uid())`.
- Inner Circle gating untuk konten: dilakukan di RPC `get_story_content`, bukan di RLS langsung — karena perlu logic kompleks (cek membership aktif).

---

## Edge Functions

| Function | Fungsi |
|---|---|
| `cleanup-old-drafts` | Cron — hapus draft lama yang di-trash > N hari. |
| `manage-registration` | Orchestration waitlist → approve → buat akun + Personal Key. |

---

_Untuk schema definitif & up-to-date, selalu lihat migrasi terbaru di `supabase/migrations/`._
