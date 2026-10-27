import { createSupabaseClient } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createSupabaseClient(req, res);
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, hwid, role')
    .eq('id', user.id)
    .maybeSingle();

  const [
    { data: allScripts },
    { data: userLicenses }
  ] = await Promise.all([
    supabase.from('scripts').select('*').eq('enabled', true),
    supabase.from('licence_keys').select('script_id')
      .eq('user_id', user.id).eq('revoked', false)
  ]);

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
}