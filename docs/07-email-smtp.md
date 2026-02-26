# Email / SMTP Setup

The project uses **Nodemailer** to send transactional emails for:

- **Password reset** — sends a link for users to reset their password
- **Email verification** — sends a verification link after signup

---

## Configuration

Add these variables to your `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_MAIL=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## Provider-Specific Setup

### Gmail

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (required for app passwords)
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Select **Mail** and your device
5. Click **Generate** — you'll get a 16-character password
6. Use it in your `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_MAIL=your-email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
```

> **Note:** Use the app password, not your regular Gmail password.

---

### Outlook / Microsoft 365

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_MAIL=your-email@outlook.com
SMTP_PASSWORD=your-outlook-password
```

For Microsoft 365 with modern auth, you may need to use an app password or configure OAuth2.

---

### AWS SES (Simple Email Service)

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Verify your sender email or domain
3. Create SMTP credentials in **SMTP Settings**
4. Use the generated credentials:

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_MAIL=verified-email@yourdomain.com
SMTP_PASSWORD=your-ses-smtp-password
```

> **Note:** New SES accounts are in sandbox mode — you can only send to verified emails until you request production access.

---

### Resend

If using [Resend](https://resend.com/) as an SMTP relay:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_MAIL=onboarding@resend.dev
SMTP_PASSWORD=re_your_api_key
```

---

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_MAIL=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=your-mailgun-smtp-password
```

---

## How It Works

The email module is in `lib/email.ts`:

```typescript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});
```

Emails are sent with the "from" address set to:

```
"Ask Linda" <your-smtp-email@example.com>
```

### Email Templates

The app sends two types of emails:

#### Password Reset Email

Sent when a user clicks "Forgot Password". Contains:
- Greeting with user's name
- Reset password button/link
- 1-hour expiry notice

#### Email Verification

Sent after user signup. Contains:
- Greeting with user's name
- Verify email button/link
- Auto sign-in after verification

---

## Testing Emails Locally

### Option 1: Ethereal (Fake SMTP)

Use [Ethereal](https://ethereal.email/) for testing without sending real emails:

1. Go to [ethereal.email](https://ethereal.email/)
2. Click **Create Ethereal Account**
3. Use the generated credentials in your `.env`
4. Sent emails can be viewed in the Ethereal web interface

### Option 2: Mailtrap

Use [Mailtrap](https://mailtrap.io/) to catch emails in a testing inbox:

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_MAIL=your-mailtrap-username
SMTP_PASSWORD=your-mailtrap-password
```

---

## Troubleshooting

| Problem                              | Solution                                                     |
| ------------------------------------ | ------------------------------------------------------------ |
| `ECONNREFUSED`                       | Wrong SMTP host or port — double-check values               |
| `Invalid login`                      | Wrong credentials — use app password for Gmail               |
| `Self-signed certificate`            | Add `tls: { rejectUnauthorized: false }` to transporter (dev only) |
| `Emails go to spam`                  | Set up SPF/DKIM/DMARC records for your domain               |
| `Timeout`                            | Firewall blocking port 587 — try port 465 with `secure: true` |
| `Email not received`                 | Check spam folder — verify SMTP credentials in server logs   |

---

**Previous:** [← AI & RAG Setup](./06-ai-and-rag.md) | **Next:** [Authentication →](./08-authentication.md)
