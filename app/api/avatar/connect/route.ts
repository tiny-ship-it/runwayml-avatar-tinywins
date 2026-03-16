import Runway from '@runwayml/sdk';
import { auth } from '../../../../auth';

const AVATAR_ID = '52bfe1f6-aa76-48b2-8b0f-b3eb279b41b9';
const MEMORY_ENGINE_BASE =
  'https://memory-engine-230664305014.us-central1.run.app/memories/recent';

const client = new Runway({ apiKey: process.env.RUNWAYML_API_SECRET });

async function fetchMemoryContext(tenantId: string): Promise<string> {
  const url = `${MEMORY_ENGINE_BASE}?limit=20&tenant=${encodeURIComponent(tenantId)}`;
  try {
    const res = await fetch(url, { headers: { tenant: tenantId } });
    if (!res.ok) {
      console.warn(
        `Memory Engine returned ${res.status} for tenant ${tenantId}: ${res.statusText}`,
      );
      return '';
    }
    const data = await res.json();
    const memories: unknown[] = Array.isArray(data)
      ? data
      : (data.memories ?? data.data ?? []);
    if (memories.length === 0) return '';
    return memories
      .map((m: unknown, i: number) => {
        if (typeof m === 'string') return `${i + 1}. ${m}`;
        const mem = m as Record<string, unknown>;
        const content = mem.content ?? mem.text ?? mem.summary ?? JSON.stringify(m);
        return `${i + 1}. ${content}`;
      })
      .join('\n');
  } catch (err) {
    console.warn('Failed to fetch memory context:', err);
    return '';
  }
}

export async function POST(req: Request) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  // The tenantId is derived server-side from the authenticated session.
  // We never trust the client-supplied value for security-sensitive routing.
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Auth.js session callback already attached tenantId; read it directly.
  const tenantId = (session as unknown as Record<string, string>).tenantId;

  // Sanity-check: still accept a client-supplied tenantId as a fallback for
  // development (e.g. calling the route without full OAuth), but log a warning.
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    const body = await req.json().catch(() => ({}));
    resolvedTenantId = (body as { tenantId?: string }).tenantId ?? '';
    if (resolvedTenantId) {
      console.warn(
        'tenantId not found in session; falling back to client-supplied value. ' +
          'This should not happen in production.',
      );
    } else {
      return Response.json({ error: 'Could not determine tenantId.' }, { status: 400 });
    }
  }

  // ── Memory Engine ───────────────────────────────────────────────────────────
  const memoryContext = await fetchMemoryContext(resolvedTenantId);

  const userName = session.user.name ?? session.user.email;
  const systemPrompt = memoryContext
    ? `You are Tiny, ${userName}'s AI assistant. Here is your recent memory context:\n\n${memoryContext}\n\nUse this context to provide personalised, contextually aware responses.`
    : `You are Tiny, ${userName}'s AI assistant. Be helpful, friendly, and concise.`;

  // ── Avatar personality update ───────────────────────────────────────────────
  try {
    await client.avatars.update(AVATAR_ID, { personality: systemPrompt });
  } catch (err) {
    console.warn('Failed to update avatar personality:', err);
  }

  // ── Create realtime session ─────────────────────────────────────────────────
  const { id: sessionId } = await client.realtimeSessions.create({
    model: 'gwm1_avatars',
    avatar: { type: 'custom', avatarId: AVATAR_ID },
  });

  const session2 = await pollSessionUntilReady(sessionId);
  return Response.json({ sessionId, sessionKey: session2.sessionKey });
}

async function pollSessionUntilReady(sessionId: string) {
  const TIMEOUT_MS = 30_000;
  const POLL_INTERVAL_MS = 1_000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const s = await client.realtimeSessions.retrieve(sessionId);
    if (s.status === 'READY') return s;
    if (s.status === 'COMPLETED' || s.status === 'FAILED' || s.status === 'CANCELLED') {
      throw new Error(`Session ${s.status.toLowerCase()} before becoming ready`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Session creation timed out');
}
