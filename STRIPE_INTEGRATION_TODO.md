# Stripe Integration TODO

Scenario A: the existing Checkout Session call in [convex/billing.ts](convex/billing.ts) (`createCheckoutSession`) was updated. No other code was touched.

## Values to Replace

`mode`, `success_url`, `cancel_url` and `line_items` already hold real values (no placeholders). Still required before going live:

**Files:** [convex/billing.ts](convex/billing.ts), [convex/lib/billingPlans.ts](convex/lib/billingPlans.ts)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| line_items[0][price] | resolved via `resolveStripePriceId` | Set the real Stripe Price IDs (Dashboard → Products) in the env vars read by `billingPlans.ts`. |
| SITE_URL (env) | Convex env | Used by success_url / cancel_url; set it on the Convex deployment. |
| STRIPE_SECRET_KEY (env) | not set | Set on the Convex deployment (server-only, no `NEXT_PUBLIC_`). |

## Configured Parameters

**Files:** [convex/billing.ts](convex/billing.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | hosted_page |
| billing_address_collection | required |
| phone_number_collection | enabled: true |
| automatic_tax | enabled: true |
| allow_promotion_codes | true |
| payment_method_collection | always |
| submit_type | auto |
| tax_id_collection | enabled: true, required: never |
| consent_collection | terms_of_service: required (promotions removed: not available in the account's country) |
| name_collection | individual + business enabled, optional |
| saved_payment_method_options | payment_method_save: enabled |
| integration_identifier | hosted_web_0002 |
| origin_context | web |

## Things to verify

- **ui_mode / API version**: no Stripe SDK is installed (raw REST calls, no pinned API version). `hosted_page` was used (SDK >= 21 value). If Stripe rejects it, use `hosted`.
- **submit_type** is documented for `payment` mode; this flow uses `subscription`. If Stripe returns a parameter error, remove that line.
- **automatic_tax with an existing `customer`**: Stripe may require `customer_update[address]=auto` (and `customer_update[name]=auto` for name_collection) when a saved customer is passed. Add them if the test checkout errors.
- **Automatic tax** needs a head-office address and tax registrations set in Stripe Dashboard → Tax.
- **Terms of service** consent requires a ToS URL in Dashboard → Settings → Public details.
- Pro trial branch still sets `payment_method_collection: "always"` (same value, harmless).

## Setup

1. Set `STRIPE_SECRET_KEY`, `SITE_URL` and the price ID env vars on Convex (`npx convex env set ...`).
2. Configure a webhook to the Convex HTTP endpoint used by the billing code; set its signing secret.

## Flow

Owner clicks upgrade → `createCheckoutSession` action → Stripe hosted page → redirect to `/app/account/billing?status=success|cancelled`; webhook updates tenant plan.

## Testing

Use test keys. Card `4242 4242 4242 4242`, any future expiry, any CVC. Declined: `4000 0000 0000 0002`. 3DS: `4000 0025 0000 3155`.

## Next steps

Finalize products/prices, verify webhook fulfillment, test upgrade/downgrade and cancel flows.

Resources: https://support.stripe.com and https://docs.stripe.com/mcp
