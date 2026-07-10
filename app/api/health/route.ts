import { buildHealthResponse } from '@/lib/health/response';
import { reportUnexpectedActionError } from '@/lib/observability/errors';

export async function GET(request: Request): Promise<Response> {
  try {
    return Response.json(buildHealthResponse(), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    await reportUnexpectedActionError({
      error,
      requestId: request.headers.get('x-request-id') ?? undefined,
      route: '/api/health',
      context: { method: request.method },
    });
    throw error;
  }
}
