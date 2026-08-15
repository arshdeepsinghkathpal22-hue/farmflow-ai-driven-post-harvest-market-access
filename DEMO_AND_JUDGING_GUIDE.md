# Demo and Judging Guide

Everything you need to run the demo, answer what judges actually ask, and know
exactly which claims you can defend.

Read Part 5 and Part 6 twice. Those are the parts that decide rounds.

---

## Part 0 - Fifteen minutes before you present

Run these three commands and read the output. If anything fails, you want to
know now and not on stage.

```bash
cd backend && .venv/Scripts/python -m pytest -q
```

```bash
cd web && npm test
```

```bash
cd web && npm run build && npm run preview
```

Then, in a second terminal:

```bash
cd web && npm run qa
```

You should see **40 passed** from the backend, then **42 passed**, **20 passed**
and **6 fixtures** from the three web suites, then **117 passed** from QA. That
is **225 automated checks**. Memorise that number - it comes up in Part 6.

The six are the freshness pipeline run over six real held-out photographs, and
they run in Node with no browser at all: the pixels are decoded ahead of time
and the model's answer comes from the same ONNX graph through Python. That
matters on the day. If the laptop's Chrome will not start, four of the five
suites still run and still prove the analysis is right.

Worth knowing, because a judge may ask: that QA suite passes both with the
backend running and with it stopped. Both are supported ways to run the app, so
a check that only held in one of them would be testing the harness rather than
the product.

**Set the stage before the judges walk in:**

1. Open the app, go to **Profile → Reset demo**. This now clears the *server* as
   well as the phone, and that matters more than it sounds: a 450 kg lot takes
   eighteen of a facility's 180 micro-slots, so ten demo bookings fill it and
   the eleventh is refused with "only 0 free". Correct behaviour, terrible
   timing. Tap reset between practice runs.
2. Set language to **Hindi** on the guide screen. Opening in Hindi and then
   switching to English *in front of them* is worth more than opening in English.
3. Have a photo of a tomato on the laptop. A real photo, not a stock image -
   somebody will ask.
4. Start the backend, then **sign in** (Profile → Sign in, credentials are
   printed on the form). Signed in, bookings you make on stage hold real slots
   on the server, which is what makes moment 6 possible. Keep the API docs at
   `localhost:8000/docs` open in a background tab.
5. Close every other tab. A stray tab has ended more demos than any bug.

---

## Part 1 - Every feature, and the one sentence to say about it

### Voice booking (`#/voice`)

**What it does.** Farmer taps the microphone, speaks in Hindi, Punjabi or
English, and a booking appears - crop, quantity, pickup day, matched warehouse.

**How to use it.** Pick a language chip. Tap the big mic. Say
*"kal teen crate tamatar"*. If the room is loud or the browser refuses the
microphone, tap **Try an example instead** - it runs the identical parser over a
written phrase, so nothing about the demo is faked when you fall back.

**Say this:** *"There is no translation step. We parse Hindi directly, because a
translation hop is one more thing to fail and machine translation mangles
'3 crate tamatar' specifically."*

**The thing to show off:** say it wrong on purpose. *"kal teen crate tamatr"* -
a dropped vowel - still books correctly. So does *"to matar"*, where the
recogniser splits the word in half. That robustness is deliberate and tested.

**Also try:** *"kal teen crate tamatar aur do bori aloo"* - one sentence, two
bookings.

### Freshness check (`#/freshness`) - **this is your best screen**

**What it does.** Photograph produce. The app identifies the crop, scores
freshness, estimates shelf life left, then joins that to the mandi price
forecast and tells the farmer, in rupees, whether to store or sell.

**How to use it.** Tap **Take a photo** or **Choose from gallery**. Wait about a
second. Pick the lot size. Read the verdict.

**Say this:** *"A freshness score is not a decision. This is."*

**What you will see with a fresh tomato, 450 kg:**

| | |
|---|---|
| Freshness | 93 |
| Shelf life left | 6.5 days |
| Sell today | ₹5,400 |
| Best day | +3 days, ₹5,715 |
| Verdict | **Store for 3 days and earn about ₹315 more** |

