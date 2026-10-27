import { createSupabaseClient } from '../_lib/supabase.js';

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
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'dev') {
    return res.status(403).json({ error: 'Akses khusus developer' });
  }

  const [
    { data: profiles, error: profileErr },
    { data: licenses, error: licenseErr }
  ] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('licence_keys').select('*').eq('revoked', false)
  ]);

  if (profileErr) return res.status(500).json({ error: profileErr.message });
  if (licenseErr) return res.status(500).json({ error: licenseErr.message });

  return res.status(200).json({
    totalUsers: (profiles || []).length,
    totalLicenses: (licenses || []).length,
    users: profiles || []
  });
}