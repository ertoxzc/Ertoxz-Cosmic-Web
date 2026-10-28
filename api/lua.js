import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Env Vercel belum masuk!" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. ACTION LOGIN
  if (action === 'login' && req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const email = body?.email;
    const password = body?.password;
    
    if (!email || !password) return res.status(400).json({ error: 'Email/pass kosong' });
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    
    return res.status(200).json({ access_token: data.session.access_token });
  }

  // 2. ACTION AMBIL ASSET (RML/CONFIG)
  if (action === 'asset') {
    const path = url.searchParams.get('path');
    const { data, error } = await supabase.storage.from('ertoxz-assets').download(path);
    if (error) return res.status(404).send(error.message);
    const text = await data.text();
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(text);
  }

  // 3. ACTION AMBIL LISENSI USER
  if (action === 'lic') {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data, error } = await userClient.from('licence_keys').select('script_id,expires_at').eq('revoked', false);
    if (error) return res.status(500).json({ error: error.message });
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify(data));
  }

  // 4. ACTION AMBIL DAFTAR SCRIPT
  if (action === 'sc') {
    const { data, error } = await supabase.from('scripts').select('id,slug,name,is_free').eq('enabled', true);
    if (error) return res.status(500).json({ error: error.message });
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify(data));
  }

  // 5. ACTION DOWNLOAD FILE SCRIPT LUA
  if (action === 'script') {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const slug = url.searchParams.get('slug');
    const isFree = url.searchParams.get('is_free') === 'true';
    
    if (!token) return res.status(401).send('Unauthorized');
    
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const folder = isFree ? 'free' : 'licensed';
    const paths = [
      `${folder}/${slug}.lua`,
      `${isFree ? 'licensed' : 'free'}/${slug}.lua`,
      `${slug}.lua`
    ];

    // Coba ambil dari private storage dulu
    for (const p of paths) {
      const { data, error } = await userClient.storage.from('scripts-storage').download(p);
      if (!error) {
        const text = await data.text();
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(text);
      }
    }
    
    // Kalau gagal, coba dari public storage
    for (const p of paths) {
       const { data } = supabase.storage.from('scripts-storage').getPublicUrl(p);
       const fetchRes = await fetch(data.publicUrl);
       if (fetchRes.ok) {
         const text = await fetchRes.text();
         if (!text.includes('"error"') && !text.includes('"statusCode"')) {
            res.setHeader('Content-Type', 'text/plain');
            return res.status(200).send(text);
         }
       }
    }
    return res.status(404).send('Script not found');
  }

  return res.status(400).json({ error: 'Invalid action' });
}