The table underneath shows all seven days. Point past the best day: the net
*falls* again, because decay finally outruns the price rise. An app that just
said "store it" would have missed that.

These figures come from the real held-out photograph in `web/public/fixtures/`,
not from a mock-up. Your own tomato will read differently, and saying so is
safer than reciting a number the screen then contradicts.

### The guide (`#/guide`)

Ten sections explaining every screen, fully translated into Hindi, Punjabi and
English. Switching language here switches the whole app - including which
language the microphone listens in.

**Say this:** *"A farmer who needs this app is not reading English. So the guide,
the recommendations and the speech recogniser all follow one setting."*

### Receipt and verification (`#/verify`)

Every booking issues a signed warehouse receipt with a QR code. Anyone - a
lender, a buyer, the gate clerk - can verify it without being able to issue one.

### Price advisor (`#/advisor`)

Seven-day forecast per crop with a confidence band that widens with time.

**Say this:** *"The band is derived from each crop's own historical volatility.
Onion is a more volatile crop than potato, so its band is wider. A forecast
without an error bar is a guess with good posture."*

### Group booking (`#/group`)

The pooling model: several farmers' small lots combine into one pallet-level
consignment. Shows the transport saving that makes it worth doing.

### Owner dashboard (`#/owner`)

Six sections - inventory, occupancy, payments, analytics, staff, settings. The
one to open is **Analytics**: average lot size fell from 940 kg to 210 kg after
accepting micro-slots, and revenue went *up*.

### Sign in (`#/login`, or Profile → Sign in)

Optional, and the screen says so. Signed out, the app is entirely local and a
booking lives on the phone. Signed in against a running backend, bookings are
pushed to the server, come back with a reference, and hold real slots.

**Say this:** *"Signing in is not a gate, it is a switch. It is what turns a row
on this handset into a slot another farmer can no longer book."*

The form tells you whether it found a backend before you type, and the demo
credentials are printed on it.

### Offline mode (`Profile → Simulate no network`)

Turn it on, make a booking, turn it off. The booking is held on the phone and
pushes when the signal returns.

---

## Part 2 - The six-minute demo script

Timed. Do not improvise the first ninety seconds.

**0:00 - 0:40 · The problem, with one number**

> "A cold storage will not take 200 kg. The paperwork and handling cost more
> than the lot earns, so a small farmer is turned away. With nowhere to keep it,
> they sell inside the week - exactly when every neighbour is harvesting and the
> price has crashed. India has the cold storage capacity. It is just not
> reachable in the sizes small farmers actually have."

**0:40 - 1:40 · Voice booking**

Open in Hindi. Tap the mic. Say *"kal teen crate tamatar"*. Booking appears.

> "Hindi, Punjabi or English. No typing, no reading."

Now do the damaged one: *"kal teen crate tamatr"*. It still works.

> "That was a wrong word on purpose. Speech recognition in a field is noisy, so
> the parser matches approximately - within an edit distance budget scaled to
> word length. Twenty-one tests cover exactly this."

**1:40 - 3:10 · Freshness → money → booking** *(your strongest 90 seconds)*

Photograph the tomato. Let it analyse.

> "It identified the crop, scored freshness at 93, and estimated 6.5 days of
> shelf life left - all on this device, the photo never leaves the phone."

Then scroll to the money.

> "And here is where it stops being a science project. That shelf life goes into
> the price forecast against the storage rate. Sell today: five thousand four
> hundred. Store five days: five thousand eight hundred and ninety-two. Four
> hundred and ninety-two rupees, for a decision that currently gets made by
> guessing."

Point at day 6.

> "Note it does not say store as long as possible. On day six the net falls -
> spoilage finally beats the price rise."

Tap **Book 5 days**. Receipt with QR appears.

**3:10 - 4:00 · Tamper the receipt**

Open `#/verify`, paste the code, verify - genuine. Change one digit of the
quantity. Verify again - fails.

