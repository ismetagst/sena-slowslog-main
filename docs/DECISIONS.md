# Decision Log

Catatan **kenapa** sebuah keputusan dibuat. Ini yang biasanya hilang dalam vibe coding — dan yang akan menyelamatkan "kamu masa depan" 6 bulan dari sekarang.

Format: keputusan → konteks → alasan → konsekuensi.

---

## 1. Tidak menggunakan Google OAuth

**Konteks**: Hampir semua platform modern memakai Google sign-in.

**Alasan**:
- Sena adalah ruang lambat. Login sekali klik mengundang akun impulsif.
- Personal Key (passphrase yang user simpan sendiri) memaksa intensi: "saya benar-benar ingin masuk ke sini."
- Tidak ada dependensi pada provider eksternal yang bisa berubah ToS.

**Konsekuensi**: Onboarding lebih lambat. Itu memang fitur, bukan bug.

---

## 2. Cooldown publish 6 hari (3 hari untuk Inner Circle)

**Konteks**: Platform lain mendorong harian/mingguan.

**Alasan**:
- Memaksa pemikiran sebelum publish.
- 6 hari = di bawah seminggu, jadi masih ada irama, tapi cukup untuk menulis sesuatu yang berarti.
- Inner Circle 3 hari karena mereka membayar untuk sedikit lebih sering, bukan untuk spam.

**Konsekuensi**: Tidak cocok untuk newsletter harian. Itu sengaja.

---

## 3. Kaomoji, bukan emoji

**Konteks**: Emoji modern penuh warna & ekspresi cepat.

**Alasan**:
- Kaomoji `(◕ᴗ◕✿)` terasa lebih tenang, lebih tekstual, lebih "blog-era 2000-an".
- Konsisten dengan estetika Georgia serif & warm off-white.
- Tidak bergantung pada font emoji OS (yang berbeda di setiap device).

**Konsekuensi**: Reviewer baru sering kaget. Sengaja.

---

## 4. Roles di tabel terpisah (`user_roles`)

**Konteks**: Mudah saja menyimpan `role` di `profiles`.

**Alasan**:
- Privilege escalation. Jika role ada di profiles dan user bisa update profilenya sendiri, mereka bisa jadi admin.
- Pakai security-definer function `has_role()` untuk RLS check tanpa rekursi.

**Konsekuensi**: Satu join tambahan setiap kali butuh role. Worth it.

---

## 5. Notifikasi digenerate oleh DB triggers, bukan client

**Konteks**: Bisa saja client `INSERT INTO notifications` setelah aksi.

**Alasan**:
- Konsistensi: notifikasi tetap muncul meski client crash sebelum sempat menulis.
- Single source of truth: trigger juga menangani consolidation (greeting count, milestone bucket).
- Tidak bisa dimanipulasi dari client.

**Konsekuensi**: Debug notifikasi harus lewat SQL log, bukan console. Trade-off yang sehat.

---

## 6. Bell icon: hanya warna berubah, tanpa angka/animasi

**Konteks**: Standard UX adalah badge merah dengan angka.

**Alasan** (dari user):
- Hemat perhatian. Angka memicu kompulsi cek.
- Cukup beri tahu "ada sesuatu baru" — detailnya lihat saat user benar-benar peduli.
- Sesuai filosofi slow.

**Konsekuensi**: Beberapa user mungkin tidak tahu jumlah pasti. Itu fitur.

---

## 7. Reading mode menormalisasi HTML

**Konteks**: Editor menyimpan HTML dengan inline styles, `<br><br>`, dll.

**Alasan**:
- Tipografi konsisten apapun yang user tulis.
- `<br>` chains diubah ke `<p>` blocks agar spacing terkontrol design system.
- Inline color/font dihapus agar dark mode (jika ada nanti) tidak rusak.

**Konsekuensi**: Editor "what you see" tidak persis "what you read". Acceptable trade-off untuk konsistensi.

---

## 8. Soft delete via `deleted_at`

**Konteks**: User bisa salah hapus.

**Alasan**:
- Recovery lewat halaman Trash.
- Audit trail.
- Hard delete hanya admin atau via cron edge function.

**Konsekuensi**: Setiap query stories perlu `.is("deleted_at", null)`. Sudah jadi konvensi.

---

## 9. Destructive action wajib AlertDialog

**Konteks**: Click → langsung hapus = bencana.

**Alasan**:
- Slow blog → slow action. Konfirmasi adalah ritual.
- Untuk delete berat (akun, semua story), pakai text confirmation ("ketik DELETE").

**Konsekuensi**: Lebih banyak klik. Diterima.

---

## 10. Tidak menambah service/repository layer (untuk sekarang)

