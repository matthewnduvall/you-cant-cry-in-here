import { NextResponse } from 'next/server';
import { cryingEmailHtml, escapeHtml } from '../../utils/emailLayout';
import { EXERCISE_MAP } from '../../data/exerciseLibrary';
import { CHALLENGE_PERIODS, challengePeriodCount } from '../../utils/challenges';

// Emails an athlete's friends when the athlete creates a challenge (Home → CHALLENGES → + NEW).
//
// The creator's app calls this right after the challenge is created. The creator is taken from their Supabase session
// (Authorization: Bearer <access token>), never from the body. Friends' emails are looked up here with the service-role
// key (SUPABASE_SERVICE_ROLE_KEY, server only) through claim_challenge_emails
// (supabase/migrations/2026-11-16_challenge_emails.sql), which answers only for a challenge this athlete created, at most
// once per challenge, and only for friends who want these emails (Menu → Privacy). The creator never sees
// anyone's email. One email per friend, sent through Resend's batch endpoint (up to 100 at a time).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabaseUrl = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/auth\/v1\/?$/i, '')
    .replace(/\/+$/, '');

// "50 reps of Barbell Bench Press" (the same wording as the app's challenge cards)
const describe = row => {
  const ex = EXERCISE_MAP[row.exercise_id]?.name || 'an exercise';
  const n = Math.round(Number(row.target) || 0).toLocaleString('en-US');
  // Repeating pattern (challenges.period day / week / month): "3 sessions a week for 4 weeks"
  const per = row.kind !== 'target_weight' ? CHALLENGE_PERIODS[row.period] : null;
  const count = per ? challengePeriodCount(row) : 0;
  const weekly = per ? ` ${per.a} for ${count} ${count === 1 ? per.unit : per.units}` : '';
  if (row.kind === 'target_weight') return `${ex} ${n} lb`;
  if (row.kind === 'total_reps') return `${n} reps of ${ex}${weekly}`;
  if (row.kind === 'total_volume') return `${n} lb of ${ex}${weekly}`;
  return `${n} sessions${weekly}`;
};

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const challengeId = String(body?.challengeId || '');
    if (!UUID_RE.test(challengeId)) {
      return NextResponse.json({ ok: false, error: 'Unknown challenge.' }, { status: 400 });
    }

    const baseUrl = supabaseUrl();
    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!baseUrl || !anonKey || !serviceKey || !resendApiKey) {
      // Not set up on this deployment: the challenge itself is unaffected
      return NextResponse.json({ ok: false, skipped: 'not-configured' }, { status: 503 });
    }

    // The creator, from their own session
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (!accessToken) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
    const userRes = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` }
    });
    const creator = userRes.ok ? await userRes.json().catch(() => null) : null;
    if (!creator?.id) return NextResponse.json({ ok: false, error: 'Session expired.' }, { status: 401 });

    // Claim the challenge (once) and read who to email
    const claimRes = await fetch(`${baseUrl}/rest/v1/rpc/claim_challenge_emails`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_challenge: challengeId, p_creator: creator.id })
    });
    if (!claimRes.ok) {
      console.error('[notify-challenge] claim failed:', claimRes.status, await claimRes.text().catch(() => ''));
      return NextResponse.json({ ok: false, error: 'Could not look up the challenge.' }, { status: 502 });
    }
    const rows = await claimRes.json().catch(() => []);
    const recipients = (Array.isArray(rows) ? rows : []).filter(r => String(r?.email || '').trim());
    if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const origin = (process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://youcantcryinhere.com').replace(
      /\/+$/,
      ''
    );
    const appUrl = `${origin}/`;
    const first = recipients[0];
    const fromHandle = String(first.creator_username || 'a friend').replace(/^@/, '');
    const what = describe(first);
    const name = String(first.title || '').trim();
    const endsMs = Date.parse(first.ends_at || '');
    const startsMs = Date.parse(first.starts_at || '');
    // Starts later than today: say when, and count the days from then
    const later = Number.isFinite(startsMs) && startsMs > Date.now() + 3600000;
    const fromMs = later ? startsMs : Date.now();
    const days = Number.isFinite(endsMs) ? Math.max(1, Math.round((endsMs - fromMs) / 86400000)) : null;
    const startsText = later
      ? `Starts ${new Date(startsMs).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}. `
      : '';
    const headline = `<strong style="font-weight:500;">@${escapeHtml(fromHandle)}</strong> challenged you: ${escapeHtml(name || what)}.`;
    const detail = `${name ? `${escapeHtml(what)}. ` : ''}${startsText}${days ? `${days} ${days === 1 ? 'day' : 'days'} to do it. ` : ''}Join it on Home &rarr; Challenges; only workouts you log from now on count.`;
    const html = cryingEmailHtml({
      origin,
      label: 'Challenge',
      headlineHtml: headline,
      bodyHtml: detail,
      button: { label: 'See the challenge', url: appUrl },
      footer: "Turn these emails off in the app: Menu → Privacy → Email me friends' challenges."
    });
    const text = `@${fromHandle} challenged you: ${name || what}.\n\n${name ? `${what}. ` : ''}${startsText}${days ? `${days} days to do it. ` : ''}Join it on Home > Challenges: ${appUrl}\n\nTurn these emails off in the app: Menu > Privacy > Email me friends' challenges.`;

    // One email per friend (each only sees their own address), 100 per batch
    let sent = 0;
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100).map(r => ({
        from: "You Can't Cry in Here <notifications@youcantcryinhere.com>",
        to: [String(r.email).trim()],
        subject: `@${fromHandle} challenged you: ${name || what}`,
        html,
        text,
        tags: [{ name: 'type', value: 'challenge' }]
      }));
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch)
      });
      if (res.ok) sent += batch.length;
      else {
        const data = await res.json().catch(() => ({}));
        console.error('[notify-challenge] Resend failed:', res.status, data?.message || data?.error || '');
      }
    }
    return NextResponse.json({ ok: sent > 0, sent });
  } catch (err) {
    console.error('[notify-challenge]', err?.message || err);
    return NextResponse.json({ ok: false, error: 'Unexpected error.' }, { status: 500 });
  }
}
