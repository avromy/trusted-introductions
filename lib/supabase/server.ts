import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getEnv } from '@/lib/env';
import { createE2EServerClient } from '@/lib/supabase/e2e-server';
import type { Database } from '@/types/supabase';

type SupabaseCookie = {
  name: string;
  value: string;
  options?: Record<string, never>;
};

export function createClient() {
  const cookieStore = cookies();
  const env = getEnv();

  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'local-e2e-anon-key') {
    return createE2EServerClient() as unknown as ReturnType<typeof createServerClient<Database>>;
  }

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
