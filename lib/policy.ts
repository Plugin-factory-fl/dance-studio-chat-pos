// Studio policies and offerings. Every value here is a PLACEHOLDER.
// Edit this one file to change what parents are told in chat.
// Money is in cents (1500 = $15.00). Avoid dashes in any text shown to parents.

export const DRESS_CODE: Record<string, string> = {
  "Ballet": "Black leotard, pink tights, pink ballet slippers, hair in a bun",
  "Tiny Tots Ballet": "Any color leotard, pink tights, pink ballet slippers, hair pulled back",
  "Creative Movement": "Comfortable leotard or fitted tee and leggings, bare feet or ballet slippers",
  "Hip Hop": "Loose comfortable clothes, clean sneakers worn only indoors, no jeans",
  "Jazz": "Black leotard or fitted top, black jazz pants or tights, tan jazz shoes",
  "Contemporary": "Fitted top and leggings or a leotard, bare feet or foot undies",
};
export const ABSENCE_POLICY = [
  "Tuition is monthly and covers four classes, so each class is worth a quarter of monthly tuition.",
  "Tell us at least 24 hours before class and the missed class is credited to your account automatically.",
  "Less than 24 hours notice gets no credit, but your dancer can take a free makeup class within 30 days.",
  "To stop classes for good, give notice before the 1st of the month and next month is not billed.",
];
// Trial class fee
export const TRIAL_FEE_CENTS = 1500;

// Competition teams. audition: true means parents tap "Request audition" and the owner decides.
export const COMPETITION_TEAMS = [
  { id: "team_mini", name: "Mini Competition Team", ageMin: 6, ageMax: 8, requirement: "Invite from your teacher after one season of classes", audition: false, rehearsal: "Saturdays 11am to 12:30pm", feeCents: 7500, extras: "Competition entry fees about $150 per routine, three regional events" },
  { id: "team_junior", name: "Junior Competition Team", ageMin: 9, ageMax: 12, requirement: "Audition required, plus at least one ballet and one jazz class weekly", audition: true, rehearsal: "Thursdays 6pm to 8pm and Saturdays 12pm to 2pm", feeCents: 12500, extras: "Entry fees about $175 per routine, four events plus nationals" },
  { id: "team_senior", name: "Senior Competition Team", ageMin: 13, ageMax: 18, requirement: "Audition required, plus two technique classes weekly", audition: true, rehearsal: "Tuesdays and Thursdays 6:30pm to 8:30pm, Saturdays 1pm to 3pm", feeCents: 15500, extras: "Entry fees about $200 per routine, four events plus nationals" },
];

// Specialty classes. Ones with needsApproval go to the owner as a request, the rest enroll instantly.
export const SPECIALTY_CLASSES = [
  { id: "c_acro", style: "Acro", day: "Wednesday", time: "5pm", instructorId: "i_tasha", hours: 1, room: "Studio B", ageMin: 7, ageMax: 14, level: "All levels", capacity: 10, priceCents: 6500, prereq: "None, mats and spotting provided", needsApproval: false },
  { id: "c_leaps", style: "Leaps and Turns", day: "Friday", time: "5pm", instructorId: "i_marcus", hours: 1, room: "Studio A", ageMin: 9, ageMax: 18, level: "Intermediate", capacity: 12, priceCents: 6000, prereq: "At least one year of ballet or jazz", needsApproval: false },
  { id: "c_pointe", style: "Pointe", day: "Monday", time: "6:30pm", instructorId: "i_elena", hours: 1, room: "Studio B", ageMin: 11, ageMax: 18, level: "Advanced", capacity: 8, priceCents: 7000, prereq: "Two years of ballet, two ballet classes weekly, and teacher approval", needsApproval: true },
];

// Solos, duos and trios. Requests go to the owner because they need scheduling.
export const PRIVATE_WORK = {
  rows: [
    ["Solo", "$350 choreography fee, rehearsals billed as private lessons"],
    ["Duo", "$250 choreography fee per dancer"],
    ["Trio", "$200 choreography fee per dancer"],
    ["Private lesson", "$75 for 60 minutes, $45 for 30 minutes"],
    ["Semi private lesson", "$45 per dancer for 60 minutes"],
    ["Competition entry", "Solo about $125, duo or trio about $95 per dancer per event"],
  ] as [string, string][],
  note: "Most soloists book 8 to 10 private lessons before the first event.",
};

