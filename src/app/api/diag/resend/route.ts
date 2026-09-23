import { NextResponse } from "next/server";

import { env } from "~/env";

/**
 * TEMPORARY diagnostic — remove once the email pipeline is confirmed working.
 *
 * No email has ever left this deployment and nothing shows up in the Resend
 * dashboard, which leaves three indistinguishable causes from the outside:
 * the container cannot reach api.resend.com at all, the API key is rejected,
 * or the key belongs to a different Resend account than the one holding the
 * verified domain. This endpoint separates them with a read-only call — it
 * lists domains, it never sends anything.
 *
 * Guarded by a token so it is not a free probe; it still returns no secret,
 * only whether the key works and which domains the account holds.
 */

const DIAG_TOKEN = "3cf888bee65dac4716393954b2bc918c";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== DIAG_TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = env.RESEND_API_KEY;

  const out: Record<string, unknown> = {
    keyPresent: Boolean(key),
    keyLength: key?.length ?? 0,
    // Resend keys look like "re_<id>_<secret>". The prefix tells us whether a
    // real key was provided or a placeholder left over from a template.
    keyPrefix: key ? key.slice(0, 3) : null,
    emailFrom: env.EMAIL_FROM,
  };

  const started = Date.now();

  try {
    const response = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    out.reachedResend = true;
    out.httpStatus = response.status;
    out.elapsedMs = Date.now() - started;

    const bodyText = await response.text().catch(() => "");

    if (response.ok) {
      try {
        const parsed = JSON.parse(bodyText) as {
          data?: Array<{ name?: string; status?: string; region?: string }>;
        };
        out.domains = (parsed.data ?? []).map((d) => ({
          name: d.name,
          status: d.status,
          region: d.region,
        }));
      } catch {
        out.body = bodyText.slice(0, 400);
      }
    } else {
      // 401 => bad key, 403 => key valid but restricted, etc.
      out.error = bodyText.slice(0, 400);
    }
  } catch (error) {
    // A throw here means the request never completed: DNS failure, egress
    // firewall, or no outbound internet from the container.
    out.reachedResend = false;
    out.elapsedMs = Date.now() - started;
    out.networkError = error instanceof Error ? error.message : String(error);
    out.cause =
      error instanceof Error && error.cause
        ? String((error.cause as { message?: string }).message ?? error.cause)
        : null;
  }

  return NextResponse.json(out);
}
