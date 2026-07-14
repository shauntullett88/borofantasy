/**
 * Generates the branded HTML welcome email for new FFL registrations.
 * @param {string} username  - The player's display name
 * @param {string} appUrl    - Base app URL (e.g. https://farnboroughfc-fantasy.com)
 * @returns {string} - Full HTML email string
 */
export function welcomeEmail(username, appUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Farnborough Fantasy League</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d1a;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#16213E;border-radius:16px;overflow:hidden;border:1px solid #0F3460;">

          <!-- Header banner -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1A1A2E 0%,#16213E 50%,#0F3460 100%);padding:40px 32px 32px;">

              <!-- Badge -->
              <img
                src="${appUrl}/badge.png"
                alt="Farnborough FC"
                width="90"
                height="90"
                style="display:block;margin:0 auto 20px;border-radius:50%;object-fit:cover;"
              />

              <!-- Title -->
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:4px;color:#F5C842;text-transform:uppercase;">Farnborough Fantasy League</p>
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;line-height:1.2;">Welcome to the<br/>Fantasy League</h1>
              <p style="margin:10px 0 0;font-size:13px;color:#94a3b8;letter-spacing:2px;">2026 / 2027 Season</p>
            </td>
          </tr>

          <!-- Gold divider -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#1A1A2E,#F5C842,#1A1A2E);"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">

              <p style="margin:0 0 16px;font-size:16px;color:#e2e8f0;line-height:1.6;">
                Hey <strong style="color:#F5C842;">${username}</strong> 👋
              </p>

              <p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;line-height:1.7;">
                Welcome to the <strong style="color:#ffffff;">best fantasy league in the world</strong> — the Farnborough FC Fantasy League! We're absolutely buzzing to have you on board.
              </p>

              <p style="margin:0 0 24px;font-size:15px;color:#cbd5e1;line-height:1.7;">
                Your account is all set up and ready to go. Now it's time to put your football brain to the test — build your squad, pick your formation, and get ahead of the competition from day one.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a
                      href="${appUrl}/squad"
                      style="display:inline-block;background-color:#C8102E;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.5px;"
                    >
                      Build My Squad →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid #0F3460;padding-top:24px;">

                    <!-- Quick tips -->
                    <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#F5C842;letter-spacing:2px;text-transform:uppercase;">Quick Tips</p>

                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:0 0 12px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;font-size:16px;">⚽</td>
                              <td style="font-size:14px;color:#cbd5e1;line-height:1.6;">Pick your starting 11 and your bench before matches kick off</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 12px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;font-size:16px;">🏆</td>
                              <td style="font-size:14px;color:#cbd5e1;line-height:1.6;">Assign your captain — they score double points</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 4px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;font-size:16px;">🔄</td>
                              <td style="font-size:14px;color:#cbd5e1;line-height:1.6;">Use the transfer window to swap players between gameweeks</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1A1A2E;padding:24px 32px;border-top:1px solid #0F3460;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
                This email was sent to you because you registered for the Farnborough FC Fantasy League.<br/>
                This is a private, invite-only league for Farnborough FC supporters.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#475569;text-align:center;">
                © 2026 Farnborough Fantasy League &nbsp;·&nbsp;
                <a href="${appUrl}" style="color:#F5C842;text-decoration:none;">farnboroughfc-fantasy.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
}
