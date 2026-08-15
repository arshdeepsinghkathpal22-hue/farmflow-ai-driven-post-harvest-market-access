# FarmFlow

**An AI-powered micro cold storage and market access network for small Indian farmers.**

> _"No farmer is too small to store."_

India loses close to ₹92,000 crore of produce after harvest every year, and the usual explanation -
that the country does not have enough cold storage - is only half the story. The bigger problem is
that the storage we already have is built for bulk. A farmer arriving at the gate with 50 to 500 kg
gets turned away, because the handling, paperwork and billing on a lot that small costs more than it
earns. With nowhere to keep it, they sell within the week, at exactly the moment every neighbouring
farmer is harvesting and prices have crashed.

FarmFlow pools produce from several farmers nearby into a single pallet-level booking. The
storage owner sees one profitable consignment instead of fifty tiny ones; the farmer gets an entry
ticket that never existed before. Nothing new gets built - the platform just makes idle capacity
reachable.

This repository is the working prototype: the full farmer journey, from a spoken booking in Hindi to
a QR warehouse receipt, plus the storage owner's side of the same transaction.

<p align="center">
  <img src="docs/screenshots/home.png" width="31%" alt="Farmer home screen" />
  <img src="docs/screenshots/advisor.png" width="31%" alt="AI price advisor" />
  <img src="docs/screenshots/receipt.png" width="31%" alt="QR warehouse receipt" />
</p>

---

## Running it

