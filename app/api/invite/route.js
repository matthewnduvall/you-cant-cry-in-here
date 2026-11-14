import { NextResponse } from 'next/server';
import { cryingEmailHtml, escapeHtml } from '../../utils/emailLayout';

const getSupabaseServerConfig = () => ({
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/auth\/v1\/?$/i, '')
    .replace(/\/+$/, ''),
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
});

/**
 * Sends a sign-up invite email. The inviter must be signed in: their identity comes from their
 * Supabase session (Authorization: Bearer <access token>), never from the request body, and the
 * invite is recorded as them so RLS (inviter_user_id = auth.uid()) applies. When the invited email
 * signs up, the database makes the two athletes friends.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const cleanTarget = (body?.targetEmail || '').trim().toLowerCase();

    if (!cleanTarget || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTarget)) {
      return NextResponse.json(
        { ok: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { ok: false, error: 'Server email provider (RESEND_API_KEY) is not configured.' },
        { status: 500 }
      );
    }

    // Verify the inviter's session with Supabase
    const { supabaseUrl, supabaseAnonKey } = getSupabaseServerConfig();
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      return NextResponse.json({ ok: false, error: 'Sign in to send invites.' }, { status: 401 });
    }
    const userHeaders = { apikey: supabaseAnonKey, Authorization: `Bearer ${accessToken}` };
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: userHeaders });
    const authUser = userRes.ok ? await userRes.json().catch(() => null) : null;
    if (!authUser?.id) {
      return NextResponse.json({ ok: false, error: 'Your session expired. Sign in again to send invites.' }, { status: 401 });
    }
    const inviterEmail = (authUser.email || '').trim().toLowerCase();
    if (inviterEmail && inviterEmail === cleanTarget) {
      return NextResponse.json({ ok: false, error: "You can't invite yourself." }, { status: 400 });
    }
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?id=eq.${encodeURIComponent(authUser.id)}&select=username`,
      { headers: userHeaders }
    );
    const profileRows = profileRes.ok ? await profileRes.json().catch(() => []) : [];
    const senderHandle = String(
      profileRows?.[0]?.username || authUser.user_metadata?.username || inviterEmail.split('@')[0] || 'athlete'
    ).replace(/^@/, '');

    // Record the invite as the signed-in inviter. First through record_friend_invite (SECURITY DEFINER, always
    // as auth.uid(); supabase/migrations/2026-11-11_record_friend_invite.sql), else a direct insert (RLS:
    // inviter_user_id = auth.uid()). If neither works the email still goes out, without the invite link id: the
    // invited athlete can still join, and is matched by email if the invite was recorded.
    const readDbError = async res => {
      const data = await res.json().catch(() => null);
      return [data?.code, data?.message].filter(Boolean).join(' ') || `HTTP ${res.status}`;
    };
    let inviteId = null;
    let recordError = '';
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/record_friend_invite`, {
      method: 'POST',
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_email: cleanTarget, inviter_name: senderHandle })
    });
    if (rpcRes.ok) {
      const id = await rpcRes.json().catch(() => null);
      inviteId = typeof id === 'string' ? id : null;
    } else {
      recordError = await readDbError(rpcRes);
      const inviteRes = await fetch(`${supabaseUrl}/rest/v1/friend_invites?select=id`, {
        method: 'POST',
        headers: { ...userHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          inviter_user_id: authUser.id,
          inviter_username: senderHandle,
          inviter_email: inviterEmail || null,
          invited_email: cleanTarget,
          status: 'pending'
        })
      });
      if (inviteRes.ok) {
        // The invite's id goes in the link: whoever joins through it becomes friends with the inviter,
        // whatever email they sign up with (claim_invite_link)
        const insertedInvite = await inviteRes.json().catch(() => []);
        inviteId = Array.isArray(insertedInvite) ? insertedInvite[0]?.id || null : null;
        recordError = '';
      } else {
        recordError = `${recordError}; insert: ${await readDbError(inviteRes)}`;
        console.error('[invite] could not record the invite:', recordError);
      }
    }

    const rawOrigin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get('origin') ||
      'https://youcantcryinhere.com';
    const origin = rawOrigin.replace(/\/+$/, '');
    const safeHandle = escapeHtml(senderHandle);

    const joinParams = new URLSearchParams({
      invite_from: senderHandle,
      invited_email: cleanTarget,
      beta_code: 'imnotcrying',
      ...(inviteId ? { invite_id: inviteId } : {})
    });
    const joinUrl = `${origin}/?${joinParams.toString()}`;

    // The invite email, in the app's look (utils/emailLayout.js)
    const emailHtml = cryingEmailHtml({
      origin,
      label: 'Athlete invitation',
      headlineHtml: `<strong style="font-weight:500;">@${safeHandle}</strong> invited you to You Can&rsquo;t Cry in Here.`,
      bodyHtml: 'Track every set, see your estimated 1 rep max climb, and train alongside your friends.',
      readout: { label: 'Beta access code', value: 'imnotcrying' },
      button: { label: 'Accept invite & sign up', url: joinUrl },
      footer: `You got this because @${senderHandle} entered your email address in the app. Ignore it if you'd rather not join.`,
      showLink: true
    });
    const emailText = `@${senderHandle} invited you to You Can't Cry in Here.\n\nBeta access code: imnotcrying\n\nAccept the invite and sign up: ${joinUrl}`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: "You Can't Cry in Here <invites@youcantcryinhere.com>",
        to: [cleanTarget],
        ...(inviterEmail ? { reply_to: inviterEmail } : {}),
        subject: `@${senderHandle} invited you to You Can't Cry in Here`,
        html: emailHtml,
        text: emailText
      })
    });

    const resendData = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            resendData?.message ||
            resendData?.error ||
            'Failed to send invitation email via Resend.'
        },
        { status: resendRes.status || 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      emailId: resendData?.id || null,
      invitedEmail: cleanTarget,
      // Email sent but the invite isn't on record: they won't be added as a friend automatically
      ...(recordError
        ? { warning: 'Add them as a friend once they join (the invite could not be linked to your account).' }
        : {})
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Unexpected server error sending invite.' },
      { status: 500 }
    );
  }
}

