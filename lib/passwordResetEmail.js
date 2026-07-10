/**
 * Branded HTML password-reset email.
 * @param {string} username
 * @param {string} resetUrl - full link to /reset-password?token=...
 * @param {boolean} isMigration - true for the one-off "we've upgraded the site" copy
 * @returns {string}
 */
export function passwordResetEmail(username, resetUrl, isMigration = false) {
  const intro = isMigration
    ? `We've upgraded the Farnborough Fantasy League site to a new home. Your account and squad details have carried over, but for security you'll need to set a new password before logging in.`
    : `We received a request to reset your Farnborough Fantasy League password. Click below to choose a new one.`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Farnborough Fantasy League password</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d1a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#16213E;border-radius:16px;overflow:hidden;border:1px solid #0F3460;">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1A1A2E 0%,#16213E 50%,#0F3460 100%);padding:40px 32px 32px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:4px;color:#F5C842;text-transform:uppercase;">Farnborough Fantasy League</p>
              <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:1px;line-height:1.2;">${isMigration ? "We've upgraded" : 'Reset your'}<br/>password</h1>
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
                ${intro}
              </p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 8px;">
                    <a href="${resetUrl}" style="display:inline-block;background-color:#C8102E;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.5px;">
                      Set New Password →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
                ${isMigration ? 'This link expires in 14 days.' : 'This link expires in 24 hours.'} If you didn't request this, you can ignore this email.
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