**Konteks**: Best practice enterprise menyarankan abstraksi DB.

**Alasan**:
- Tim = 1 orang. Backend = 1 (Supabase). YAGNI.
- TanStack Query + hooks sudah memberi separation yang cukup.
- Menambahkannya sekarang = 100+ file boilerplate untuk zero benefit.

**Konsekuensi**: Kalau suatu hari pindah backend, refactor besar. Tapi probabilitasnya rendah.

**Lihat ulang keputusan ini** kalau:
- Tim membesar (>3 dev)
- Butuh unit test berat
- Mulai pakai backend kedua (mis. Stripe webhooks server-side complex)

---

## 11. PDF export: parser HTML manual, bukan library besar

**Konteks**: Bisa pakai `html2pdf`, `jspdf-html2canvas`, dll.

**Alasan**:
- Library tersebut sering merusak tipografi serif.
- Output kita simple (paragraph, heading, image, blockquote) — parser manual cukup ~300 baris.
- No runtime dependency baru.

**Konsekuensi**: Maintain sendiri. Worth it untuk fidelity.

---

## 12. Role badge hanya terlihat oleh user yang sudah login

**Konteks**: Sebelumnya role badge muncul untuk semua pengunjung, dengan fallback ke "writer" jika role tidak ditemukan.

**Alasan**:
- Identitas role adalah info untuk komunitas, bukan untuk anonim.
- Fallback "writer" menghasilkan badge yang salah saat data role belum ter-fetch atau RLS memblokir.
- Anonim tidak punya kebutuhan untuk membedakan role; itu menambah noise visual di landing.

**Implementasi**:
- RLS `user_roles`: policy `Authenticated users can view role badges` — anonim tidak bisa SELECT.
- `getPrimaryRoleForDisplay()` di `lib/types.ts` mengembalikan `undefined` (bukan default ke `writer`).
- Komponen pembaca cek `showIdentityBadges = !!user` sebelum render `RoleBadge`/`VerifiedBadge`.
- React Query key di `useStories`/`useStoryAuthor`/`useUserStories` di-suffix dengan `user?.id ?? "anon"` agar cache anon vs authenticated terisolasi.

**Konsekuensi**: Wajib hati-hati saat menambah komponen baru yang menampilkan role — selalu gate dengan `useAuth().user`.

---

## 13. Quote (blockquote) sebagai tool editor

**Konteks**: Penulis butuh pull-quote ala Medium untuk kutipan panjang.

**Alasan**:
- Heading + italic tidak cukup mewakili "ini kutipan".
- `<blockquote>` adalah tag semantik standar — baik untuk SEO & a11y.
- Tipografi Georgia serif italic + border kiri 3px memperkuat estetika "blog 2000-an" yang sudah ada.

**Implementasi**:
- Tombol di toolbar `Write.tsx` setelah bullet list.
- Sanitizer (`lib/sanitize-html.ts`) mempertahankan `<blockquote>`.
- Toggleable lewat `ToolbarSettingsManager` admin.
- Styling konsisten antara editor (`[contenteditable] blockquote`) & reader (`.story-content blockquote`).

**Konsekuensi**: Tambah satu tag yang harus selalu di-whitelist sanitizer & di-style di reader view.

---

## 14. Prefetch story berikutnya saat hover/intersect StoryCard

**Konteks**: Klik card → spinner besar terasa lambat untuk pembaca yang sudah scroll.

**Alasan**:
- Bandwidth murah, latensi mahal — prefetch metadata + content di idle.
- React Query sudah punya `prefetchQuery`; tinggal trigger via `IntersectionObserver` + `onMouseEnter`.
- `useStory` sudah punya `initialData` dari cache list, jadi prefetch hanya perlu mengisi konten RPC.

**Konsekuensi**: Sedikit tambahan request RPC `get_story_content` untuk kartu yang tidak diklik. Diterima karena ringan.

---

## 15. Whisper: audio note pribadi (bukan public post)

**Konteks**: User minta cara merekam suara/upload audio sebagai catatan tanpa harus dipublish sebagai story.

**Alasan**:
- Slow blog tetap text-first; audio adalah ekstensi pribadi, bukan format utama.
- Disimpan per-folder per-user, di-storage Supabase. Tidak masuk feed publik.
- Transcoding (`lib/audio-transcode.ts`) menormalkan ke format yang konsisten sebelum upload agar playback lintas device aman.

**Konsekuensi**: Storage bucket terpisah untuk audio. Tidak ada RLS public read — strictly owner-only.

---

_Tambahkan keputusan baru di bawah ini setiap kali ada trade-off yang tidak obvious._
