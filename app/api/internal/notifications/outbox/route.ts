import { resolveNotificationDestination, type NotificationDestinationClient } from '@/lib/notifications/destinations';
import { createNotificationDeliveryProvider } from '@/lib/notifications/providers';
import { runNotificationWorker } from '@/lib/notifications/worker';
import { createClient } from '@/lib/supabase/server';
import {
  RateLimitExceededError,
  assertRateLimitAllowed,
  clientIpHashFromHeaders,
  getRateLimiter,
  rateLimitRules,
  scopedRateLimitKey,
} from '@/lib/security/rate-limit';
import type { NotificationOutboxRepositoryClient } from '@/lib/notifications/outbox';

function authorized(request: Request): boolean {
  const configured = process.env.NOTIFICATION_WORKER_SECRET;
  if (!configured) return false;
  return request.headers.get('authorization') === `Bearer ${configured}`;
}

export async function POST(request: Request): Promise<Response> {
  try {
    await assertRateLimitAllowed(
      getRateLimiter(),
      rateLimitRules.internalWorker,
      scopedRateLimitKey('internal-worker', clientIpHashFromHeaders(request.headers)),
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    throw error;
  }

  if (!authorized(request)) return Response.json({ error: 'not_found' }, { status: 404 });
  const supabase = createClient();
  const result = await runNotificationWorker({
    repository: supabase as unknown as NotificationOutboxRepositoryClient,
    provider: createNotificationDeliveryProvider(),
    resolveDestination: (destinationRef) =>
      resolveNotificationDestination(destinationRef, supabase as unknown as NotificationDestinationClient),
  });
  return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
