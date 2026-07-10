/**
 * Branded HTML "confirm your email" template, sent right after registration.
 * @param {string} username
 * @param {string} confirmUrl - full link to /verify-email?token=...
 * @returns {string}
 */
export function confirmationEmail(username, confirmUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your Farnborough Fantasy League account</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d1a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#16213E;border-radius:16px;overflow:hidden;border:1px solid #0F3460;">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1A1A2E 0%,#16213E 50%,#0F3460 100%);padding:40px 32px 32px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:4px;color:#F5C842;text-transform:uppercase;">Farnborough Fantasy League</p>
              <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:1px;line-height:1.2;">Confirm your<br/>email address</h1>
            </td>
          </tr>
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#1A1A2E,#F5C842,#1A1A2E);"></td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#e2e8f0;line-height:1.6;">
                Hey <strong style="color:#F5C842;">${username}</strong> 👋
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#cbd5e1;line-height:1.7;">
                Thanks for registering for the Farnborough FC Fantasy League. Click below to confirm your email address and activate your account.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 8px;">
                    <a href="${confirmUrl}" style="display:inline-block;background-color:#C8102E;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.5px;">
                      Confirm Email →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
                This link expires in 24 hours. If you didn't create this account, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#1A1A2E;padding:24px 32px;border-top:1px solid #0F3460;">
              <p style="margin:0;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
                This is a private, invite-only league for Farnborough FC supporters.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
