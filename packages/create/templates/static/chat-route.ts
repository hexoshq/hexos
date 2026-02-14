import { createAgentHandler } from '@hexos/runtime';
import { getSharedRuntime } from '@/lib/shared-runtime';

export async function POST(request: Request): Promise<Response> {
  const runtime = await getSharedRuntime();
  const { POST: handler } = createAgentHandler(runtime);
  return handler(request);
}
