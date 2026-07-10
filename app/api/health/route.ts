import { buildHealthResponse } from '@/lib/health/response';

export async function GET(): Promise<Response> {
  return Response.json(buildHealthResponse(), {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
