import { createSupabaseClient } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createSupabaseClient(req, res);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Sesi login tidak valid atau habis.' });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('username, hwid, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) throw new Error("Gagal ambil profil: " + profileErr.message);

    const [
      { data: allScripts, error: scriptErr },
      { data: userLicenses, error: licenseErr }
    ] = await Promise.all([
      supabase.from('scripts').select('*').eq('enabled', true),
      supabase.from('licence_keys').select('script_id').eq('user_id', user.id).eq('revoked', false)
    ]);

    if (scriptErr) throw new Error("Gagal ambil tabel scripts: " + scriptErr.message);
    if (licenseErr) throw new Error("Gagal ambil tabel licence_keys: " + licenseErr.message);

    const ownedScriptIds = (userLicenses || []).map(l => l.script_id);
    const scripts = (allScripts || [])
      .filter(s => s.is_free === true || ownedScriptIds.includes(s.id))
      .map(s => ({ ...s, owned: ownedScriptIds.includes(s.id) }));

    return res.status(200).json({
      profile: profile || {
        username: user.email.split('@')[0],
        hwid: 'Belum Terikat',
        role: 'free'
      },
      scripts
    });

  } catch (err) {
    // INI YANG BIKIN ERROR ASLINYA MUNCUL DI LAYAR
    console.error('SERVER ERROR DASHBOARD:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