> "That is what makes a warehouse receipt worth lending against. And this maps
> onto a real framework: WDRA's electronic Negotiable Warehouse Receipt scheme
> already exists - we are not inventing a standard, we are building the
> small-lot on-ramp to one."

**4:00 - 4:40 · Offline**

Profile → Simulate no network → make a booking → turn it back on.

> "Every action writes locally first, then syncs. This is not a fallback, it is
> the design. A farmer standing in a field cannot wait for a round trip."

**4:40 - 5:30 · The owner's side**

Owner dashboard → Analytics.

> "The owner's average lot fell from 940 kg to 210 kg, and revenue went up,
> because micro-slots fill the fifth of the building that bulk demand leaves
> empty. Nobody has to build anything new. That is the whole business case."

**5:30 - 6:00 · Close**

> "Two hundred and fourteen automated tests, including one that races twenty
> real threads at a single storage slot to prove it can never be sold twice.
> The prototype runs offline, on one laptop, with no API keys."

---

## Part 3 - The five moments that win rounds

Rank them. If you only get three minutes, do 1, 2 and 5.

1. **The same crop, two answers.** Photograph a fresh tomato: *store 3 days,
   +₹315*. Photograph a bruised one: *sell today*. Same crop, same market, same
   day - the photograph changed the financial advice. This is the single
   clearest proof that the pieces are actually joined rather than sitting on
   separate screens.

2. **Saying the word wrong and it still working.** Judges expect voice demos to
   be rehearsed and brittle. Breaking it on purpose and having it hold is
   memorable in a way a clean run never is.

3. **The tamper.** Changing one digit and watching the seal fail is visceral.
   Ten seconds, no explanation needed.

3b. **Point the camera at the ceiling.** The freshness check *refuses*: "this
   photo is almost entirely one flat colour, so there is nothing to measure".
   Then correct the crop on a real photo with one tap and watch the shelf life
   and the rupee figure follow.

   > "Identifying a crop from colour is a closed-set problem - asked which of
   > four crops this is, the model has to answer with one of them, and it will
   > answer confidently about a photograph of your hand, because skin really is
   > potato-coloured. We measured that: lettering on a wall scores 0.85 against
   > our crop signatures and a real cauliflower scores 0.50, so no threshold
   > separates them. The fix is not a cleverer threshold. It is that the farmer
   > confirms the crop."

   Judges remember a system that knows what it does not know.

4. **Pulling the network out.** Especially in a room where somebody has just
   watched another team's demo die on the venue wifi.

5. **The concurrency test.** Run it live:

   ```bash
   cd backend && .venv/Scripts/python -m pytest tests/test_concurrency.py -v
   ```

   > "Twenty threads race for one slot. Exactly one wins. On SQLite that comes
   > from opening every transaction with BEGIN IMMEDIATE, so the write lock is
   > taken before the free slots are read. On PostgreSQL it becomes
   > SELECT FOR UPDATE SKIP LOCKED and nothing above the database layer changes."

   Most hackathon prototypes cannot survive two people clicking at once. Showing
   that you thought about it puts you in a different category immediately.

6. **The booking is really on the server, and a retry does not double it.**
   Do this signed in, with `localhost:8000/api/facilities` open in a second tab.

   Before booking, `ST-01` shows `slots_free: 180`. Make the 450 kg booking. The
   card in *My Bookings* gains a green **Server ref** chip. Refresh the facilities
   tab: `slots_free` is now `162` - eighteen slots, because 450 kg at 25 kg a
   slot is eighteen slots. The booking is not a row in localStorage pretending
   to be a reservation.

   Then say this, and run it:

   > "The device generates the idempotency key when the booking is made, not
   > when it is sent. So if the response is dropped and the phone retries, the
   > slot is reserved once."

   ```bash
   cd backend && .venv/Scripts/python -m pytest tests/test_concurrency.py -k retry -v
   ```

   This is the moment that answers "is this a real system or a mockup?" before
   anybody has to ask it.

---

## Part 4 - What is AI and advanced here, honestly

