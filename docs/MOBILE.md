# Mobile App Setup (Capacitor)

Project Sena sudah disiapkan untuk transisi ke aplikasi native iOS & Android via [Capacitor](https://capacitorjs.com/). Web app tetap berjalan normal — Capacitor hanya fondasi tambahan, tidak mengganggu flow web/PWA.

## Filosofi

- **Web first, mobile second.** Codebase tetap satu (React + Vite). Capacitor membungkus web app menjadi native shell.
- **Tahun depan / akhir tahun ini:** transisi resmi ke iOS dulu, lalu Android.
- **Tidak ada perubahan pada UI/logic web.** Semua fitur Sena tetap jalan persis seperti sekarang.

---

## Status Saat Ini

✅ Dependencies terpasang (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`)
✅ `capacitor.config.ts` dibuat dengan `appId` resmi Lovable
✅ Hot-reload dari Lovable sandbox sudah dikonfigurasi (untuk testing di device)
✅ **Mode produksi otomatis** — set `CAP_ENV=production` saat build, server hot-reload langsung dimatikan
✅ Skrip verifikasi auth & role di `scripts/verify-capacitor-auth.ts`
⏳ Native projects (`ios/`, `android/`) **belum** ditambahkan — itu langkah berikutnya, dilakukan **di mesin lokal kamu**, bukan di Lovable

---

## ✅ Checklist Build (ikuti urut setelah export ke GitHub)

### Persiapan satu kali

- [ ] **1.** Klik **GitHub** di Lovable → Export to GitHub
- [ ] **2.** Clone repo: `git clone <your-repo-url> && cd <repo>`
- [ ] **3.** Install deps: `npm install`
- [ ] **4.** (iOS only, perlu Mac + Xcode terinstall) Tambah platform: `npx cap add ios`
- [ ] **5.** (Android, perlu Android Studio terinstall) Tambah platform: `npx cap add android`

### Build untuk DEVELOPMENT (testing di device, hot-reload aktif)

```bash
npm run build && npx cap sync
npx cap run ios       # atau: npx cap run android
```

App akan load dari Lovable sandbox — perubahan di Lovable langsung muncul di device tanpa rebuild.

### Build untuk PRODUKSI (App Store / Play Store)

```bash
# WAJIB pakai CAP_ENV=production — server hot-reload otomatis dimatikan
CAP_ENV=production npm run build && CAP_ENV=production npx cap sync
```

Lalu buka di IDE native:
```bash
npx cap open ios       # buka Xcode → Archive → Upload to App Store Connect
npx cap open android   # buka Android Studio → Build → Generate Signed Bundle (.aab)
```

> ⚠️ **Jangan pernah submit build dev ke store.** Akan ditolak dan/atau memuat konten dari URL Lovable (bahaya privacy + bisa down).

### Setiap kali ada perubahan

```bash
npm run build && npx cap sync
```

`cap sync` menyalin web bundle ke folder native + update plugin. Jalankan sehabis: pull dari GitHub, install dependency baru, atau update `capacitor.config.ts`.

---

## 🔍 Verifikasi Auth & Role Badge di Native

Saat pertama kali jalan di iOS/Android, wajib pastikan login Supabase jalan dan role badge (founder/admin/writer) muncul benar. Capacitor pakai WebView, jadi Supabase session disimpan di WebView storage (bukan browser web kamu).

### Cara verifikasi

1. **Build & jalankan di device/emulator:**
   ```bash
   CAP_ENV=production npm run build && npx cap sync
   npx cap run ios   # atau android
   ```

2. **Login dengan akun test** (misal akun `mantra` = founder, `adminsena` = admin, atau akun writer biasa).

3. **Inspect WebView:**
   - **iOS:** Buka Safari di Mac → menu Develop → pilih device → pilih app Sena
   - **Android:** Buka Chrome di laptop → ke `chrome://inspect` → pilih device → Inspect

4. **Di Console, paste isi file `scripts/verify-capacitor-auth.ts`** lalu jalankan:
   ```js
   verifyCapacitorAuth()
   ```

5. **Hasil yang diharapkan:**
   ```
   ✅ Running in native shell: true (platform: ios)
   ✅ Supabase session userId: <uuid>
   ✅ Profile fetch: { username, display_name }
   ✅ Roles fetch: [{ role: 'founder' }, { role: 'inner_circle' }]
   ✅ Primary role (expected on badge): founder
   ✅ Public role visibility (RLS check): OK
   ```

### ⚠️ Satu prasyarat agar skrip jalan

Tambahkan baris ini di `src/integrations/supabase/client.ts` agar Supabase client bisa diakses dari Console saat dev/QA (tidak ada di production build):

```ts
if (import.meta.env.DEV) {
  (window as any).__supabase = supabase;
}
```

> File `client.ts` di Lovable read-only (auto-generated). Edit baris ini di lokal setelah export ke GitHub, sebelum build mobile pertama.

### Yang sering bermasalah di Capacitor

| Masalah | Penyebab | Solusi |
|---|---|---|
| Login berhasil tapi session hilang setelah app ditutup | WebView storage ke-clear | Pastikan tidak set `cordova-plugin-clear-cache` atau equivalen |
| Role badge selalu "writer" walau user founder | RLS `user_roles` belum allow public SELECT | Sudah di-fix di migration `20260421063158…` |
| Auth redirect (Google OAuth dll) loop | Deep link belum dikonfig | Tidak relevan untuk Sena (pakai Personal Key, bukan OAuth) |
| Network request ke Supabase di-block | iOS App Transport Security | Sudah HTTPS, tidak perlu config tambahan |

---

## Untuk Build Produksi (App Store / Play Store) — detail

Sebelum submit:

1. **Set `CAP_ENV=production`** (lihat checklist di atas) — server hot-reload otomatis hilang dari config
2. **Update `appId`** kalau pakai bundle ID sendiri (default `app.lovable.…` boleh untuk testing)
3. **Generate ikon & splash screen** dengan `@capacitor/assets`:
   ```bash
   npm i -D @capacitor/assets
   npx capacitor-assets generate --iconBackgroundColor '#fafafa'
   ```
4. **iOS:** daftar app di App Store Connect, buat provisioning profile di Xcode
5. **Android:** daftar app di Play Console, generate signing key

---

## Catatan Penting

- **`appId`**: `app.lovable.2c3bc5aeae984bceae4111d5f3abbf42` — sudah terdaftar di Lovable. Ubah ke bundle ID sendiri saat siap publish ke store.
- **Auth flow**: Login Personal Key & waitlist berbasis Supabase, bekerja sama persis di mobile tanpa perubahan code. Verifikasi via skrip di atas.
- **Service Worker**: Tidak aktif di Capacitor (native shell pakai WebView, bukan browser). Cache native dipegang OS — ini yang kita mau.
- **PWA installability**: Web app tetap bisa di-install via "Add to Home Screen" sebagai jalur sementara sebelum app native rilis.

---

## Troubleshooting

Lihat [`MOBILE_TROUBLESHOOTING.md`](./MOBILE_TROUBLESHOOTING.md) untuk fix masalah umum: splash putih, cache lama, network error, status bar overlap, session hilang, redirect URL.

## Auth Redirect (Web + iOS + Android konsisten)

Sena saat ini pakai **Personal Key login** — tidak ada email redirect / OAuth, jadi tidak ada masalah cross-platform.

Kalau suatu saat tambah magic link / OAuth, pakai helper `src/lib/auth-redirect.ts` yang sudah disiapkan:
```ts
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
// Otomatis return URL web produksi saat di native, origin lokal saat di web.
```

Lalu di **Lovable Cloud → Auth → URL Configuration**, tambahkan ke "Redirect URLs":
- `https://senaslowblog.org/**` (web + native fallback)
- `capacitor://localhost/**` (iOS, kalau pakai deep link langsung ke app)
- `https://localhost/**` (Android, kalau pakai deep link langsung ke app)

Untuk sekarang cukup yang pertama — sisanya saat memang setup Universal/App Links nanti.

## Resource

- Capacitor docs: https://capacitorjs.com/docs
- Capacitor + Supabase guide: https://supabase.com/docs/guides/getting-started/tutorials/with-ionic-react
- Lovable mobile guide: https://docs.lovable.dev (cari "Capacitor" / "mobile")
