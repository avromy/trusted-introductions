import { NextResponse } from 'next/server';
import { runNotificationWorkerPass } from '@/lib/notifications/worker';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const expectedSecret = process.env.NOTIFICATION_WORKER_SECRET;
  const providedSecret = request.headers.get('x-notification-worker-secret') ?? getBearerToken(request.headers.get('authorization'));

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await runNotificationWorkerPass();
  return NextResponse.json({ ok: true, result });
}

function getBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
