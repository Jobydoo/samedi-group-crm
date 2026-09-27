# Samedi Group — Operations & Field Service CRM

> Tailored Operations, Scheduling & Ingestion CRM for **Samedi Group** (London, UK).  
> Designed for commercial facilities management, luxury residential housekeeping, and strict Airbnb turnover windows.

![Samedi CRM Dashboard](crm_dashboard_preview.png)

---

## 🌟 Core Modules

1. **Operations Command Center (Dashboard)**
   - Real-time operational KPIs (Monthly Revenue £28.4k, 18 Active Contracts, 42 Jobs/week, 94% Cleaner Utilization).
   - Live London Dispatch Roster with cleaner assignment, price tags, and live statuses.
   - Incoming website inquiry stream from `samedigroup.co.uk`.

2. **Quote & Ingestion Pipeline (Kanban)**
   - 4-Stage visual funnel: `New Inquiries` ➔ `Quote Sent` ➔ `Site Survey` ➔ `Contract Signed`.
   - **Smart London Quote Calculator**: Property scale matrix (1-bed flat to 4,000+ sq ft office) with premium add-ons (Oven valet, Carpet extraction, Hotel linen, Luxury consumables).

3. **Dispatch & Scheduling Calendar**
   - 5-Day London borough grid (Westminster, Kensington, City of London, Brent, Shoreditch).
   - Dedicated Airbnb Turnover tags (strict 10:00 – 15:00 window).

4. **Cleaners Fleet & Compliance Roster**
   - Vetting & DBS verification tracking (`Enhanced`, `Standard`, `Pending`).
   - UK Right to Work verification.
   - **Cleaner Mobile Simulator**: Property access codes (`🔑 Key in concierge`), task checklists, and proof-of-clean photo upload.

5. **Invoices & Stripe Live Payments**
   - UK statutory VAT invoices (Companies Act 2006 compliant, CRN, VAT 20% calculation).
   - Print-ready modal view.
   - Stripe Live vs Test mode toggle with simulated webhook events.

6. **Website Sync & Webhooks**
   - Directly bridges to `samedigroup.co.uk` contact form and `/careers/cleaners` recruitment.

---

## 🚀 Deployment to Vercel

```bash
# Deploy to Vercel
npx vercel --prod
```

Or connect the repository on [vercel.com/new](https://vercel.com/new).

---

## 💻 Local Development

```bash
# Run locally with any static server
python -m http.server 3000
# or
npx serve .
```

Visit: `http://localhost:3000`