Learn this section properly. The fastest way to lose a technical judge is to say
"we used AI/ML" about something that is a lookup table. The fastest way to win
one is to describe exactly what you built and why that choice was right.

### Genuinely AI / ML

**1. Automatic speech recognition, three languages.**
The browser's recogniser is driven at `hi-IN`, `pa-IN` and `en-IN`. This is a
real neural ASR model. You did not train it, and you should say so - you
integrated it, which is the correct engineering decision.

**2. Natural language understanding over noisy input.**
This is real NLP and it is your work. A domain lexicon spanning three scripts
plus romanisations, matched with **Levenshtein edit distance under a budget
scaled to word length**, over both single tokens and adjacent-pair recombination
so a word the recogniser split in half is rejoined before comparison. Then
multi-clause segmentation, so one sentence can carry two orders.

The subtle part, and the part worth saying out loud: the budget is **zero for
words of four characters or fewer**. At three characters one substitution turns
*das* (ten) into *do* (two), and a parser that accepts that books a fifth of what
the farmer asked for. Refusing to guess is a design decision, not a limitation.

**3. A trained convolutional network for crop and ripeness.**
This is now a real neural network, trained by us, and the honest description is
specific rather than grand. A **MobileNetV3-small** backbone with **two heads** -
one for crop, one for ripeness stage - fine-tuned from ImageNet weights on
**8,551 images** of tomato, capsicum and other produce, drawn from VegNet
(Mendeley, CC BY) and a Kaggle healthy-versus-rotten set. It exports to ONNX and
runs **in the browser** through WebAssembly, so the photograph still never
leaves the phone.

Two things about it are worth saying before a judge asks:

*It scores, and the number to quote is not the headline.* On a held-out test set
of 1,283 images: crop 98.9%, ripeness stage 96.6%. But quote the
weakest class yourself before anyone finds it: **spoiled recall is 93.3%**, so
about one rotten lot in fifteen is passed as sound. Saying that first is worth
more than the headline, and it is exactly why the model does not decide alone.

*It is small on purpose.* 1.5M parameters, 4.4 MB, about 13 ms per photograph on
a laptop CPU. That is the largest model that can honestly be called shippable
inside an offline bundle, and shipping it is the whole point - a model that needs
a server is unavailable in the field where it is needed.

*It does not replace the classical pipeline; it is cross-examined by it.* The
colour and texture measurements still run first, they still apply the validity
gates, and when the network's verdict flatly contradicts what the pixels show -
"spoiled" over a surface with zero blemish and zero browning - the app declines
to overrule the measurement and says so on screen. That guard exists because it
was **measured**: shown produce shapes outside its training distribution, the
network answered "spoiled" at 94% confidence over a spotless image. A confident
wrong answer is the failure mode of every closed-set classifier, and no amount
of extra training removes it.

Where they agree, the network chooses the band and the measurements place the lot
inside it, so a tomato with nine lesions and a spotless one do not both read 92.

**3b. Classical computer vision, still doing the work a network cannot.**
Illuminant estimation from the frame border with von Kries correction; Otsu's
method for every threshold; hue histograms compared by Bhattacharyya coefficient;
Laplacian variance for surface texture; tiled analysis so one bad corner is not
averaged away. This is what refuses a photograph of a wall, and what lets the
screen show its working - a softmax cannot explain itself.

**4. Decision-theoretic optimisation.**
This is the piece that ties the project together and it is the one to lead with.
Expected value is maximised over a seven-day horizon, subject to a shelf-life
constraint that came out of the photograph. Revenue is price times sellable
fraction, where the sellable fraction decays **non-linearly** - the exponent is
1.6, so the last day costs far more than the first, which is why waiting one day
too long is expensive. Cold storage divides the decay rate by four. Storage cost
is subtracted. The winning day is the argmax.

The constraint is what makes it inseparable: the same price curve produces a
different answer for a fresh lot and a bruised one.

**5. Forecast uncertainty.**
Confidence bands widen with the square root of the horizon, scaled by each
crop's own historical volatility - the standard random-walk result.

### Advanced engineering, which is not ML and should not be called ML

