/* ============================================================
   payment-config.js
   ----------------------------------------------------------
   Centralized configuration for the checkout / payment modal.
   Only PUBLIC / PUBLISHABLE keys belong in this file — never
   place secret keys here. Secret keys must live server-side
   only. Replace the placeholder values below when wiring this
   up to real payment providers.
   ============================================================ */

window.PAYMENT_CONFIG = {

  /* Package catalog — single source of truth for names, prices
     and descriptions used by the pricing cards + payment modal. */
  packages: {
    starter: {
      id: "starter",
      name: "Starter",
      tagline: "Perfect for startups",
      price: 299,
      currency: "USD",
      type: "fixed"
    },
    professional: {
      id: "professional",
      name: "Professional",
      tagline: "Most Popular",
      price: 799,
      currency: "USD",
      type: "fixed"
    },
    enterprise: {
      id: "enterprise",
      name: "Enterprise",
      tagline: "Custom Solution",
      price: null,
      currency: "USD",
      type: "custom"
    }
  },

  /* Tax settings applied in the order summary. Flip `enabled`
     to true and set a `rate` (e.g. 0.05 for 5%) to show taxes. */
  tax: {
    enabled: false,
    rate: 0,
    label: "Tax"
  },

  /* ---- Stripe -------------------------------------------------
     Publishable key only. Card element mounting point is
     prepared in payment-modal.js (#pmStripeCardElement). */
  stripe: {
    enabled: true,
    publishableKey: "pk_test_REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY",
    supportedCards: ["visa", "mastercard", "amex", "discover"]
  },

  /* ---- PayPal --------------------------------------------------- */
  paypal: {
    enabled: true,
    clientId: "REPLACE_WITH_YOUR_PAYPAL_CLIENT_ID"
  },

  /* ---- Google Pay ------------------------------------------------ */
  googlePay: {
    enabled: true,
    merchantId: "REPLACE_WITH_YOUR_GOOGLE_PAY_MERCHANT_ID",
    merchantName: "HN Creative Agency"
  },

  /* ---- Apple Pay ------------------------------------------------- */
  applePay: {
    enabled: true,
    merchantId: "REPLACE_WITH_YOUR_APPLE_MERCHANT_ID"
  },

  /* ---- Wise ---------------------------------------------------- */
  wise: {
    enabled: true,
    profileId: "REPLACE_WITH_YOUR_WISE_PROFILE_ID"
  },

  /* ---- Bank Transfer --------------------------------------------- */
  bankTransfer: {
    enabled: true,
    accountName: "HN Creative Agency",
    instructionsUrl: ""
  },

  /* Backend endpoints (to be implemented server-side). The demo
     payment flow in payment-modal.js simulates these calls. */
  endpoints: {
    createPaymentIntent: "/api/payments/create-intent",
    confirmPayment: "/api/payments/confirm",
    salesInquiry: "/api/sales/inquiry"
  },

  /* Sales contact used by the Enterprise "Contact Sales" panel. */
  sales: {
    email: "hncreativeagency0@gmail.com",
    phone: "+923176250671",
    calendarUrl: ""
  },

  thankYouUrl: "thank-you.html",
  redirectDelayMs: 3000
};
