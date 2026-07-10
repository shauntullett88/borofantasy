import 'server-only'
import nodemailer from 'nodemailer'

let transporter

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return transporter
}

export async function sendMail({ to, subject, html }) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  })
}