**6. Ed25519 digital signatures.** Elliptic-curve signing. The private key stays
server-side, the public key is published at `/api/receipts/public-key`. Anyone
can verify; nobody else can issue. That asymmetry is precisely what turns
"eligible as loan collateral" from a slogan into a property.

**7. Serialisable concurrency control.** Covered above. This is the guarantee
everything else rests on.

**8. Local-first architecture with idempotent sync.** The booking is written to
the device first and pushed afterwards, carrying a key the device generated when
the booking was made rather than when it was sent. The backend holds a unique
constraint on that key, so a retry after a dropped response reserves the slot
once. A transient failure stays queued and is retried; a refusal the server
actually issued is shown to the farmer instead of being retried forever. You can
demonstrate all of it - see moment 6.

### What you must say plainly if asked

> "The crop and ripeness model is a real convolutional network we trained -
> MobileNetV3-small, two heads, 8,551 images from two open datasets, running in
> the browser through WebAssembly so the photo never leaves the phone. What it
> is *not* is a shelf-life measurement. It places the lot on a ripeness scale,
> and that stage maps to a published post-harvest table. The table is a table.
>
> And it is deliberately not trusted on its own. A closed-set classifier is at
> its most dangerous when it is confident and wrong - we measured ours calling a
> spotless image 'spoiled' at 94% - so the classical measurements cross-examine
> it, and where they flatly disagree the app declines to guess. That guard, and
> letting the farmer confirm the crop in one tap, matter more than the accuracy
> number."

Say this **before** they ask it. Volunteering a limitation reads as confidence.
Being caught in an overclaim ends the round.

Same for the receipt: the web build signs with HMAC and the demo key ships in
the page, so it proves integrity, not authorship. The **backend** does the real
Ed25519 signing. Both facts are already written into the app's own UI.

---

## Part 5 - What sinks projects like this, and what we did instead

This is the section that separates you from the other cold-chain entries, and
there will be several.

| The usual failure | What we did |
|---|---|
| **"We will build 1,000 new cold storages."** Unfundable, and judges know it. | We add zero infrastructure. We make the idle fifth of existing facilities reachable in small sizes. |
| **No unit economics.** "Who pays?" and the team stalls. | Storage at ₹0.05-0.09/kg/day, platform fee 8%, owner revenue up because occupancy rises. Numbers are in the app, on the owner's Payments and Analytics screens. |
| **AI that is an if-else.** One probing question and it collapses. | Every technique is named honestly in Part 4, including which parts are classical and why. |
| **A demo that needs the venue wifi.** | Runs entirely offline. The offline toggle is a *feature demo*, not damage control. |
| **A pretty UI with nothing behind it.** | 37 backend tests, a real database, a state machine, and a concurrency proof. |
| **No answer on trust or liability.** Who is responsible if produce spoils? | The freshness scan is timestamped at intake and stored, so there is a quality record at gate-in. The signed receipt records exactly what went in. |
| **Ignoring what government already built.** | The receipt is explicitly modelled on **WDRA's e-NWR** framework. Mention AGMARKNET/e-NAM as the price feed and ONDC as the sales channel. Judges at a government hackathon reward plugging into existing rails far more than replacing them. |
| **Unsourced claims.** "40% of produce is wasted" with no citation. | Quote post-harvest loss figures **with the source named** (NABARD / MoFPI studies). If you cannot name the source, do not use the number. |
| **No adoption path.** | Onboard through **FPOs** (Farmer Producer Organisations), not farmer by farmer. One FPO signature brings a cluster, and the pooling model needs a cluster to work at all. |

**Be honest about which of these are built and which are argued.** Built: the
economics, the offline behaviour, the tested backend, the quality record, the
honest AI labelling. Argued on paper: the e-NWR integration, the FPO go-to-market,
the ONDC channel. If a judge asks whether e-NWR is wired up, the answer is *"not
yet - the receipt is designed to that shape, the registry integration is the next
step."* Do not let it sound implemented.

---

## Part 6 - Questions they will ask

