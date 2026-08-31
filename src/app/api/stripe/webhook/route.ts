import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

let stripe: Stripe | null = null;
let webhookSecret: string | null = null;

function getStripe() {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    stripe = new Stripe(secretKey, {
      apiVersion: "2024-06-20",
    });
  }
  return stripe;
}

function getWebhookSecret() {
  if (!webhookSecret) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }
    webhookSecret = secret;
  }
  return webhookSecret;
}

export async function POST(req: NextRequest) {
  const whSecret = getWebhookSecret();
  if (!whSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, whSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Forward to Convex for processing
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".convex.cloud", ".convex.site");
    if (convexUrl) {
      await fetch(`${convexUrl}/api/stripe/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          type: event.type,
          payload: event.data.object,
        }),
      });
    }
  } catch (error) {
    console.error("Failed to forward webhook to Convex:", error);
  }

  return NextResponse.json({ received: true });
}