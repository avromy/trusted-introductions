import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_RESUME_BUCKET: z.string().min(1).default('private-resumes'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NOTIFICATION_DELIVERY_PROVIDER: z.enum(['development', 'disabled']).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_RESUME_BUCKET: process.env.SUPABASE_STORAGE_RESUME_BUCKET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NOTIFICATION_DELIVERY_PROVIDER: process.env.NOTIFICATION_DELIVERY_PROVIDER,
  });
}
