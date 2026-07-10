const requiredVariables = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_RESUME_BUCKET',
];

const missing = requiredVariables.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Validated required environment variable presence for: ${requiredVariables.join(', ')}`);