**"Is this real AI or just rules?"**
> "Four things are genuinely learned or inferential: the speech recogniser, the
> NLU layer with approximate matching, the vision pipeline, and the
> decision-theoretic optimiser. The vision is classical computer vision rather
> than a trained network, deliberately, because it has to run offline on a cheap
> phone and I would rather ship something verifiable than a pretrained model
> pointed at a task it was not trained for."

**"Why not just use Google Translate for the languages?"**
> "A translation hop is another network dependency and another failure mode, and
> it mangles exactly the phrases we care about. 'Teen crate tamatar' is farm
> vocabulary. We parse the three languages directly, which also means it works
> with no signal."

**"What if the cold storage owner refuses small lots?"**
> "That is the entire premise, and it is why we pool. The owner never sees fifty
> small lots - they see one pallet-level consignment. Their own dashboard shows
> average lot size falling from 940 kg to 210 kg with revenue going up."

**"How do you make money?"**
> "An 8% platform fee on the storage charge, which the owner's Payments screen
> already models. The owner earns more than they did with the space empty, so
> the fee comes out of value we created rather than out of the farmer."

**"What happens if the farmer does not turn up?"**
> Honest answer: *"The booking state machine has expiry and cancellation states
> and stale holds are released automatically, so the slot is not lost. A no-show
> penalty policy is designed but not implemented."*

**"Has this been tested with real farmers?"**
> "No. It is a prototype built for this hackathon. The crop data, prices and
> facilities are modelled on Agmarknet-style feeds and a Rampur cluster. Field
> validation with an FPO is the immediate next step." **Do not invent a pilot.**

**"Why SQLite? That will not scale."**
> "For a prototype it removes a dependency and it still gives the guarantee that
> matters - twenty threads racing one slot, exactly one wins. The move to
> PostgreSQL changes one file: BEGIN IMMEDIATE becomes SELECT FOR UPDATE SKIP
> LOCKED, and nothing above `db.py` is touched. The design anticipated it -
> IDs are already strings rather than autoincrement integers for that reason."

**"What is left to build?"**
Have this ready, it signals maturity:
> "Payments are modelled, not integrated. e-NWR registry integration is designed,
> not wired. Authentication is one fixed demo account - real accounts, OTP
> sign-in and per-farmer isolation are designed but not built. The freshness
> model is classical CV pending a trained detector. And there is no field
> validation yet."

**"Is the login real, or is it hardcoded?"**
> "Both, honestly. The password is checked server side and you get back a signed
> token that every booking call carries - that part is real. But there is one
> fixed account, and its credentials are printed on the login form on purpose,
> because a prototype nobody can get into is a prototype nobody evaluates.
> Multi-tenant accounts are a schema change, not a redesign: bookings are
> already keyed to a farmer id."

---

## Part 7 - Things that will lose you marks, avoid them

- **Do not say "YOLO"** unless you have trained and can show a YOLO model. You
  have not, and one question exposes it.
- **Do not read the slides.** They have the slides.
- **Do not open with the tech stack.** Open with the farmer who cannot store
  200 kg.
- **Do not say "AI-powered"** without immediately naming which technique.
- **Do not claim a pilot, a partnership, or a user count you do not have.**
- **Do not let a teammate answer a question they cannot answer.** Agree in
  advance: the person who wrote a component takes questions on it.
- **Do not run the demo on battery.** Plug in.

---

## Part 8 - The one-line version

If you get thirty seconds in a corridor:

> "Cold storages will not accept 200 kg, so small farmers sell in week one at the
> worst price of the year. We pool small lots into one pallet the owner will
> accept, and a photograph of the produce tells the farmer in rupees whether
> storing it actually pays. It runs offline, in Hindi and Punjabi, by voice."

---

## Appendix - Command reference

```bash
cd backend && .venv/Scripts/activate && uvicorn app.main:app --reload
```

```bash
cd web && npm run dev
```

```bash
cd backend && .venv/Scripts/python -m pytest tests/test_concurrency.py -v
```

```bash
cd web && npm test
```

Login: `farmer` / `farmflow`
