/**
 * Helper untuk dapat origin URL yang benar di web, iOS, dan Android.
 *
 * Kenapa perlu:
 * - Web: `window.location.origin` = "https://senaslowblog.org"
 * - Capacitor iOS: `window.location.origin` = "capacitor://localhost"
 * - Capacitor Android: `window.location.origin` = "https://localhost"
 *
 * Kalau kamu pakai `emailRedirectTo: window.location.origin` untuk magic link
 * atau OAuth, di mobile akan return URL lokal yang TIDAK BISA dibuka dari email.
 *
 * Helper ini selalu return URL produksi web saat di native, supaya redirect
 * dari email/OAuth tetap landing di web (lalu bisa diteruskan ke app via
 * universal link / deep link kalau suatu saat dikonfig).
 *
 * STATUS SAAT INI: Sena pakai Personal Key login (tidak ada email redirect),
 * jadi helper ini TIDAK dipakai sekarang. Disimpan sebagai fondasi kalau
 * suatu saat pakai magic link / OAuth.
 *
 * Cara pakai nanti:
 *   import { getAuthRedirectUrl } from "@/lib/auth-redirect";
 *   await supabase.auth.signInWithOtp({
 *     email,
 *     options: { emailRedirectTo: getAuthRedirectUrl("/auth/callback") }
 *   });
 */

const PRODUCTION_WEB_URL = "https://senaslowblog.org";

const isCapacitorNative = (): boolean => {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
};

export const getAuthRedirectUrl = (path = "/"): string => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isCapacitorNative()) {
    return `${PRODUCTION_WEB_URL}${normalized}`;
  }
  return `${window.location.origin}${normalized}`;
};

export const isNative = isCapacitorNative;
