# Capacitor Troubleshooting

Catatan pendek masalah-masalah umum saat run Sena di iOS/Android via Capacitor — beserta fix-nya tanpa menyentuh flow web.

> 📖 Lihat juga: [`MOBILE.md`](./MOBILE.md) untuk setup awal & checklist build.

---

## 1. Splash screen putih / app stuck di putih saat buka

**Gejala:** App terbuka, splash hilang, tapi layar putih kosong selamanya.

**Penyebab umum:**
- Build production tapi blok `server` di `capacitor.config.ts` masih aktif → app coba load URL Lovable yang tidak accessible dari device
- Web bundle tidak ter-sync ke folder native
- JS error fatal saat boot (cek di Safari/Chrome inspector)

**Fix:**
```bash
# Pastikan production build benar (server otomatis di-strip)
CAP_ENV=production npm run build && CAP_ENV=production npx cap sync

# Verifikasi dengan inspect WebView:
# iOS: Safari → Develop → <device> → app Sena → cek Console
# Android: chrome://inspect → Inspect → cek Console
```

Kalau Console kosong, kemungkinan WebView tidak load apapun → blok `server` masih nyangkut. Cek `ios/App/App/capacitor.config.json` (atau `android/app/src/main/assets/capacitor.config.json`) — kalau ada field `server`, hapus manual lalu rebuild.

---

## 2. Perubahan code tidak muncul (cache lama)

**Gejala:** Habis edit & rebuild, tapi app masih tampilkan UI/data lama.

**Penyebab:** WebView cache + Capacitor copy folder tidak ter-update.

**Fix berurut (mulai dari paling ringan):**

```bash
# 1. Re-sync
npm run build && npx cap sync

# 2. Kalau masih lama, clean & sync ulang
rm -rf dist && npm run build && npx cap sync

# 3. iOS: clean build di Xcode
#    Product → Clean Build Folder (⌘⇧K), lalu Run lagi

# 4. Android: clean gradle
cd android && ./gradlew clean && cd ..
npx cap sync android

# 5. Nuclear option: uninstall app dari device, install ulang
```

**Tips dev:** saat pakai mode hot-reload (`server.url` aktif), perubahan langsung muncul tanpa rebuild. Kalau hot-reload tidak jalan, cek device & Mac/laptop di WiFi yang sama.

---

## 3. Network request gagal / Supabase tidak bisa connect

**Gejala:** Login error, data tidak load, error `NetworkError` atau `Failed to fetch`.

**Penyebab umum:**

### a. iOS App Transport Security (ATS)
Sena pakai HTTPS Supabase, jadi seharusnya tidak masalah. Tapi kalau di dev pakai HTTP lokal (jarang), ATS akan block. Fix sementara di `ios/App/App/Info.plist`:
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```
> ⚠️ Jangan submit ke App Store dengan `NSAllowsArbitraryLoads = true`. Hapus sebelum build produksi.

### b. Android cleartext traffic (HTTP)
`capacitor.config.ts` sudah set `cleartext: true` untuk dev. Untuk production, hapus blok `server` (otomatis via `CAP_ENV=production`).

### c. Supabase URL salah / env tidak ke-bundle
Cek di Console (WebView inspector):
```js
console.log(import.meta.env.VITE_SUPABASE_URL);
// Harus return URL Supabase yang valid, bukan undefined
```
Kalau `undefined`, env tidak ter-bundle saat build. Pastikan file `.env` ter-include & build pakai `npm run build` (bukan dev mode).

### d. Cek sederhana via skrip verifikasi
Lihat [`scripts/verify-capacitor-auth.ts`](../scripts/verify-capacitor-auth.ts) — paste di Console WebView, jalankan `verifyCapacitorAuth()`. Kalau gagal di step "Supabase session", jaringan ke Supabase yang bermasalah.

---

## 4. Status bar overlap dengan UI / notch ketutupan

**Gejala:** Konten di top bar (Header Sena) ketutupan oleh notch iPhone atau status bar.

**Fix:** Sudah dikonfig via `contentInset: 'always'` di `capacitor.config.ts`. Kalau masih bermasalah, install plugin status bar:
```bash
npm i @capacitor/status-bar
npx cap sync
```
Lalu di `src/main.tsx`:
```ts
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
}
```

> Skip dulu kalau belum perlu — tambahkan saat memang lihat ada masalah visual.

---

## 5. Tombol back Android keluar dari app

**Gejala:** Tekan back fisik di Android langsung close app, bukan navigate balik di React Router.

**Fix:** Install plugin app:
```bash
npm i @capacitor/app
npx cap sync
```
Lalu integrasi dengan React Router (di `App.tsx` atau hook custom). Skip detail karena belum perlu.

---

## 6. Login berhasil tapi session hilang setelah app restart

**Gejala:** User login OK, tutup app, buka lagi → sudah logout.

**Penyebab:** WebView storage di-clear oleh OS atau plugin pihak ketiga.

**Fix cek:**
```js
// Di Console WebView, sebelum restart app:
localStorage.getItem("sb-lhkwhxkrufgwmlqzcjom-auth-token")
// Harus ada value JSON. Kalau null setelah restart, storage ke-wipe.
```

Kalau hilang → cek apakah ada plugin yang clear storage. Sena tidak pakai plugin seperti itu, jadi kemungkinan besar tidak akan terjadi. Kalau tetap terjadi, pertimbangkan plugin `@capacitor/preferences` untuk persist token manual (advanced, skip dulu).

---

## 7. Auth redirect URL salah (untuk masa depan)

**Konteks:** Kalau suatu saat Sena pakai magic link / OAuth (sekarang pakai Personal Key, tidak relevan).

**Masalah:** `window.location.origin` di Capacitor = `capacitor://localhost`, bukan domain web → email link akan return ke URL aneh yang tidak bisa dibuka.

**Fix:** Pakai helper `src/lib/auth-redirect.ts`:
```ts
import { getAuthRedirectUrl } from "@/lib/auth-redirect";

await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: getAuthRedirectUrl("/auth/callback") }
});
```
Helper ini auto return URL produksi web (`https://senaslowblog.org`) saat di native, dan `window.location.origin` saat di web.

Untuk deep link asli (email klik → buka app, bukan browser), perlu setup Universal Links (iOS) + App Links (Android) — itu config Apple/Google Console, bukan code. Catat untuk nanti.

---

## Checklist debug cepat

Sebelum panik:
1. [ ] Apakah `CAP_ENV=production` di-set saat build untuk testing produksi?
2. [ ] Apakah sudah `npx cap sync` setelah build?
3. [ ] Apakah Console WebView ada error? (Safari Develop / chrome://inspect)
4. [ ] Apakah `verifyCapacitorAuth()` lulus semua step?
5. [ ] Apakah masalah juga muncul di web? (kalau ya, bukan masalah Capacitor)

Kalau 5 itu lolos dan masih bermasalah, baru gali lebih dalam.
