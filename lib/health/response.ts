const SAFE_ENVIRONMENT_KEYS = ['VERCEL_ENV', 'NODE_ENV'] as const;

type DependencyCheck = {
  name: string;
  status: 'not_configured' | 'not_checked';
};

export type HealthResponse = {
  status: 'ok';
  timestamp: string;
  environment?: string;
  dependencies: DependencyCheck[];
};

function getSafeEnvironmentName(): string | undefined {
  for (const key of SAFE_ENVIRONMENT_KEYS) {
    const value = process.env[key];

    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

export function buildHealthResponse(now = new Date()): HealthResponse {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: now.toISOString(),
    dependencies: [
      {
        name: 'supabase',
        status: 'not_checked',
      },
      {
        name: 'email',
        status: 'not_configured',
      },
    ],
  };

  const environment = getSafeEnvironmentName();

  if (environment) {
    response.environment = environment;
  }

  return response;
}
