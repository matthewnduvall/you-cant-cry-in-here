# Supabase Auth email templates

The sign-up confirmation and password reset emails are sent by Supabase, not by the app, so their HTML lives in the
Supabase dashboard. These files are that HTML, in the same Crying layout as the app's own emails
(`app/utils/emailLayout.js`). After changing the layout, rebuild them:

```
node scripts/build-email-templates.mjs
```

Then in **Supabase → Authentication → Email Templates**, paste each file into its template's **Message body**
(Source view) and set the subject:

| Template | File | Subject |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Confirm your email for You Can't Cry in Here` |
| Reset password | `reset-password.html` | `Reset your You Can't Cry in Here password` |

The `{{ .ConfirmationURL }}`, `{{ .Email }}` and `{{ .SiteURL }}` placeholders are filled in by Supabase. The logo is
`{{ .SiteURL }}/apple-icon.png`, so **Authentication → URL Configuration → Site URL** must be the live app's address.
