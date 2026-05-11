# Architecture Audit — Sena Slow Blog

Laporan jujur kondisi kode per April 2026. **Ini bukan refactor**, hanya peta agar kamu tahu di mana posisi proyek ini.

---

## 1. Diagram alur data

```
                        ┌────────────────────────┐
                        │  Browser (React + PWA) │
                        └───────────┬────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
                ▼                   ▼                   ▼
         ┌───────────┐      ┌──────────────┐    ┌──────────────┐
         │  Pages    │ ───▶ │   Hooks      │ ─▶ │  Supabase JS │
         │ (routes)  │      │ (TanStack Q) │    │   Client     │
         └───────────┘      └──────┬───────┘    └──────┬───────┘
                ▲                  │                   │
                │                  │  Realtime sub     ▼
                │                  └──────────────────▶│
                │                                      │
                │                                      ▼
         ┌──────┴────────┐                    ┌────────────────┐
         │ UI components │                    │  Postgres + RLS │
         │  (shadcn,     │                    │   + Triggers    │
         │   custom)     │                    └────────┬────────┘
         └───────────────┘                             │
                                                       │
                                              ┌────────┴────────┐
                                              │ Edge Functions   │
                                              │ (cleanup, regist)│
                                              └─────────────────┘
```

**Layer yang sudah ada**: UI · Hooks · Supabase Client · DB (RLS + Triggers) · Edge Functions
**Layer yang TIDAK ada (dan untuk sekarang OK)**: service / repository / domain layer terpisah.

---

## 2. Skor per area

| Area | Skor | Catatan |
|---|---:|---|
| **DB Layer** | 9/10 | RLS rapi, role table terpisah, trigger-driven notifications, soft delete. Titik terkuat proyek. |
| **Security** | 9/10 | `has_role()` security definer, RLS aktif, no client-side admin check, secrets dikelola di backend. |
| **Hooks** | 7/10 | Pemisahan data fetching sudah bagus. Beberapa hook mulai gemuk (`useStories` 311 baris, 11 export). |
| **Components UI** | 7/10 | shadcn dipakai konsisten. Beberapa komponen domain mulai membesar. |
| **Pages** | 5/10 | Beberapa page jauh terlalu panjang — ini area paling bermasalah. |
| **Lib / utilities** | 8/10 | Pure functions, jelas tujuannya. `pdf-export` & `html-normalize` cukup kompleks tapi terisolasi. |
| **Types** | 7/10 | Pakai auto-generated `types.ts` dari Supabase + `Story/Author/Role` domain types. Tidak ada layer adapter — DB row langsung di-`mapStory` di hook. |

**Total impresi**: kode **sehat untuk skala saat ini**. Bukan bencana arsitektur. Tapi 3 file di bawah ini sudah tipping point.

---

## 3. Code smells (data nyata)

### 🔴 File terlalu panjang (>500 baris)
| File | Baris | Masalah |
|---|---:|---|
| `src/pages/Admin.tsx` | **1149** | Mencampur banyak tab admin dalam satu page. Wajib dipecah per-tab. |
| `src/pages/Settings.tsx` | **1011** | Sama — Settings hub punya banyak tab dijejalkan. |
| `src/components/admin/ConfidentialRegistData.tsx` | **944** | Logic + UI + tabel dalam satu file. |
| `src/pages/Write.tsx` | **689** | Editor + autosave + cooldown + upload + visibilitas semua di sini. |

### 🟡 File mendekati batas (300–500 baris)
- `src/pages/InnerCirclePayment.tsx` (404)
- `src/components/admin/FooterPagesManager.tsx` (338)
- `src/lib/pdf-export.ts` (335) — boleh besar, ini pure utility
- `src/components/admin/AchievementBadgeManager.tsx` (332)
- `src/pages/StoryDetail.tsx` (322)
- `src/hooks/useStories.ts` (311) — kandidat utama untuk dipecah

### 🟡 Hook gemuk
- `useStories.ts` mengekspor **11 hook** sekaligus (`usePublishedStories`, `useMyDrafts`, `useStory`, `useUserStories`, `useSaveStory`, `useDeleteStory`, `useTrashStories`, `useRestoreStory`, `usePermanentDeleteStory`, `useTogglePin`, `useToggleVisibility`, `useToggleHidden`). Idealnya dipecah jadi `useStoriesQueries` + `useStoryMutations` atau per-domain.

### 🟡 Logic tersebar
- Mapping `profiles + user_roles → Author` diulang **3 kali** di `useStories.ts` (di `usePublishedStories`, `useStory`, `useUserStories`). Bisa jadi helper `attachAuthor()`.
- Filter `primaryRole = userRoles.find(r => r !== "inner_circle")` juga diulang di tempat yang sama.

### 🟢 Yang sudah baik
- Tidak ada komponen UI yang langsung query Supabase (semua via hook). Bagus.
- Tidak ada hardcoded role check di komponen. Bagus.
- `AuthProvider` kecil & fokus (100 baris).
- `lib/` benar-benar pure (no React, no Supabase). Bagus.

---

## 4. Rekomendasi prioritas

### 🔴 Tinggi (sebaiknya dalam 1–2 sprint berikutnya)
1. **Pecah `Admin.tsx`** menjadi sub-route atau lazy-loaded tab files. 1149 baris berbahaya untuk navigasi & build time.
2. **Pecah `Settings.tsx`** sama caranya — satu file per tab di `src/pages/settings/`.
3. **Ekstrak `attachAuthor()` helper** di `useStories.ts` untuk hilangkan duplikasi 3x.

### 🟡 Sedang (kalau ada waktu)
4. Pecah `useStories.ts` menjadi `useStoriesQueries.ts` + `useStoryMutations.ts`.
5. Pecah `Write.tsx` — ekstrak editor toolbar, image handler, dan visibility selector ke komponen terpisah.
6. Pecah `ConfidentialRegistData.tsx` — minimal pisahkan tabel dari logic.

### 🟢 Rendah (boleh nanti, atau tidak sama sekali)
7. Tambah lapisan `services/` (mis. `storyService.ts`) jika suatu hari mau ganti backend atau butuh unit test berat. Untuk sekarang TIDAK perlu — overkill.
8. Buat `domain/` types yang berbeda dari `Database.Tables` untuk decoupling. Hanya jika tim membesar.
9. Tambah ESLint rule `max-lines: 400` agar ada warning otomatis.

---

## 5. Yang TIDAK menjadi masalah (jangan ditakuti)

- ✅ Tidak adanya state management global (Redux/Zustand) — TanStack Query + AuthContext sudah cukup.
- ✅ Tidak adanya layer service — untuk single-frontend single-backend, ini wajar.
- ✅ Banyaknya file di `components/` — itu memang tujuannya.
- ✅ Tailwind utility class banyak — itu cara pakainya.

---

## 6. Kesimpulan jujur

> Proyek ini **bukan vibe-coding chaos**. Pondasinya (DB, RLS, hooks, design system) sebenarnya disiplin. Yang terjadi adalah **page-level files membesar terlalu cepat** karena fitur ditumpuk tanpa memecah file. Itu masalah paling konkret, dan paling mudah diperbaiki bertahap.
>
> Kalau kamu refactor 3 file teratas saja (Admin, Settings, Write), kesehatan kode naik signifikan tanpa risiko regresi besar.

---

_Audit ini bersifat read-only. Tidak ada kode yang diubah._
