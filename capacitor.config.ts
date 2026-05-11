import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config untuk Sena Slowblog.
 *
 * MODE:
 * - Development (default): hot-reload dari Lovable sandbox aktif.
 *   App native akan load web dari URL Lovable, jadi setiap perubahan langsung kelihatan
 *   di device tanpa rebuild.
 *
 * - Production: set env var `CAP_ENV=production` saat build.
 *   Blok `server` otomatis dihapus, jadi app load bundle lokal dari folder `dist/`.
 *   WAJIB pakai mode ini sebelum submit ke App Store / Play Store.
 *
 * Cara pakai:
 *   npm run build:mobile     -> production build (server dimatikan)
 *   npm run build            -> dev build biasa (server aktif kalau buka di Capacitor)
 */

const isProduction = process.env.CAP_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'app.lovable.2c3bc5aeae984bceae4111d5f3abbf42',
  appName: 'Sena Slowblog',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#fafafa',
  },
  android: {
    backgroundColor: '#fafafa',
  },
  // Hanya inject `server` saat BUKAN production.
  // Di production, Capacitor pakai bundle lokal di `dist/`.
  ...(isProduction
    ? {}
    : {
        server: {
          url: 'https://2c3bc5ae-ae98-4bce-ae41-11d5f3abbf42.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }),
};

export default config;
