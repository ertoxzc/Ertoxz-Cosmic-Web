import { createServerClient } from '@supabase/ssr';
import { parse, serialize } from 'cookie';

export function createSupabaseClient(req, res) {
  return createServerClient(
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
}