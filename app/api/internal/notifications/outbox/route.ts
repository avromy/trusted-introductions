import { createNotificationDeliveryProvider } from '@/lib/notifications/providers';
import { runNotificationWorker } from '@/lib/notifications/worker';
import { createClient } from '@/lib/supabase/server';
import type { NotificationOutboxRepositoryClient } from '@/lib/notifications/outbox';

function authorized(request: Request): boolean {
  const configured = process.env.NOTIFICATION_WORKER_SECRET;
  if (!configured) return false;
  return request.headers.get('authorization') === `Bearer ${configured}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: 'not_found' }, { status: 404 });
  const result = await runNotificationWorker({
    repository: createClient() as unknown as NotificationOutboxRepositoryClient,
    provider: createNotificationDeliveryProvider(),
  });
  return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
