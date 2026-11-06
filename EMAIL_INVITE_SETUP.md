# Server-Sent Email Invites Setup Guide (`@youcantcryinhere.com`)

This guide walks through how to implement server-sent signup invitations from an official `@youcantcryinhere.com` email address using **Next.js (Vercel)**, **Supabase**, and **Resend**, without relying on the user's local `mailto:` email client.

---

## 1. Register Domain & Configure Transactional Email Provider (Resend)

1. **Register the Domain:**
   * Purchase `youcantcryinhere.com` via Vercel Domains, Cloudflare, or Namecheap.
2. **Create a Resend Account:**
   * Go to [https://resend.com](https://resend.com) (free tier includes 3,000 emails/month, 100/day).
3. **Verify `youcantcryinhere.com` in Resend (Detailed Walkthrough):**
   * **Step A — Add the Domain in Resend:**
     1. Log into [https://resend.com](https://resend.com) and click **Domains** in the left sidebar.
     2. Click **Add Domain**.
     3. Enter `youcantcryinhere.com`, leave the region as default (e.g., `us-east-1`), and click **Add**.
   * **Step B — Copy the DNS Records Shown by Resend:**
     Resend will display a table of **3 to 4 DNS records** that prove you own `youcantcryinhere.com` and authorize Resend's servers to send emails on its behalf (so emails land in the inbox instead of Spam):
     1. **DKIM Record (`TXT`)** — Signs outgoing emails cryptographically:
        * **Type:** `TXT`
        * **Name / Host:** `resend._domainkey`
        * **Value / Content:** `p=MIGfMA0GCSqGSIb3DQEBAQUAA...` *(copy the exact long string from Resend)*
     2. **SPF Record (`MX` + `TXT` on `send`)** — Authorizes Amazon SES / Resend mail servers:
        * **Type:** `MX`
        * **Name / Host:** `send`
        * **Value / Content:** `feedback-smtp.us-east-1.amazonses.com`
        * **Priority:** `10`
        * **Type:** `TXT`
        * **Name / Host:** `send`
        * **Value / Content:** `v=spf1 include:amazonses.com ~all`
     3. **DMARC Record (`TXT`, optional but recommended):**
        * **Type:** `TXT`
        * **Name / Host:** `_dmarc`
        * **Value / Content:** `v=DMARC1; p=none;`
   * **Step C — Paste the Records Into Your Domain Registrar's DNS Settings:**
     * **If your domain is on Vercel Domains:** Go to **Vercel Dashboard → Domains → `youcantcryinhere.com` → DNS Records**, and add each record above (`Name`, `Type`, `Value`, and `Priority` for the `MX` record).
     * **If your domain is on Cloudflare / Namecheap / GoDaddy:** Open the **DNS Management** page for `youcantcryinhere.com` and add each record. *(Note: On Cloudflare, set the orange cloud toggle to **DNS Only / Grey Cloud** for these email records.)*
   * **Step D — Click "Verify DNS Records" in Resend:**
     * Back in Resend, click **Verify DNS Records** at the top right.
     * DNS propagation usually takes **1–10 minutes**. Once verified, the domain status badge in Resend will turn green (**Verified**). Once verified, you can send from *any* address `@youcantcryinhere.com` (e.g., `invites@youcantcryinhere.com`, `noreply@youcantcryinhere.com`) without creating separate mailboxes.

4. **Create an API Key & Add It to Vercel and `.env.local` (Detailed Walkthrough):**
   * **Step A — Generate the Key in Resend:**
     1. In the Resend left sidebar, click **API Keys**.
     2. Click **Create API Key**.
     3. Set **Name** to `youcantcryinhere-production`.
     4. Set **Permission** to **Sending access** (or **Full access**) and **Domain** to `youcantcryinhere.com` (or **All Domains**).
     5. Click **Add**.
     6. **Copy the key immediately** (it starts with `re_...`, e.g., `re_123abc456def...`) — Resend only shows this secret once.
   * **Step B — Add to Local Development (`.env.local`):**
     1. Open (or create) `.env.local` in the root folder of your repository (`c:\Users\matth\youcantcryinhere\.env.local`).
     2. Add these two lines:
        ```env
        RESEND_API_KEY=re_your_copied_api_key_here
        NEXT_PUBLIC_APP_URL=https://youcantcryinhere.com
        ```
   * **Step C — Add to Vercel Production Environment Variables:**
     1. Open your [Vercel Dashboard](https://vercel.com/dashboard) and select your **you-cant-cry-in-here** project.
     2. Click **Settings** (top nav) → **Environment Variables** (left sidebar).
     3. Add Variable 1:
        * **Key:** `RESEND_API_KEY`
        * **Value:** `re_your_copied_api_key_here`
        * **Environments:** Keep **Production**, **Preview**, and **Development** checked, then click **Save**.
     4. Add Variable 2:
        * **Key:** `NEXT_PUBLIC_APP_URL`
        * **Value:** `https://youcantcryinhere.com` *(or your current Vercel URL until your custom domain is live)*
        * **Sensitive / Visibility:** Make sure the **Sensitive** toggle is **OFF** (set to **Config** / Plaintext, *not* Secret, because Vercel requires `NEXT_PUBLIC_` variables to use `Config` visibility).
        * **Environments:** Production, Preview, Development → click **Save**.
     5. **Redeploy on Vercel:** Go to the **Deployments** tab in Vercel, click the `•••` menu on the latest deployment, and click **Redeploy** so the serverless function picks up the new environment variables.

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
            <p style="font-weight:700;">@${inviterUsername || 'An athlete'} invited you to join &ldquo;You Can't Cry in Here&rdquo; to track workouts and stop crying.</p>
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

