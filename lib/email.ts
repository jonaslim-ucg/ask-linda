import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_MAIL) {
    const err = new Error(
      "SMTP is not configured. Set SMTP_HOST and SMTP_MAIL in .env for password reset and verification emails. See .env.example."
    );
    console.error(err.message);
    throw err;
  }
  try {
    const info = await transporter.sendMail({
      from: `"Ask Linda" <${process.env.SMTP_MAIL}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
