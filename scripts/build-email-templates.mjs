// Writes the Supabase Auth email templates (supabase/email-templates/*.html) from the app's email layout
// (app/utils/emailLayout.js), so they match the app's own emails. Run `node scripts/build-email-templates.mjs`, then
// paste each file into Supabase → Authentication → Email Templates (the subject lines are listed in the README there).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// emailLayout.js is an ES module inside a CommonJS package: load it through a data: URL
const src = readFileSync(join(root, 'app/utils/emailLayout.js'), 'utf8');
const { cryingEmailHtml } = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

const outDir = join(root, 'supabase/email-templates');
mkdirSync(outDir, { recursive: true });

const templates = {
  'confirm-signup.html': cryingEmailHtml({
    origin: '{{ .SiteURL }}',
    label: 'Confirm your email',
    headlineHtml: 'One step left: confirm your email to start training.',
    bodyHtml: 'Then sign in with this email and your password.',
    button: { label: 'Confirm email', url: '{{ .ConfirmationURL }}' },
    footer: "You got this because someone signed up for You Can't Cry in Here with {{ .Email }}. If it wasn't you, ignore it.",
    showLink: true
  }),
  'reset-password.html': cryingEmailHtml({
    origin: '{{ .SiteURL }}',
    label: 'Reset password',
    headlineHtml: 'Set a new password for your account.',
    bodyHtml: 'The link works once and expires soon.',
    button: { label: 'Set new password', url: '{{ .ConfirmationURL }}' },
    footer: "You got this because a password reset was asked for {{ .Email }}. If it wasn't you, ignore it: your password stays the same.",
    showLink: true
  })
};

Object.entries(templates).forEach(([name, html]) => writeFileSync(join(outDir, name), `${html}\n`));
console.log(`Wrote ${Object.keys(templates).join(', ')} to supabase/email-templates/`);
