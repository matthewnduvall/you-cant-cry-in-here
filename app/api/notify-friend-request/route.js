import { NextResponse } from 'next/server';
import { cryingEmailHtml, escapeHtml } from '../../utils/emailLayout';

// Emails an athlete when someone sends them a friend request.
//
// The sender's app calls this right after inserting the pending friendships row. The sender is taken from their
// Supabase session (Authorization: Bearer <access token>), never from the body. The recipient's email is looked up
// here with the service-role key (SUPABASE_SERVICE_ROLE_KEY, server only) through claim_friend_request_email
// (supabase/migrations/2026-11-14_friend_request_emails.sql), which answers only for a request still pending from
// this sender, at most once per request, and says whether the recipient wants these emails. The sender never sees
// the recipient's email.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabaseUrl = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/auth\/v1\/?$/i, '')
    .replace(/\/+$/, '');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetId = String(body?.targetId || '');
    if (!UUID_RE.test(targetId)) {
      return NextResponse.json({ ok: false, error: 'Unknown athlete.' }, { status: 400 });
    }

    const baseUrl = supabaseUrl();
    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!baseUrl || !anonKey || !serviceKey || !resendApiKey) {
      // Not set up on this deployment: the friend request itself is unaffected
      return NextResponse.json({ ok: false, skipped: 'not-configured' }, { status: 503 });
    }

    // The sender, from their own session
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (!accessToken) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
    const userRes = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` }
    });
    const sender = userRes.ok ? await userRes.json().catch(() => null) : null;
    if (!sender?.id) return NextResponse.json({ ok: false, error: 'Session expired.' }, { status: 401 });
    if (sender.id === targetId) return NextResponse.json({ ok: false, skipped: 'self' }, { status: 400 });

    // Claim the pending request (once) and read who to email
    const claimRes = await fetch(`${baseUrl}/rest/v1/rpc/claim_friend_request_email`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requester: sender.id, addressee: targetId })
    });
    if (!claimRes.ok) {
      console.error('[notify-friend-request] claim failed:', claimRes.status, await claimRes.text().catch(() => ''));
      return NextResponse.json({ ok: false, error: 'Could not look up the request.' }, { status: 502 });
    }
    const rows = await claimRes.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return NextResponse.json({ ok: true, skipped: 'already-notified-or-not-pending' });
    if (!row.wants_email) return NextResponse.json({ ok: true, skipped: 'opted-out' });
    const to = String(row.email || '').trim();
    if (!to) return NextResponse.json({ ok: true, skipped: 'no-email' });

    const fromHandle = String(row.requester_username || 'an athlete').replace(/^@/, '');
    const origin = (process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://youcantcryinhere.com').replace(
      /\/+$/,
      ''
    );
    const appUrl = `${origin}/`;
    const safeFrom = escapeHtml(fromHandle);

    // The app's look (utils/emailLayout.js)
    const html = cryingEmailHtml({
      origin,
      label: 'Friend request',
      headlineHtml: `<strong style="font-weight:500;">@${safeFrom}</strong> wants to be your friend.`,
      bodyHtml: 'Accept or decline it in the app under Friends &rarr; Inbox.',
      button: { label: 'Open your inbox', url: appUrl },
      footer: 'Turn these emails off in Friends → Privacy & sharing → Email me friend requests.'
    });
    const text = `@${fromHandle} wants to be your friend on You Can't Cry in Here.\n\nAccept or decline it in the app under Friends > Inbox: ${appUrl}\n\nTurn these emails off in Friends > Privacy & sharing > Email me friend requests.`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: "You Can't Cry in Here <notifications@youcantcryinhere.com>",
        to: [to],
        subject: `@${fromHandle} sent you a friend request`,
        html,
        text,
        tags: [{ name: 'type', value: 'friend_request' }]
      })
    });
    if (!resendRes.ok) {
      const data = await resendRes.json().catch(() => ({}));
      console.error('[notify-friend-request] Resend failed:', resendRes.status, data?.message || data?.error || '');
      return NextResponse.json({ ok: false, error: 'Email not sent.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notify-friend-request]', err?.message || err);
    return NextResponse.json({ ok: false, error: 'Unexpected error.' }, { status: 500 });
  }
}