// Annual recital details shown with the Spring Showcase.
export const RECITAL_INFO = {
  everyYear: "Yes, every dancer performs in our Spring Showcase each May.",
  costumeFee: "$45 to $65 per routine, billed in October",
  rehearsals: ["2027-05-08", "2027-05-13", "2027-05-14"],
  dressRehearsal: "Friday before the show, 5pm to 9pm at the theater",
  optOut: "Dancers may opt out by December 1. Costume fees are not refundable after ordering.",
};

// Payment plans. discountPct is taken off tuition. Switching applies right away.
export const PAYMENT_PLANS = [
  { id: "monthly", name: "Monthly autopay", desc: "Card charged on the 1st each month", discountPct: 0, months: 1 },
  { id: "semester", name: "Semester prepay", desc: "Pay 5 months up front, save 5%", discountPct: 5, months: 5 },
  { id: "annual", name: "Annual prepay", desc: "Pay 10 months up front, save 10%", discountPct: 10, months: 10 },
  { id: "split", name: "Monthly plus split show fees", desc: "Monthly autopay, and recital and costume fees split into 3 payments", discountPct: 0, months: 1 },
];

// Medical, injury and refund policy.
export const MEDICAL_POLICY = [
  "With a doctor's note, unused tuition is refunded or credited, prorated by class from the date of the note.",
  "A medical pause holds your dancer's spot for up to 8 weeks with no tuition billed.",
  "Registration fees, costume fees and recital fees are not refundable once paid or ordered.",
  "Injuries at the studio are covered by our accident policy. Report them to the front desk the same day.",
];

// ---------- Billing ----------
// Seasons scope registration fees and the tuition calendar.
export const SEASONS = [
  { id: "fall2026", name: "Fall 2026", start: "2026-09-01", end: "2027-01-31", regOpen: "2026-08-01", regClose: "2026-12-15" },
  { id: "spring2027", name: "Spring 2027", start: "2027-02-01", end: "2027-06-15", regOpen: "2026-12-01", regClose: "2027-02-15" },
];
// Tuition model: "studentRate" uses each dancer's own monthly rate, "rateTable" prices by weekly hours, "perClass" bills each class meeting.
export const BILLING = {
  model: "studentRate" as "studentRate" | "rateTable" | "perClass",
  rateTable: [ { maxHours: 1, cents: 7500 }, { maxHours: 1.5, cents: 9000 }, { maxHours: 2, cents: 11000 }, { maxHours: 3, cents: 14000 }, { maxHours: 99, cents: 17000 } ],
  perClassCents: 2000,
  siblingDiscountPct: 10,      // off each additional dancer in the family after the first
  multiClassDiscountPct: 5,    // off a dancer's tuition when they take 2 or more classes
  dueDay: 1,                   // tuition is due on this day of the month
  graceDays: 10,               // late fee applies after this many days unpaid
  lateFeeCents: 1500,
  autoPostOnFirst: true,       // tuition posts automatically on the 1st when the demo date passes it
};
// Registration fees, charged once per season.
export const REG_FEES = { perFamilyPerSeasonCents: 3500, perStudentPerSeasonCents: 1500 };
// Transaction categories used on statements and reports.
export const TX_CATEGORIES = ["Tuition", "Registration", "Late fee", "Costume", "Merch", "Recital tickets", "Trial", "Specialty", "Discount", "Credit", "Payment", "Other"];

// ---------- Waitlist ----------
export const WAITLIST_HOLD_HOURS = 48;

// ---------- Closures ----------
// When the studio closes, credit each missed class at a quarter of monthly tuition if creditClosures is true.
export const CLOSURE_POLICY = { creditClosures: true, note: "Classes missed for studio closures are credited at a quarter of monthly tuition." };

// ---------- Staff roll call ----------
export const ROLL_STATUSES = ["present", "late", "left early", "observing", "absent"] as const;
