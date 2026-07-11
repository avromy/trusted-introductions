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
        async getAll() {
          const store = await cookieStore;
          return store.getAll().map(({ name, value }: { name: string; value: string }) => ({ name, value }));
        },
        async setAll(cookiesToSet: SupabaseCookie[]) {
          const store = await cookieStore;
          cookiesToSet.forEach(({ name, value, options }: SupabaseCookie) => {
            store.set({
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
