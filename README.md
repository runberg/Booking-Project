# Booking Project - Deployment and Configuration Notes

## Gmail App Password Setup (for SMTP)

Follow these steps to enable Gmail SMTP with an App Password (required by Google; legacy "Less Secure Apps" is deprecated):

1. Enable 2-Step Verification
   - Go to `https://myaccount.google.com/security` while signed in.
   - Under "How you sign in to Google", click "2-Step Verification" and complete setup.

2. Generate an App Password
   - Return to `https://myaccount.google.com/security`.
   - On the 2-Step Verification page, find "App passwords".
   - If you don't see "App passwords", see Troubleshooting below.
   - Click "App passwords" → Select app: "Mail" → Select device: choose your device or "Other (Custom name)".
   - Click "Generate". Copy the 16-character App Password (no spaces).

3. Configure your server/application
   - Use these values (example for Docker Compose environment):
     - `SMTP_HOST=smtp.gmail.com`
     - `SMTP_PORT=465` (SSL) or `587` (STARTTLS)
     - `SMTP_USER=your_email@gmail.com`
     - `SMTP_PASS=<YOUR_16_CHAR_APP_PASSWORD>`
     - `SMTP_FROM=your_email@gmail.com` (or an allowed alias)
     - `FRONTEND_URL=https://app.yourdomain` (for links in emails)

4. Test sending
   - Trigger an email from the app (e.g., registration or booking confirmation) and confirm delivery.

### Troubleshooting
- "App passwords" not visible:
  - 2-Step Verification isn't enabled; complete 2SV first and refresh the page.
  - Advanced Protection is enabled on the account (App Passwords not supported).
  - Google Workspace: your admin may have disabled App Passwords; ask the admin to allow them or set up an SMTP relay.
- Can't send mail:
  - Verify outbound port 465/587 is allowed by your server/network.
  - Check SMTP_USER/SMTP_PASS and from-address.
  - Gmail/Workspace sending limits apply; for higher volumes, consider a dedicated email provider (SES, SendGrid, Mailgun).


