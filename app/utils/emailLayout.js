// The app's emails in the Crying look (black ground, one graphite tile, grey caps labels, light white text, one red
// button), shared by /api/invite and /api/notify-friend-request. Inline styles and tables only, so Gmail, Apple Mail
// and Outlook all draw it the same. supabase/email-templates/*.html is the same layout written out by hand for the
// Supabase Auth emails (pasted into the Supabase dashboard).

export const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const FONT = "'Chakra Petch', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * A full email page. All text arguments are plain text (escaped here) except `headlineHtml` / `bodyHtml`, which the
 * caller builds from escaped values.
 *   label     — grey caps label at the top of the tile ("ATHLETE INVITATION")
 *   headlineHtml — the 22 px light line under it
 *   bodyHtml  — optional sentence(s) under the headline
 *   readout   — optional { label, value }: a caps label over a large value in a raised well (the beta code)
 *   button    — { label, url }: the one red action
 *   footer    — optional plain sentence under the tile (grey)
 *   showLink  — also print the button's link as text (for clients that block buttons)
 */
export function cryingEmailHtml({ origin, label, headlineHtml, bodyHtml = '', readout = null, button, footer = '', showLink = false }) {
  const icon = origin ? `${origin.replace(/\/+$/, '')}/apple-icon.png` : '';
  const url = escapeHtml(button.url);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#000000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
<tr><td align="center" style="padding:32px 16px;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;">
    <tr><td style="padding:0 4px 16px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        ${icon ? `<td style="padding-right:12px;vertical-align:middle;"><img src="${escapeHtml(icon)}" width="36" height="36" alt="" style="display:block;border:0;border-radius:10px;"></td>` : ''}
        <td style="vertical-align:middle;font-family:${FONT};font-size:13px;font-weight:500;letter-spacing:0.1em;color:#FFFFFF;text-transform:uppercase;">You can&rsquo;t cry in here</td>
      </tr></table>
    </td></tr>
    <tr><td style="background-color:#1C1C1C;border-radius:14px;padding:24px 20px;">
      <div style="font-family:${FONT};font-size:11px;font-weight:500;letter-spacing:0.1em;color:#9A9A9A;text-transform:uppercase;margin:0 0 10px 0;">${escapeHtml(label)}</div>
      <div style="font-family:${FONT};font-size:22px;font-weight:300;line-height:1.35;color:#FFFFFF;margin:0 0 ${bodyHtml ? '12px' : '20px'} 0;">${headlineHtml}</div>
      ${bodyHtml ? `<div style="font-family:${FONT};font-size:14px;font-weight:400;line-height:1.5;color:#BDBDBD;margin:0 0 20px 0;">${bodyHtml}</div>` : ''}
      ${
        readout
          ? `<div style="background-color:#2A2A2A;border-radius:10px;padding:12px 14px;margin:0 0 20px 0;">
        <div style="font-family:${FONT};font-size:10px;font-weight:500;letter-spacing:0.1em;color:#9A9A9A;text-transform:uppercase;margin:0 0 4px 0;">${escapeHtml(readout.label)}</div>
        <div style="font-family:${FONT};font-size:26px;font-weight:300;color:#FFFFFF;">${escapeHtml(readout.value)}</div>
      </div>`
          : ''
      }
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" style="background-color:#E20612;border-radius:12px;">
          <a href="${url}" style="display:block;padding:16px 20px;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:0.08em;color:#FFFFFF;text-decoration:none;text-transform:uppercase;">${escapeHtml(button.label)}</a>
        </td>
      </tr></table>
      ${
        showLink
          ? `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:#8A8A8A;margin:16px 0 0 0;">Or open this link:<br><a href="${url}" style="color:#BDBDBD;word-break:break-all;">${url}</a></div>`
          : ''
      }
    </td></tr>
    ${footer ? `<tr><td style="padding:16px 4px 0 4px;font-family:${FONT};font-size:12px;line-height:1.5;color:#8A8A8A;">${escapeHtml(footer)}</td></tr>` : ''}
  </table>
</td></tr>
</table>
</body>
</html>`;
}
