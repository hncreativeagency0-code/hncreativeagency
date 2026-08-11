/* ============================================================
   payment-modal.js
   ----------------------------------------------------------
   Self-contained controller for the pricing checkout modal.
   Depends on window.PAYMENT_CONFIG (see payment-config.js).

   Structure:
     1. DOM template (built once, injected into <body>)
     2. State
     3. Render helpers (reusable components)
     4. Payment flow (simulated — ready for real Stripe/PayPal/
        Google Pay/Apple Pay/Wise integration later)
     5. Event wiring
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.PAYMENT_CONFIG || {};
  var PACKAGES = CFG.packages || {};

  /* ---------- Icons (inline SVG, brand-colored, decorative) ---------- */
  var ICONS = {
    stripe:
      '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="#635BFF"/><path d="M14.6 13.4c0-.7.6-1 1.5-1 1.4 0 3.1.4 4.5 1.2v-4.2c-1.5-.6-3-.8-4.5-.8-3.6 0-6.1 1.9-6.1 5.1 0 5 6.8 4.2 6.8 6.3 0 .8-.7 1.1-1.7 1.1-1.5 0-3.5-.6-5-1.5v4.3c1.7.7 3.4 1 5 1 3.7 0 6.3-1.8 6.3-5.1 0-5.4-6.8-4.4-6.8-6.4Z" fill="#fff"/></svg>',
    paypal:
      '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="#1E293B"/><path d="M13.6 21.8h-2.2l1.6-9.9h3.9c2.2 0 3.6 1.1 3.3 3-.4 2.4-2.2 3.6-4.5 3.6h-1.4l-.7 3.3Z" fill="#009CDE"/><path d="M17.9 10.9h-3.9l-.4 2.3h2.9c2.2 0 3.4 1 3.1 2.9-.3 2.1-1.9 3.2-4 3.2h-.9l-.7 3.3H16c3 0 5.3-1.6 5.8-4.7.5-3.1-1.5-4.7-3.9-5Z" fill="#003087"/></svg>',
    googlepay:
      '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="#1E293B"/><path d="M15.4 16.2v2.7h3.8c-.2 1-1.2 3-3.8 3-2.3 0-4.1-1.9-4.1-4.2s1.8-4.2 4.1-4.2c1.3 0 2.1.5 2.6 1l1.8-1.7c-1.1-1.1-2.6-1.7-4.4-1.7-3.6 0-6.6 2.9-6.6 6.6s3 6.6 6.6 6.6c3.8 0 6.3-2.7 6.3-6.4 0-.4 0-.8-.1-1.2h-6.2Z" fill="#fff"/></svg>',
    applepay:
      '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="#fff"/><path d="M12.9 12.1c-.5.6-1.3 1-2.1 1-.1-.8.3-1.7.7-2.2.5-.6 1.4-1 2.1-1.1.1.9-.3 1.7-.7 2.3Zm.7 1.1c-1.2-.1-2.2.7-2.7.7-.6 0-1.5-.6-2.4-.6-1.3 0-2.4.7-3.1 1.9-1.3 2.3-.3 5.6.9 7.5.6.9 1.4 1.9 2.3 1.9.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6c1 0 1.6-.9 2.3-1.8.7-1 1-2 1-2.1-.1 0-1.9-.7-1.9-2.8 0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.3-2.6-1.3Z" fill="#000"/><text x="16.5" y="20.5" font-family="Poppins,sans-serif" font-size="7" font-weight="700" fill="#000">Pay</text></svg>',
    wise:
      '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="#9FE870"/><path d="M9 21.5 15.2 14h-4L15.4 9h7.8l-6.1 7.4h4L14.8 24l-1-2.5H9Z" fill="#163300"/></svg>',
    bank:
      '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="#1E293B"/><path d="M16 8l8 4.5H8L16 8Z" fill="#8B5CF6"/><path d="M9 14h2v7H9v-7Zm4 0h2v7h-2v-7Zm4 0h2v7h-2v-7Zm4 0h2v7h-2v-7Z" fill="#CBD5E1"/><path d="M8 23h16v1.6H8V23Z" fill="#CBD5E1"/></svg>',
    lock:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="#94A3B8" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#94A3B8" stroke-width="1.6" stroke-linecap="round"/></svg>',
    visa:
      '<svg viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg"><rect width="38" height="24" rx="4" fill="#1A1F71"/><text x="19" y="16" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9" font-weight="700" fill="#fff">VISA</text></svg>',
    mastercard:
      '<svg viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg"><rect width="38" height="24" rx="4" fill="#16213E"/><circle cx="16" cy="12" r="6.5" fill="#EB001B"/><circle cx="24" cy="12" r="6.5" fill="#F79E1B" fill-opacity="0.9"/></svg>',
    amex:
      '<svg viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg"><rect width="38" height="24" rx="4" fill="#2E77BC"/><text x="19" y="15" text-anchor="middle" font-family="Poppins,sans-serif" font-size="7" font-weight="700" fill="#fff">AMEX</text></svg>',
    discover:
      '<svg viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg"><rect width="38" height="24" rx="4" fill="#1E293B"/><text x="16" y="15" text-anchor="middle" font-family="Poppins,sans-serif" font-size="6" font-weight="700" fill="#fff">DISC</text><circle cx="30" cy="12" r="5" fill="#FF6000"/></svg>',
    check:
      '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path class="pm-success-check" d="M11 20.5 17 26.5 29 13.5" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    errorX:
      '<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 11l14 14M25 11 11 25" stroke="#f87171" stroke-width="3" stroke-linecap="round"/></svg>',
    calendar:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    doc:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12h6M9 15.5h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    send:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 20.5 20.5 12 3.5 3.5l2 7.3 9 1.2-9 1.2-2 7.3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    briefcase:
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7.5" width="18" height="12" rx="2" stroke="var(--primary)" stroke-width="1.6"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5M3 12.5h18" stroke="var(--primary)" stroke-width="1.6"/></svg>'
  };

  var METHODS = [
    { id: "stripe", label: "Card (Stripe)", icon: ICONS.stripe, enabled: (CFG.stripe || {}).enabled !== false },
    { id: "paypal", label: "PayPal", icon: ICONS.paypal, enabled: (CFG.paypal || {}).enabled !== false },
    { id: "googlepay", label: "Google Pay", icon: ICONS.googlepay, enabled: (CFG.googlePay || {}).enabled !== false },
    { id: "applepay", label: "Apple Pay", icon: ICONS.applepay, enabled: (CFG.applePay || {}).enabled !== false },
    { id: "wise", label: "Wise", icon: ICONS.wise, enabled: (CFG.wise || {}).enabled !== false },
    { id: "bank", label: "Bank Transfer", icon: ICONS.bank, enabled: (CFG.bankTransfer || {}).enabled !== false }
  ].filter(function (m) { return m.enabled; });

  var COUNTRIES = ["Pakistan", "United States", "United Kingdom", "Canada", "Australia", "United Arab Emirates", "Germany", "France", "India", "Other"];

  /* ---------- State ---------- */
  var state = {
    packageId: null,
    method: METHODS.length ? METHODS[0].id : null,
    lastFocused: null
  };

  /* ---------- Build & inject modal markup once ---------- */
  var root = document.createElement("div");
  root.innerHTML =
    '<div class="pm-overlay" id="pmOverlay" aria-hidden="true">' +
      '<div class="pm-modal" role="dialog" aria-modal="true" aria-labelledby="pmTitle">' +
        '<button type="button" class="pm-close" id="pmClose" aria-label="Close payment modal">&times;</button>' +

        '<div id="pmViewForm">' +
          '<div class="pm-header">' +
            '<div class="pm-header-badge" id="pmBadge">Package</div>' +
            '<h3 id="pmTitle">Complete Your Purchase</h3>' +
            '<p class="pm-header-sub">Secure checkout for <span id="pmPackageInline">—</span></p>' +
          '</div>' +

          '<div id="pmEnterpriseView" hidden></div>' +

          '<form id="pmForm" class="pm-form" novalidate>' +
            '<div class="pm-section-label">Your Details</div>' +
            '<div class="pm-row">' +
              '<div class="pm-field"><label for="pmName">Customer Name</label>' +
                '<input id="pmName" name="name" type="text" placeholder="e.g. Ahmed Khan" required/>' +
                '<span class="pm-error-text">Please enter your name.</span></div>' +
              '<div class="pm-field"><label for="pmEmail">Email Address</label>' +
                '<input id="pmEmail" name="email" type="email" placeholder="hello@example.com" required/>' +
                '<span class="pm-error-text">Please enter a valid email.</span></div>' +
            '</div>' +
            '<div class="pm-row">' +
              '<div class="pm-field"><label for="pmPhone">Phone Number</label>' +
                '<input id="pmPhone" name="phone" type="tel" placeholder="+92 300 1234567" required/>' +
                '<span class="pm-error-text">Please enter your phone number.</span></div>' +
              '<div class="pm-field"><label for="pmCompany">Company Name <span class="pm-optional">(Optional)</span></label>' +
                '<input id="pmCompany" name="company" type="text" placeholder="Your company"/></div>' +
            '</div>' +
            '<div class="pm-row">' +
              '<div class="pm-field"><label for="pmCountry">Country</label>' +
                '<select id="pmCountry" name="country" required></select>' +
                '<span class="pm-error-text">Please select your country.</span></div>' +
              '<div class="pm-field"><label for="pmPromo">Promo Code <span class="pm-optional">(Optional)</span></label>' +
                '<input id="pmPromo" name="promo" type="text" placeholder="Enter code"/></div>' +
            '</div>' +

            '<div class="pm-section-label">Payment Method</div>' +
            '<div class="pm-methods-grid" id="pmMethods" role="radiogroup" aria-label="Payment method"></div>' +
            '<div class="pm-card-brands" id="pmCardBrands"></div>' +
            '<div class="pm-stripe-card-mount" id="pmStripeCardElement">Card details will appear here once Stripe is connected.</div>' +

            '<div class="pm-section-label">Order Summary</div>' +
            '<div class="pm-summary">' +
              '<div class="pm-summary-row"><span>Package</span><span id="pmSumPackage">—</span></div>' +
              '<div class="pm-summary-row"><span>Price</span><span id="pmSumPrice">—</span></div>' +
              '<div class="pm-summary-row" id="pmSumTaxRow" hidden><span id="pmSumTaxLabel">Tax</span><span id="pmSumTax">—</span></div>' +
              '<div class="pm-summary-row pm-total"><span>Total</span><span id="pmSumTotal">—</span></div>' +
            '</div>' +

            '<div class="pm-secure-notice">' + ICONS.lock + ' 256-bit SSL Secure Payment — payments are securely processed.</div>' +

            '<button type="submit" class="pm-submit-btn" id="pmSubmitBtn">Pay Securely →</button>' +
          '</form>' +
        '</div>' +

        '<div class="pm-processing" id="pmViewProcessing" hidden>' +
          '<div class="pm-spinner" role="status" aria-label="Processing payment"></div>' +
          '<p>Processing your payment securely…</p>' +
        '</div>' +

        '<div class="pm-success" id="pmViewSuccess" hidden>' +
          '<div class="pm-success-circle">' + ICONS.check + '</div>' +
          '<h4>Thank you for your purchase.</h4>' +
          '<p>We\u2019ve emailed your invoice to your inbox.</p>' +
          '<p class="pm-success-redirect">Redirecting you shortly…</p>' +
        '</div>' +

        '<div class="pm-error" id="pmViewError" hidden>' +
          '<div class="pm-error-circle">' + ICONS.errorX + '</div>' +
          '<h4>Payment Failed</h4>' +
          '<p id="pmErrorMsg">Something went wrong while processing your payment. No charge was made.</p>' +
          '<div class="pm-error-actions">' +
            '<button type="button" class="pm-submit-btn pm-retry-btn" id="pmRetryBtn">Retry Payment</button>' +
            '<button type="button" class="pm-submit-btn" id="pmBackBtn">Edit Details</button>' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(root.firstElementChild);
    init();
  });

  var els = {}; // populated in init()

  function fmtPrice(n) {
    if (n === null || n === undefined) return "Custom";
    return "$" + Number(n).toLocaleString("en-US");
  }

  function calcTotals(pkg) {
    var price = pkg.price || 0;
    var taxCfg = CFG.tax || { enabled: false, rate: 0, label: "Tax" };
    var tax = taxCfg.enabled ? Math.round(price * taxCfg.rate * 100) / 100 : 0;
    return { price: price, tax: tax, total: Math.round((price + tax) * 100) / 100, taxLabel: taxCfg.label || "Tax", taxEnabled: !!taxCfg.enabled };
  }

  function renderMethods() {
    els.methods.innerHTML = METHODS.map(function (m, i) {
      return '<label class="pm-method' + (m.id === state.method ? ' pm-selected' : '') + '" data-method="' + m.id + '">' +
        '<input type="radio" name="pmMethod" value="' + m.id + '" ' + (m.id === state.method ? "checked" : "") + '/>' +
        '<span class="pm-method-icon">' + m.icon + '</span>' +
        '<span class="pm-method-label">' + m.label + '</span>' +
      '</label>';
    }).join("");

    Array.prototype.forEach.call(els.methods.querySelectorAll(".pm-method"), function (el) {
      el.addEventListener("click", function () {
        state.method = el.getAttribute("data-method");
        renderMethods();
        renderCardBrands();
      });
    });
  }

  function renderCardBrands() {
    var stripeCfg = CFG.stripe || {};
    var show = state.method === "stripe" && stripeCfg.enabled !== false;
    els.cardBrands.hidden = !show;
    els.stripeMount.hidden = !show;
    if (show) {
      var order = ["visa", "mastercard", "amex", "discover"];
      var supported = stripeCfg.supportedCards || order;
      els.cardBrands.innerHTML = order.filter(function (c) { return supported.indexOf(c) !== -1; })
        .map(function (c) { return ICONS[c]; }).join("");
    }
  }

  function populateCountries() {
    els.country.innerHTML = '<option value="" disabled selected>Select your country</option>' +
      COUNTRIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("");
  }

  function renderEnterprise(pkg) {
    var sales = CFG.sales || {};
    els.enterpriseView.hidden = false;
    els.form.hidden = true;
    els.enterpriseView.innerHTML =
      '<div class="pm-enterprise">' +
        '<div class="pm-enterprise-icon">' + ICONS.briefcase + '</div>' +
        '<h4>Contact Sales for Custom Quote</h4>' +
        '<p>Every Enterprise engagement is scoped to your goals. Talk to our team and we\u2019ll put together a tailored proposal and pricing.</p>' +
        '<div class="pm-enterprise-actions">' +
          '<a class="pm-enterprise-btn pm-primary" href="' + (sales.calendarUrl || ("mailto:" + sales.email + "?subject=" + encodeURIComponent("Schedule a Consultation - Enterprise Package"))) + '" target="_blank" rel="noopener">' +
            ICONS.calendar +
            '<span><span class="pm-eb-title">Schedule Consultation</span><br/><span class="pm-eb-sub">Book a call with our team</span></span>' +
          '</a>' +
          '<a class="pm-enterprise-btn" href="mailto:' + sales.email + '?subject=' + encodeURIComponent("Request Custom Proposal - Enterprise Package") + '">' +
            ICONS.doc +
            '<span><span class="pm-eb-title">Request Custom Proposal</span><br/><span class="pm-eb-sub">Get a tailored scope &amp; quote</span></span>' +
          '</a>' +
          '<a class="pm-enterprise-btn" href="mailto:' + sales.email + '?subject=' + encodeURIComponent("Sales Inquiry - Enterprise Package") + '">' +
            ICONS.send +
            '<span><span class="pm-eb-title">Send Inquiry</span><br/><span class="pm-eb-sub">Tell us about your project</span></span>' +
          '</a>' +
        '</div>' +
      '</div>';
  }

  function resetViews() {
    els.formWrap.hidden = false;
    els.processing.hidden = true;
    els.success.hidden = true;
    els.error.hidden = true;
  }

  function showFieldError(field, invalid) {
    field.closest(".pm-field").classList.toggle("pm-invalid", invalid);
  }

  function validate() {
    var ok = true;
    var name = els.form.querySelector("#pmName");
    var email = els.form.querySelector("#pmEmail");
    var phone = els.form.querySelector("#pmPhone");
    var country = els.form.querySelector("#pmCountry");

    var nameValid = name.value.trim().length > 1;
    showFieldError(name, !nameValid); ok = ok && nameValid;

    var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    showFieldError(email, !emailValid); ok = ok && emailValid;

    var phoneValid = /^[0-9+()\-\s]{7,}$/.test(phone.value.trim());
    showFieldError(phone, !phoneValid); ok = ok && phoneValid;

    var countryValid = !!country.value;
    showFieldError(country, !countryValid); ok = ok && countryValid;

    return ok;
  }

  /* ---------- Payment flow (simulated) ----------
     Wires to CFG.endpoints in a real backend integration.
     Replace the body of processPayment() with real calls to
     createPaymentIntent / confirmPayment (or PayPal/Google Pay/
     Apple Pay/Wise SDKs) once a backend is available. */
  function processPayment(payload) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        // Demo-only failure trigger so the error state is reachable:
        // type "FAIL" as the promo code.
        if ((payload.promo || "").trim().toUpperCase() === "FAIL") {
          reject(new Error("Your payment could not be authorized. Please check your details or try another method."));
        } else {
          resolve({ id: "demo_" + Date.now() });
        }
      }, 1600);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    var pkg = PACKAGES[state.packageId];
    var totals = calcTotals(pkg);
    var payload = {
      package: pkg.id,
      name: els.form.querySelector("#pmName").value.trim(),
      email: els.form.querySelector("#pmEmail").value.trim(),
      phone: els.form.querySelector("#pmPhone").value.trim(),
      company: els.form.querySelector("#pmCompany").value.trim(),
      country: els.form.querySelector("#pmCountry").value,
      promo: els.form.querySelector("#pmPromo").value.trim(),
      method: state.method,
      total: totals.total
    };

    els.formWrap.hidden = true;
    els.processing.hidden = false;
    els.submitBtn.disabled = true;

    processPayment(payload).then(function () {
      els.processing.hidden = true;
      els.success.hidden = false;
      setTimeout(function () {
        window.location.href = CFG.thankYouUrl || "thank-you.html";
      }, CFG.redirectDelayMs || 3000);
    }).catch(function (err) {
      els.processing.hidden = true;
      els.error.hidden = false;
      els.errorMsg.textContent = err.message || "Something went wrong while processing your payment. No charge was made.";
    }).finally(function () {
      els.submitBtn.disabled = false;
    });
  }

  function renderPackage(pkg) {
    els.badge.textContent = pkg.name;
    els.packageInline.textContent = pkg.name + " package";
    document.getElementById("pmSumPackage").textContent = pkg.name;
    document.getElementById("pmSumPrice").textContent = fmtPrice(pkg.price);

    var totals = calcTotals(pkg);
    var taxRow = document.getElementById("pmSumTaxRow");
    if (totals.taxEnabled) {
      taxRow.hidden = false;
      document.getElementById("pmSumTaxLabel").textContent = totals.taxLabel;
      document.getElementById("pmSumTax").textContent = fmtPrice(totals.tax);
    } else {
      taxRow.hidden = true;
    }
    document.getElementById("pmSumTotal").textContent = pkg.type === "custom" ? "Custom" : fmtPrice(totals.total);
  }

  function openModal(packageId) {
    var pkg = PACKAGES[packageId];
    if (!pkg) return;
    state.packageId = packageId;
    state.lastFocused = document.activeElement;

    resetViews();
    renderPackage(pkg);

    if (pkg.type === "custom") {
      renderEnterprise(pkg);
    } else {
      els.enterpriseView.hidden = true;
      els.form.hidden = false;
      els.form.reset();
      Array.prototype.forEach.call(els.form.querySelectorAll(".pm-field"), function (f) { f.classList.remove("pm-invalid"); });
      state.method = METHODS.length ? METHODS[0].id : null;
      renderMethods();
      renderCardBrands();
    }

    els.overlay.classList.add("pm-open");
    els.overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(function () { els.close.focus(); }, 50);
  }

  function closeModal() {
    els.overlay.classList.remove("pm-open");
    els.overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (state.lastFocused) state.lastFocused.focus();
  }

  function init() {
    els.overlay = document.getElementById("pmOverlay");
    els.close = document.getElementById("pmClose");
    els.formWrap = document.getElementById("pmViewForm");
    els.form = document.getElementById("pmForm");
    els.enterpriseView = document.getElementById("pmEnterpriseView");
    els.processing = document.getElementById("pmViewProcessing");
    els.success = document.getElementById("pmViewSuccess");
    els.error = document.getElementById("pmViewError");
    els.errorMsg = document.getElementById("pmErrorMsg");
    els.badge = document.getElementById("pmBadge");
    els.packageInline = document.getElementById("pmPackageInline");
    els.methods = document.getElementById("pmMethods");
    els.cardBrands = document.getElementById("pmCardBrands");
    els.stripeMount = document.getElementById("pmStripeCardElement");
    els.country = document.getElementById("pmCountry");
    els.submitBtn = document.getElementById("pmSubmitBtn");
    els.retryBtn = document.getElementById("pmRetryBtn");
    els.backBtn = document.getElementById("pmBackBtn");

    populateCountries();
    els.form.addEventListener("submit", handleSubmit);
    els.close.addEventListener("click", closeModal);
    els.overlay.addEventListener("click", function (e) { if (e.target === els.overlay) closeModal(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && els.overlay.classList.contains("pm-open")) closeModal();
    });
    els.retryBtn.addEventListener("click", function () {
      els.error.hidden = true;
      els.formWrap.hidden = false;
    });
    els.backBtn.addEventListener("click", function () {
      els.error.hidden = true;
      els.formWrap.hidden = false;
    });

    // Wire up any element carrying data-package (pricing cards).
    var triggers = document.querySelectorAll("[data-package]");
    Array.prototype.forEach.call(triggers, function (el) {
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-haspopup", "dialog");
      el.addEventListener("click", function () { openModal(el.getAttribute("data-package")); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(el.getAttribute("data-package"));
        }
      });
    });
  }

  // Expose for manual triggering if needed elsewhere.
  window.openPaymentModal = openModal;
  window.closePaymentModal = closeModal; 
})();
