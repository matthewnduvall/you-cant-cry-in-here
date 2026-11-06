import { NextResponse } from 'next/server';

const FEEDBACK_RECIPIENT = 'matthew.n.duvall@gmail.com';

export async function POST(request) {
  try {
    const body = await request.json();
    const message = String(body?.message || '').trim();
    const user = body?.user || null;
    const sessionLogs = Array.isArray(body?.sessionLogs) ? body.sessionLogs : [];
    const appSnapshot = body?.appSnapshot || {};

    if (!message) {
      return NextResponse.json({ ok: false, error: 'Feedback message is required.' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const senderLabel = user?.username
      ? `@${user.username} (${user.email || 'no-email'})`
      : 'Anonymous / Logged-Out Athlete';

    const formattedText = [
      `YOU CAN'T CRY IN HERE — USER FEEDBACK & SESSION LOGS`,
      `=====================================================`,
      `Recipient: ${FEEDBACK_RECIPIENT}`,
      `Timestamp: ${timestamp}`,
      `From User: ${senderLabel}`,
      ``,
      `USER MESSAGE:`,
      `-------------`,
      message,
      ``,
      `SESSION SNAPSHOT:`,
      `-----------------`,
      JSON.stringify(appSnapshot, null, 2),
      ``,
      `SESSION EVENT LOGS (${sessionLogs.length} entries):`,
      `--------------------------------------------`,
      ...sessionLogs.map(
        (entry, idx) =>
          `[${idx + 1}] ${entry.timestamp || timestamp} | ${entry.type || 'EVENT'}: ${entry.detail || ''}`
      )
    ].join('\n');

    let deliveredVia = 'server_log';
    let providerNote = null;

    // 1. If RESEND_API_KEY is configured in environment, dispatch via Resend
    if (process.env.RESEND_API_KEY) {
      const fromCandidates = [
        process.env.FEEDBACK_FROM_EMAIL,
        "You Can't Cry in Here <invites@youcantcryinhere.com>",
        'onboarding@resend.dev'
      ].filter(Boolean);

      for (const fromAddr of fromCandidates) {
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: fromAddr,
              to: [FEEDBACK_RECIPIENT],
              subject: `[You Can't Cry in Here] Feedback from ${senderLabel}`,
              text: formattedText
            })
          });
          if (resendRes.ok) {
            deliveredVia = 'resend';
            break;
          } else {
            const errJson = await resendRes.json().catch(() => ({}));
            providerNote = errJson?.message || null;
          }
        } catch {
          // Try next sender candidate
        }
      }
    }

    // 2. Dispatch via FormSubmit AJAX endpoint to matthew.n.duvall@gmail.com with browser-compatible Origin/Referer headers
    if (deliveredVia === 'server_log') {
      try {
        const originHeader =
          request.headers.get('origin') ||
          request.headers.get('referer') ||
          'https://youcantcryinhere.vercel.app';
        const refererHeader =
          request.headers.get('referer') || `${originHeader.replace(/\/+$/, '')}/`;

        const fsRes = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_RECIPIENT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Origin: originHeader,
            Referer: refererHeader,
            'User-Agent':
              request.headers.get('user-agent') ||
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({
            _subject: `[You Can't Cry in Here] Feedback from ${senderLabel}`,
            _captcha: 'false',
            _template: 'table',
            athlete: senderLabel,
            timestamp,
            message,
            session_snapshot: JSON.stringify(appSnapshot),
            session_logs: sessionLogs
              .map(e => `${e.timestamp || ''} [${e.type || 'LOG'}] ${e.detail || ''}`)
              .join('\n')
          })
        });
        const fsData = await fsRes.json().catch(() => ({}));
        if (fsRes.ok && (fsData?.success === true || fsData?.success === 'true')) {
          deliveredVia = 'formsubmit';
        } else if (fsData?.message) {
          providerNote = fsData.message;
        }
      } catch {
        // Keep server log fallback
      }
    }

    console.info(`[FEEDBACK -> ${FEEDBACK_RECIPIENT}]\n${formattedText}`);

    return NextResponse.json({
      ok: true,
      recipient: FEEDBACK_RECIPIENT,
      deliveredVia,
      confirmedEmailDelivery: deliveredVia === 'resend' || deliveredVia === 'formsubmit',
      providerNote,
      timestamp
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to process feedback.' },
      { status: 500 }
    );
  }
}

