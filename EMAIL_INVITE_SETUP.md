# Server-Sent Email Invites Setup Guide (`@youcantcryinhere.com`)

This guide walks through how to implement server-sent signup invitations from an official `@youcantcryinhere.com` email address using **Next.js (Vercel)**, **Supabase**, and **Resend**, without relying on the user's local `mailto:` email client.

---

## 1. Register Domain & Configure Transactional Email Provider (Resend)

1. **Register the Domain:**
   * Purchase `youcantcryinhere.com` via Vercel Domains, Cloudflare, or Namecheap.
2. **Create a Resend Account:**
   * Go to [https://resend.com](https://resend.com) (free tier includes 3,000 emails/month, 100/day).
3. **Verify `youcantcryinhere.com` in Resend:**
   * In the Resend Dashboard, go to **Domains → Add Domain** and enter `youcantcryinhere.com`.
   * Add the **SPF**, **DKIM**, and **DMARC** DNS records (`TXT` and `MX`) provided by Resend to your domain's DNS settings.
4. **Create an API Key:**
   * Go to **API Keys → Create API Key** in Resend.
   * Add `RESEND_API_KEY=re_xxxxxxxxx` to your Vercel Project Environment Variables (and `.env.local`).

---

## 2. Add `friend_invites` Table in Supabase

Run the following SQL in the **Supabase SQL Editor** to track pending email invites and automatically connect friends when the invited user signs up:

```sql
CREATE TABLE IF NOT EXISTS public.friend_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_username TEXT NOT NULL,
  inviter_email TEXT,
  invited_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inviter_user_id, invited_email)
);

ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view and create invites"
  ON public.friend_invites FOR ALL
  USING (true)
  WITH CHECK (true);
```

---

## 3. Create the Next.js Serverless Endpoint (`app/api/invite/route.js`)

Create `app/api/invite/route.js` to send the email from `invites@youcantcryinhere.com`:

```javascript
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { targetEmail, inviterUsername, inviterEmail } = await request.json();
    const cleanTarget = (targetEmail || '').trim().toLowerCase();

    if (!cleanTarget || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTarget)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://youcantcryinhere.com';
    const joinParams = new URLSearchParams({
      invite_from: inviterUsername || 'athlete',
      ...(inviterEmail ? { invite_from_email: inviterEmail } : {}),
      invited_email: cleanTarget,
      beta_code: 'imnotcrying'
    });
    const joinUrl = `${origin}/?${joinParams.toString()}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: "You Can't Cry in Here <invites@youcantcryinhere.com>",
        to: [cleanTarget],
        subject: `@${inviterUsername || 'An athlete'} invited you to You Can't Cry in Here`,
        html: `
          <div style="background:#101010;color:#FFFFFF;padding:24px;font-family:sans-serif;border:2px solid #5C5C5C;max-width:480px;">
            <h2 style="color:#FF6B00;text-transform:uppercase;margin-top:0;">YOU CAN'T CRY IN HERE</h2>
            <p style="font-weight:700;">@${inviterUsername || 'An athlete'} invited you to join You Can't Cry in Here to track 1RMs, share routines, and compete on the leaderboards.</p>
            <p style="background:#18181B;padding:12px;border:1px solid #5C5C5C;font-weight:800;">
              BETA TESTER CODE: <span style="color:#FF6B00;">imnotcrying</span>
            </p>
            <a href="${joinUrl}" style="display:inline-block;margin-top:12px;padding:12px 20px;background:#FF6B00;color:#101010;font-weight:800;text-decoration:none;text-transform:uppercase;">
              ACCEPT INVITE & SIGN UP →
            </a>
          </div>
        `
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json({ error: errData.message || 'Failed to send invite' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
```

---

## 4. Bonus: Custom SMTP for Supabase Auth Emails

Once your domain is verified in Resend, you can also configure Supabase so password resets (`Forgot Password?`) and account confirmation emails come from `auth@youcantcryinhere.com`:
1. Open **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**.
2. Enable **Custom SMTP**:
   * **Sender email:** `auth@youcantcryinhere.com`
   * **Sender name:** `You Can't Cry in Here`
   * **Host:** `smtp.resend.com`
   * **Port:** `465` (SSL)
   * **Username:** `resend`
   * **Password:** Your `RESEND_API_KEY`

