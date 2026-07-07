import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getEnv } from '@/lib/env';
import type { Database } from '@/types/supabase';

type SupabaseCookie = {
  name: string;
  value: string;
  options?: Record<string, never>;
};

export function createClient() {
  const cookieStore = cookies();
  const env = getEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          cookiesToSet.forEach(({ name, value, options }: SupabaseCookie) => {
            cookieStore.set({
              name,
              value,
              ...(options ?? {}),
            });
          });
        },
      },
    },
  );
}
