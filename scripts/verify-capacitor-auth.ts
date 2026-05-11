/**
 * Verifikasi Capacitor + Supabase auth + role badge.
 *
 * Cara pakai (di lokal, setelah `npx cap add ios/android`):
 *
 *   1. Build app: `CAP_ENV=production npm run build && npx cap sync`
 *   2. Buka: `npx cap run ios` atau `npx cap run android`
 *   3. Di Safari (iOS) / Chrome DevTools (Android), inspect WebView
 *   4. Paste isi file ini ke Console, lalu jalankan: `verifyCapacitorAuth()`
 *
 * Script ini cek:
 *   ✓ Apakah app jalan di native shell (bukan browser web)
 *   ✓ Apakah Supabase session tersimpan & valid
 *   ✓ Apakah profile + role berhasil ke-fetch dari DB
 *   ✓ Apakah primary role yang muncul sesuai hierarki (founder > admin > ...)
 */

(window as any).verifyCapacitorAuth = async function verifyCapacitorAuth() {
  const log = (label: string, value: unknown, ok?: boolean) => {
    const icon = ok === undefined ? '•' : ok ? '✅' : '❌';
    console.log(`${icon} ${label}:`, value);
  };

  console.log('━━━ Sena Capacitor Auth Verification ━━━');

  // 1. Native shell check
  const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
  const platform = (window as any).Capacitor?.getPlatform?.() ?? 'web';
  log('Running in native shell', `${isCapacitor} (platform: ${platform})`, isCapacitor);

  if (!isCapacitor) {
    console.warn('⚠️  Not running in Capacitor — buka via `npx cap run ios/android`.');
  }

  // 2. Supabase client
  const supabase = (window as any).__supabase ?? null;
  if (!supabase) {
    console.warn(
      '⚠️  window.__supabase tidak terdaftar. Tambahkan di src/integrations/supabase/client.ts:\n' +
      '    if (import.meta.env.DEV) (window as any).__supabase = supabase;'
    );
    return;
  }

  // 3. Session
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !sessionData.session) {
    log('Supabase session', sessionErr?.message ?? 'no session — silakan login dulu', false);
    return;
  }
  const userId = sessionData.session.user.id;
  log('Supabase session userId', userId, true);

  // 4. Profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('user_id', userId)
    .maybeSingle();
  log('Profile fetch', profileErr ? profileErr.message : profile, !profileErr && !!profile);

  // 5. Roles + primary role
  const { data: roles, error: rolesErr } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  log('Roles fetch', rolesErr ? rolesErr.message : roles, !rolesErr);

  const PRIORITY = ['founder', 'admin', 'contributor', 'early_adopter', 'writer'];
  const list = (roles ?? []).map((r: any) => r.role);
  const primary = PRIORITY.find((r) => list.includes(r)) ?? 'writer';
  log('Primary role (expected on badge)', primary, true);

  // 6. Public visibility test (anonymous read of someone else's roles)
  const { data: anyRole, error: anyRoleErr } = await supabase
    .from('user_roles')
    .select('role')
    .neq('user_id', userId)
    .limit(1);
  log(
    'Public role visibility (RLS check)',
    anyRoleErr ? anyRoleErr.message : `OK — sample: ${JSON.stringify(anyRole)}`,
    !anyRoleErr && (anyRole?.length ?? 0) > 0
  );

  console.log('━━━ Done ━━━');
};

export {};
