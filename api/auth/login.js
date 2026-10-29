import { createSupabaseClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, captchaToken } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi' });
  }

  // --- 1. CEK CAPTCHA KE CLOUDFLARE ---
  if (!captchaToken) {
    return res.status(400).json({ error: 'CAPTCHA wajib diselesaikan!' });
  }

  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: captchaToken,
    }),
  });
  
  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    return res.status(403).json({ error: 'Verifikasi CAPTCHA gagal. Coba lagi.' });
  }
  // -------------------------------------

  // --- 2. LOGIN KE SUPABASE (Tanpa CAPTCHA) ---
  const supabase = createSupabaseClient(req, res);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  return res.status(200).json({
    message: 'Login berhasil',
    user: { id: data.user.id, email: data.user.email }
  });
}
