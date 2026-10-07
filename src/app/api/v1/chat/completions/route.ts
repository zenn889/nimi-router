import { checkApiKey, unauthorized } from "@/lib/auth";
import { proxyChatCompletion } from "@/lib/router";

export const dynamic = "force-dynamic";
// Allow long streaming generations (Vercel Hobby caps at 60s; Pro higher).
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await checkApiKey(req))) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { message: "Invalid JSON body.", type: "invalid_request" } }, { status: 400 });
  }
  return proxyChatCompletion(body);
}