You need [Node.js](https://nodejs.org) 20.19+ or 22.12+ (Vite 8 requires one of those). Nothing else -
no database, no API keys, no accounts.

```bash
npm install
npm run dev
```

Open the URL it prints, usually <http://localhost:5173>. That's it.

On a first visit the app opens a short guide explaining who you are in the story and what is worth
trying - useful when someone lands on the link cold. It can be reopened any time from the Profile
tab. The app also ships a web manifest, so it installs to a phone home screen and runs full screen.

To produce and check the static build that gets deployed:

```bash
npm run build
npm run preview
```

The `dist/` folder is plain HTML, CSS and JavaScript and will run from any static host.

### Checks

```bash
npm run lint
```

There is also an end-to-end suite that drives the built site in headless Chrome or Edge. Start the
preview server first, then run it in a second terminal:

```bash
npm run qa
```

It walks every route, confirms the advisor flips between STORE and SELL on the right crops, checks
that a bulk-only facility refuses a small lot, that a tampered receipt is rejected while a genuine
one verifies, that a booking made offline is queued and later syncs, that bookings survive a reload,
that a double-tap cannot file the same lot twice, and that every owner-console section renders. If it
cannot find a browser, set `QA_BROWSER` to a Chrome or Edge executable.

### Worth trying first

The prototype is not a clickable mock-up - the recommendations, signatures and arithmetic are all
computed live. Five things are worth doing in order:

1. **Tap "Speak to Book" on the home screen.** A spoken order is transcribed and parsed into crop,
   quantity, pickup day and a matched facility. Confirm it and you get a genuinely scannable QR
   warehouse receipt.
2. **Open "Prices" and switch the crop from Tomato to Cauliflower.** Tomato returns _STORE for 6
   days_; cauliflower returns _SELL NOW_, because its forecast falls and storage would cost more
   than it earns. Same model, different answer.
3. **Open the Storage Owner Dashboard** (the button on the Profile tab, or `#/owner`). The booking
   you just made is sitting in the incoming table, flagged `NEW` - the same transaction from the
   supply side. While you are there, drag the micro-slot slider under Analytics.
4. **Try to forge a receipt.** On any receipt, tap _Verify this receipt_ - it reports **genuine**.
   Now change one digit of the quantity in the box and check again. The signature stops matching
   and it is reported as **altered**.
5. **Book with no signal.** On Profile, switch on _Simulate no network_ and book a slot. It is held
   on the phone as **Saved offline**, then syncs by itself when you switch the toggle back.

Bookings persist in `localStorage`, so they survive a reload. Profile → **Reset demo data** clears
everything if you want a clean slate before recording a demo.

---

## Screens

| Route | Screen | What it shows |
| --- | --- | --- |
| `#/` | Farmer home | Voice-first entry point, advisor summary, the pool currently forming nearby |
| `#/voice` | Voice booking | Speech turned into a structured, confirmable booking |
| `#/advisor` | Price predictor | Seven-day forecast, sell-or-store call with confidence and expected profit |
| `#/storage` | Find storage | Facilities ranked on temperature fit, distance, price and micro-slot availability |
| `#/group` | Group booking | Farmer aggregation, shared transport, pallet fill progress |
| `#/bookings` | My bookings | Booking lifecycle and the live freshness window per lot |
| `#/receipt/:id` | Digital receipt | Signed, scannable QR warehouse receipt with its security seal |
| `#/verify` | Verify a receipt | Public check that a receipt has not been altered since issue |
| `#/marketplace` | Buyer marketplace | Direct farmer-to-buyer sales; lots near spoiling surface first |
| `#/impact` | Cluster impact | Food saved, CO₂ avoided, farmer income added |
| `#/profile` | Profile | Farmer identity and the demo reset |
| `#/owner` | Owner dashboard | Six sections: inventory, occupancy, payments, analytics, staff, settings |

The owner console is a full sidebar app in its own right - stored lots with live shelf life,
the micro-slot occupancy grid, the settlement ledger, six months of occupancy and revenue trend,
staff on duty, and the facility preferences (including the switch that turns micro-slots off and
sends the facility back to bulk-only).

<p align="center">
  <img src="docs/screenshots/voice.png" width="31%" alt="Voice booking" />
  <img src="docs/screenshots/group.png" width="31%" alt="Group booking and shared transport" />
  <img src="docs/screenshots/marketplace.png" width="31%" alt="Buyer marketplace" />
</p>

<p align="center">
  <img src="docs/screenshots/owner.png" width="94%" alt="Owner dashboard, occupancy view" />
</p>

<p align="center">
  <img src="docs/screenshots/owner-inventory.png" width="94%" alt="Owner dashboard, stored inventory with live shelf life" />
</p>

<p align="center">
  <img src="docs/screenshots/verify-ok.png" width="42%" alt="A genuine receipt verifying" />
  <img src="docs/screenshots/verify-bad.png" width="42%" alt="A tampered receipt being rejected" />
</p>

---

## How the decision logic works

Everything in [`src/lib/ai.js`](src/lib/ai.js) is deterministic and explainable, and that is on
purpose. A farmer being told to hold their harvest for six days deserves a reason they can check.
Each function sits behind the same interface a hosted model service would expose, so a learned model
can replace a rule set later without touching any caller.

**`sellOrStore(cropId, quantityKg, ratePerKgDay)`** - scans the forecast window for the day with the
best _net_ return, not the highest price:

```
net(d) = (price(d) − price(0)) × qty  −  rate × qty × d
```

Days beyond the crop's shelf life are excluded outright, so the model will never recommend storing
produce past the point it can survive. If no day yields a positive net, the answer is `SELL`.
Confidence decays with the horizon - a six-day call is reported less confidently than a two-day one.

**`matchStorages(cropId, quantityKg)`** - scores each facility out of 100: temperature fit (40),
distance (30), price (30), minus a 35-point penalty when a facility takes bulk consignments only and
the lot is below pallet size. That penalty is what makes the ranking honest - the cheapest facility
in the seed data is bulk-only, and it is correctly ranked below dearer ones that will actually accept
the farmer.

**`poolMath(pool, joined)`** - pallet fill and transport splitting. A trip is billed once and split by
weight share, so each member's cost falls as the pool grows. The saving is measured against the
minimum vehicle hire a farmer would pay alone, which is the charge that makes moving a small quantity
uneconomic in the first place.

**`spoilage(cropId, daysStored)`** - remaining shelf life, which drives the freshness chips, the
priority ordering in the marketplace, and the discount on at-risk lots. Produce that is going to be
lost gets sold cheaply rather than lost entirely.

## Receipts that can be checked

A warehouse receipt is only worth lending against if tampering is obvious, so
[`src/lib/receipt.js`](src/lib/receipt.js) serialises each receipt into a fixed canonical string and
signs it with HMAC-SHA256 through WebCrypto. The QR carries the payload and the signature together,
so a scanner has everything it needs without calling back to us, and `#/verify` re-derives the
signature and reports **genuine**, **altered** or **unreadable**.

One honest limitation, stated on the screen itself as well as here: this prototype holds the demo
signing key in the client, so the seal proves the receipt is unaltered, not who issued it. In
production the key belongs to the facility or the e-NWR registry and signing happens server side.
The verification path does not change when it moves.

## Working without a signal

Rural connectivity is the normal case, not the edge case. Bookings made offline are written to
`localStorage` with a `QUEUED` status, surfaced as **Saved offline**, and pushed automatically when
connectivity returns - driven by the real `online`/`offline` events, with a toggle on the Profile
tab so the behaviour can be demonstrated indoors on good wifi.

### A note on the numbers

The rates in [`src/data/seed.js`](src/data/seed.js) are ₹0.05-0.09 per kg per day, which lands in the
₹1.50-2.50 per kg per month band Indian cold storages actually charge. This matters more than it
looks: at the ₹0.50/kg/day figure that early mock-ups used, storage would cost more than the produce
is worth and the advisor would correctly refuse to ever recommend storing anything.

---

## Project structure

```
src/
├── data/seed.js          Farmers, crops, price series, facilities, pools, marketplace lots
├── lib/
│   ├── ai.js             Advisor, storage matching, pooling maths, spoilage
│   └── format.js         Indian number, rupee and date formatting
├── store/AppStore.jsx    App state + localStorage persistence
├── components/
│   ├── FarmerLayout.jsx  Mobile shell: top bar, bottom nav, toasts
│   ├── DemoGuide.jsx     First-run orientation for someone opening the link cold
│   ├── RouteMap.jsx      Drawn pickup route for a pooled consignment
│   └── ui.jsx            Cards, chips, stat tiles, bar chart, bilingual labels
├── screens/              One file per screen
└── App.jsx               Routes
scripts/qa.mjs            End-to-end checks (npm run qa)
design-system/DESIGN.md   Colour, type, spacing and component rules
```

---

## Deploying

[`../.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) builds this folder and
publishes it to GitHub Pages on every push to `main`.

1. Push the **project root** - the folder holding `web/`, `backend/` and `ml/` - to a GitHub
   repository. Not this folder on its own: GitHub only reads workflows from `.github/workflows/`
   at the repository root, so pushing `web/` alone means the deploy never runs and nothing says why.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push again, or run the workflow manually from the **Actions** tab.

The site lands at `https://<username>.github.io/<repo-name>/`. It works from a project subpath
without configuration because the build uses a relative base and the router keeps its state in the
hash fragment.

Vite is configured with `base: './'` and the app uses `HashRouter`, so the same build works from a
project subpath, a user page or a local file server without editing anything. Deep links keep working
because the route lives in the URL fragment, which never reaches the server.

---

## Design

The interface follows a design system written for rural logistics, kept in
[`design-system/DESIGN.md`](design-system/DESIGN.md). A few rules drove most of the decisions:

- **Every functional label is bilingual.** English and Hindi appear together, always - not as a
  language toggle buried in settings.
- **Voice is the primary control.** The largest element on the home screen is a microphone, because
  literacy should never be what stops a booking.
- **48 px minimum touch targets**, everywhere, even where the visible element is smaller.
- **Warm cream instead of white.** Less glare, and considerably more legible on a phone held in
  direct sunlight.
- **Cards carry a thick left accent** - green for general information, blue for cold-chain data,
  amber for money, red for anything urgent. It is a colour code you can read at a glance without
  reading the words.
- **Motion is functional, not decorative.** Screens rise slightly on entry so navigation reads as a
  push; everything collapses to nothing under `prefers-reduced-motion`.

---

## Built with

React 19 · Vite 8 · Tailwind CSS 3 · React Router 7 · lucide-react · qrcode

No backend, no API keys, no external runtime calls. Everything runs in the browser, which is what
lets this be hosted for free and demonstrated offline.

---

## Status

Functional prototype. The screens, decision models and booking flow all work; the pilot does not
exist yet. The production design pairs this client with a Go booking engine on PostgreSQL, where slot
reservation runs inside a transaction with pessimistic locking so a micro-slot can never be sold
twice, and a background worker returns unconfirmed capacity to the pool.

Next up, in order: live Agmarknet and e-NAM price ingestion, payment settlement, IoT temperature
telemetry, and registering receipts as e-NWR electronic warehouse receipts so they become genuinely
pledgeable against a harvest loan.

---

## Team

Built by four third-year B.Tech Computer Science students at Jaypee Institute of Information
Technology, Noida, for **Ideas of India 2026** under the _Sovereign Technology for India_ track.

| | |
| --- | --- |
| **Harsh Mittal** | Team Leader - product direction, booking engine architecture |
| **Priyanshu Sharma** | Aggregation logic, storage matching, mandi price modelling |
| **Arshdeep Singh** | Farmer application, voice interaction, bilingual interface |
| **Ayush Sarraf** | Storage owner dashboard, field research, pilot operations |

## License

[MIT](LICENSE)
