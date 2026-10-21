# Dance Studio Chat POS (prototype)

A chat first point of sale and studio management prototype. The owner and one example parent (the Chen family) each have a persistent chat thread. Every request is plain language, answered with a confirmation and an inline card. The thread history is the audit trail.

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
* `lib/seed.ts`: demo data (Lopez, Chen, Patel families; Hip Hop, Ballet, Jazz classes).
* Payments run through a stub processor. The default is Stripe at 2.9% + 30c. The owner can note any other processor ("Use Square at 2.6% + 15c") and every payment records its processor and fee.

## Demo script

Owner thread (left):
1. `Enroll Emma Chen in Monday 5pm Ballet, start next week, $75/month, charge card ending 4242` then tap **Confirm enroll**. The Chen thread gets notified.

Parent thread (right):
2. `What's my balance?` returns "You owe $75.00 for October. Pay now?" Tap **Pay $75.00 now**. The receipt appears in both threads.

Owner thread:
3. `Post October tuition for all active students` then confirm.
4. `Charge the Lopez family $85`
5. `Maya checked in for Hip Hop` and `Mark all present for Tuesday 4pm`
6. `Show outstanding balances over $50` then tap a **Charge** button to collect from the card on file.
7. `Use Square at 2.6% + 15c` then `What did we pay in processing fees this month?`
8. `Show this month's revenue and outstanding balances`

Type `help` in the owner thread for all examples. Parents can also ask to switch or cancel a class; the request is forwarded to the owner thread.

## Limitations

Payments are simulated (no real card processing). Only the Chen family thread is shown in the UI, though every family has a thread in the data. Back office commands (payroll, costumes, recital, waivers, texting a class) are not built yet. Single user, no auth; data lives only in your browser.
