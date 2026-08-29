import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { renderAuthEmail } from "./emails/auth";

/**
 * Email-verification OTP provider for the Password flow.
 *
 * Convex Auth calls `sendVerificationRequest` WITHOUT a Convex ctx (it is the
 * Auth.js signature), so we cannot call `internal.email.send` here — we send
 * directly. In noop mode (no AUTH_RESEND_KEY / RESEND_MODE !== "live") the code
 * is logged to the Convex function logs instead of emailed.
 */
export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const live = process.env.RESEND_MODE === "live" && !!process.env.AUTH_RESEND_KEY;
    const { subject, html, text } = renderAuthEmail("verify", "it", { code: token });

    if (!live) {
      console.log(`[email:noop] verify -> ${email}\n  code: ${token}`);
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
    if (error) throw new Error(`Resend verify failed: ${JSON.stringify(error)}`);
  },
});
