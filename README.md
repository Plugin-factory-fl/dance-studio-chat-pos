# Dance Studio Chat POS (prototype)

Blue Ocean Dance Studio: a chat first point of sale and studio management prototype. The owner and one example parent (the Chen family) each have a persistent chat thread. Every request is plain language, answered with a confirmation and an inline card. The thread history is the audit trail.

**Live demo:** https://plugin-factory-fl.github.io/dance-studio-chat-pos/

## Setup

```bash
npm install
npm run dev        # http://localhost:3000/dance-studio-chat-pos
npm run build      # static export into out/
```

Everything runs in the browser. State is saved in localStorage and seeded with demo data on first visit. Use the **Reset demo** button in the owner thread header to start over. No AI keys or server are needed; commands are parsed with rules in `lib/engine.ts`.

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`.

## How it works

* `lib/types.ts`: families, students, classes, ledger (charges and payments), attendance, messages, processor.
* `lib/engine.ts`: command parser and actions. Both threads write to the same family accounts, and charges, enrollments and payments are posted into both threads.
* `lib/seed.ts`: demo data: 6 families, 8 dancers, 6 classes, 4 instructors with per class rates, costumes by size, studio store items, the Spring Showcase (tickets, running order, vendors) and waivers.
* Payments run through a stub processor. The default is S## Pages

* `/` is the parent experience: one family thread with a family picker for the demo, plus an **Admin** button.
* `/admin` is the studio inbox in three columns: a searchable list of every family thread (preview, request or unread badge, balance dot) with the **Owner assistant** pinned on top; the selected thread, where the owner can reply as the studio and approve or decline requests inline; and a details column with contact info, balance, plan, card, waivers and one section per child (classes, attendance this term, costume size, recital numbers, merch purchases, medical status).

## Photo inventory count

In the Owner assistant tap **Count inventory from photo**. Take or upload a photo, or try one of the sample photos in `public/samples/`.

* **Demo mode** (default, no key) returns simulated counts for the sample photos and is clearly labeled as simulated.
* **AI mode**: turn demo mode off and paste your own OpenAI API key in the panel settings. The key is kept only in your browser's localStorage and is sent only to OpenAI. The photo goes to `gpt-4o-mini` with a JSON prompt that maps to the inventory catalog (leotards, tights, ballet, tap and jazz shoes, tutus, costumes, studio store) by size and color.
* The review card shows photo counts beside system counts with the difference. Edit any count, then tap **Update inventory**; changes are applied and written to the inventory log. Type `Inventory` to see every category, size and count with low stock flags.

## Editing policies

Every policy and offering parents see is a placeholder in **`lib/policy.ts`**: dress code, absence policy, trial fee, competition teams, specialty classes, solo and duo pricing, recital details, payment plans and the medical and refund policy. Edit that one file, rebuild, and the chat answers update. Use Reset demo to reload specialty classes into saved data.

## Demo script

Tap the suggestion chips under each thread, or type these. Use the family picker in the parent thread header to switch families.

Front end (owner thread):
1. `Enroll Emma Chen in Monday 5pm Ballet, start next week, $75/month, charge card ending 4242` then **Confirm enroll**.
2. `Post October tuition for all active students` then **Post tuition**. `Charge the Lopez family $85`.
3. `Maya checked in` or `Mark all present for Tuesday 4pm`.
4. `Text the Tuesday class that recital rehearsal is moved to 5pm`.
5. `Show this month's revenue and outstanding balances`, `Show outstanding balances over $50`, `What did we pay in processing fees this month?`, `Use Square at 2.6% + 15c`.

Back end (same owner thread):
6. Payroll: `Run payroll for October` then **Approve pay run**, or `Pay Sarah $450 for October classes`.
7. Costumes: `How many pink tutus do we have left?`, `Order 12 medium black leotards`, `Costume size chart`.
8. Merch: `Merch stock`, `Sell 2 hoodies to the Rossi family`.
9. Recital: `Recital status`, `Running order`, `Mark videographer booked`, `Add Maya to the opening number`, `Send costume payment links to all families in the spring show`.
10. Waivers: `Who still needs to sign the photo release?` then **Send photo release to missing families**, `Compliance overview`.

Parent threads (all self service, finished in chat with a notice to the owner thread):
* `what classes are avilable?` lists every class with day, time, ages, level, instructor, open spots and price.
* `My child is 5 years old, what classes are avilable for that age group?` filters by age.
* `I want to enroll my kid for a trial class, she's 8 years old. What's available?` then tap **Book trial** to book it with the $15 trial fee.
* `What does my child need to wear to class?` shows the dress code by style and for your dancers.
* `Are there leotards and tights available or do I need to buy those?` shows sizes in stock with **Buy** buttons charged to the family account.
* `My child is going to miss the next 3 classes, do I need to pay for those 3 classes or can I cancel?` explains the absence policy (credit of a quarter of monthly tuition per class when reported 24 hours ahead) with **Cancel those 3 classes**.
* `show me how many pairs of tights I've purchased this year for my 12 year old and 14 year old.` (try the Garcia family) shows purchases per dancer with dates, sizes and totals.
* `Are there any competition groups or specialty classes my child can enroll in?` filters teams and specialty classes by your dancers' ages. Open specialty classes enroll instantly; auditions and Pointe go to the owner.
* `Do you offer solos, duos and trios?` shows pricing with **Request a solo** (sent to the owner for scheduling).
* `Is there a dance recital every year?` shows the Spring Showcase details and whether your dancers are in it.
* `Are there any payment plans?` lists the plans with a **Switch** button that applies right away.
* `What if my child gets sick ... refunds?` shows the medical policy with **Request medical pause** (sent to the owner, needs a doctor's note).
* Cancelling and switching classes happen automatically. Only full classes and open questions go to the owner.
* `What's my balance?` then **Pay now**. `Pay October tuition`. `Buy 4 recital tickets`. `Sign photo release`.
* `Book a trial for Sofia in Saturday 10am Contemporary`, `Can Maya switch to Thursday hip hop?`, `Cancel next week's class`, or any question. Each request shows up in the owner thread with **Approve** and **Decline** buttons (or `Open requests`, `Reply to Patel: ...`), and the parent gets a confirmation card with class, date, time and amount.

## Limitations

Payments, texts and emails are simulated. Commands are rule based, so phrasing should be close to the examples. Data lives only in your browser. Single user, no auth.
