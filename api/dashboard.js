import { createServerClient } from '@supabase/ssr';
import { parse, serialize } from 'cookie';

export default async function handler(req, res) {
  try {
    // 1. Cek apakah Env terbaca
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: "Env Vercel belum masuk!" });
    }

    // 2. Setup Supabase
    const supabase = createServerClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            const parsed = parse(req.headers.cookie || '');
            return Object.entries(parsed).map(([name, value]) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            const newCookies = cookiesToSet.map(({ name, value, options }) =>
              serialize(name, value, options)
            );
            const existing = res.getHeader('Set-Cookie');
            const all = existing
              ? [...(Array.isArray(existing) ? existing : [existing]), ...newCookies]
              : newCookies;
            res.setHeader('Set-Cookie', all);
          }
        }
      }
    );

    // 3. Ambil User
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: "Sesi login tidak valid / habis." });
    }

    // 4. Ambil Data
    const { data: profile, error: profileErr } = await supabase.from('profiles').select('username, hwid, role').eq('id', user.id).maybeSingle();
    const { data: allScripts, error: scriptErr } = await supabase.from('scripts').select('*').eq('enabled', true);
    const { data: userLicenses, error: licenseErr } = await supabase.from('licence_keys').select('script_id').eq('user_id', user.id).eq('revoked', false);

    // 5. Kalau ada error dari database, munculkan
    if (profileErr) throw new Error("Profile Error: " + profileErr.message);
    if (scriptErr) throw new Error("Script Error: " + scriptErr.message);
    if (licenseErr) throw new Error("License Error: " + licenseErr.message);

    return res.status(200).json({
      profile: profile || { username: user.email.split('@')[0], hwid: 'Belum Terikat', role: 'free' },
      scripts: allScripts || [],
      licenses: userLicenses || []
    });

  } catch (err) {
    // 6. Kalau ada error fatal, munculkan di layar!
    return res.status(500).json({ error: err.message });
  }
}
