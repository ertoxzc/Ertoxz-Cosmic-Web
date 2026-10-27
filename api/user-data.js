import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Ambil token dari header Authorization yang dikirim frontend
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Buat client Supabase dengan token pengguna.
  // Ini penting agar RLS (Row Level Security) tetap berlaku.
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  // Verifikasi token untuk mendapatkan data pengguna
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Sekarang Anda bisa mengambil data. RLS akan memastikan user hanya mendapat datanya sendiri.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  return res.status(200).json({ profile });
}