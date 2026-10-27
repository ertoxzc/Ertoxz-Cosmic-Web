import { createSupabaseClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createSupabaseClient(req, res);
  await supabase.auth.signOut();

  return res.status(200).json({ message: 'Logout berhasil' });
}