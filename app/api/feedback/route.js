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

    // 1. If RESEND_API_KEY is configured in environment, dispatch via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.FEEDBACK_FROM_EMAIL || 'onboarding@resend.dev',
            to: [FEEDBACK_RECIPIENT],
            subject: `[You Can't Cry in Here] Feedback from ${senderLabel}`,
            text: formattedText
          })
        });
        if (resendRes.ok) {
          deliveredVia = 'resend';
        }
      } catch {
        // Fallback to next transport
      }
    }

    // 2. Dispatch via FormSubmit AJAX endpoint to matthew.n.duvall@gmail.com
    if (deliveredVia === 'server_log') {
      try {
        const fsRes = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_RECIPIENT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            _subject: `[You Can't Cry in Here] Feedback from ${senderLabel}`,
            athlete: senderLabel,
            timestamp,
            message,
            session_snapshot: JSON.stringify(appSnapshot),
            session_logs: sessionLogs
              .map(e => `${e.timestamp || ''} [${e.type || 'LOG'}] ${e.detail || ''}`)
              .join('\n')
          })
        });
        if (fsRes.ok) {
          deliveredVia = 'formsubmit';
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
      timestamp
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to process feedback.' },
      { status: 500 }
    );
  }
}

