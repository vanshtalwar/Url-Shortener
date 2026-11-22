import nodemailer from 'nodemailer';

export interface Mailer {
  sendVerification(to: string, link: string): Promise<void>;
  sendPasswordReset(to: string, link: string): Promise<void>;
}

interface Email {
  subject: string;
  intro: string;
  button: string;
  link: string;
  footer: string;
}

function render({ intro, button, link, footer }: Email) {
  const text = `${intro}\n\n${button}: ${link}\n\n${footer}\n\n— Zelqit`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#14121f">
  <h2 style="margin:0 0 16px">Zelqit</h2>
  <p>${intro}</p>
  <p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#6d28d9;color:#fff;text-decoration:none">${button}</a></p>
  <p style="color:#5e5a73;font-size:13px">${footer}</p>
</div>`;
  return { text, html };
}

/** Gmail SMTP (app password). Swap for Resend once a domain is verified. */
export function createSmtpMailer(user: string, pass: string): Mailer {
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const send = async (to: string, email: Email) => {
    await transport.sendMail({ from: `Zelqit <${user}>`, to, subject: email.subject, ...render(email) });
  };
  return {
    sendVerification: (to, link) =>
      send(to, {
        subject: 'Verify your email for Zelqit',
        intro: 'Confirm your email address to start creating short links.',
        button: 'Verify email',
        link,
        footer: "This link expires in 24 hours. If you didn't sign up, ignore this email.",
      }),
    sendPasswordReset: (to, link) =>
      send(to, {
        subject: 'Reset your Zelqit password',
        intro: 'Someone asked to reset the password for this email address.',
        button: 'Choose a new password',
        link,
        footer: "This link expires in 1 hour. If you didn't ask for this, ignore this email — your password stays the same.",
      }),
  };
}
