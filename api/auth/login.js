import { createSupabaseClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, captchaToken } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi' });
  }

  const supabase = createSupabaseClient(req, res);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken }
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  return res.status(200).json({
    message: 'Login berhasil',
    user: { id: data.user.id, email: data.user.email }
  });
}