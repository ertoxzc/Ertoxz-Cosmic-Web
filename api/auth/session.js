import { createSupabaseClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  const supabase = createSupabaseClient(req, res);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return res.status(401).json({ user: null });
  }

  return res.status(200).json({ user: { id: user.id, email: user.email } });
}