import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { renderAuthEmail } from "./emails/auth";

/**
 * Password-reset OTP provider for the Password flow. Same constraints as
 * ResendOTP: no Convex ctx here, direct send, noop = log to Convex logs.
 */
export const ResendPasswordReset = Email({
  id: "resend-otp-reset",
  maxAge: 60 * 15,
  async generateVerificationToken() {
    return String(Math.floor(100000 + Math.random() * 900000));
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const live = process.env.RESEND_MODE === "live" && !!process.env.AUTH_RESEND_KEY;
    const { subject, html, text } = renderAuthEmail("reset", "it", { code: token });

    if (!live) {
      console.log(`[email:noop] reset -> ${email}\n  code: ${token}`);
      return;
    }
    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY!);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? "onespec <onboarding@resend.dev>",
      to: [email],
      subject,
      html,
      text,
    });
    if (error) throw new Error(`Resend reset failed: ${JSON.stringify(error)}`);
  },
});
