import { DB, Attendance, Klass, Student } from "./types";
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SEED_VERSION = 3;
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
export const TRIAL_FEE_CENTS = 1500;

export function seed(): DB {
  const now = new Date().toISOString();
  const classes: Klass[] = [
    { id: "c_hh_tue", style: "Hip Hop", day: "Tuesday", time: "4pm", instructorId: "i_sarah", hours: 1, room: "Studio A", ageMin: 7, ageMax: 12, level: "Beginner", capacity: 12, priceCents: 8500 },
    { id: "c_hh_thu", style: "Hip Hop", day: "Thursday", time: "4pm", instructorId: "i_sarah", hours: 1, room: "Studio A", ageMin: 8, ageMax: 14, level: "Intermediate", capacity: 12, priceCents: 8500 },
    { id: "c_ballet_mon", style: "Ballet", day: "Monday", time: "5pm", instructorId: "i_elena", hours: 1.5, room: "Studio B", ageMin: 7, ageMax: 12, level: "Level 1", capacity: 10, priceCents: 9000 },
    { id: "c_jazz_wed", style: "Jazz", day: "Wednesday", time: "6pm", instructorId: "i_marcus", hours: 1, room: "Studio A", ageMin: 9, ageMax: 14, level: "Beginner", capacity: 12, priceCents: 6000 },
    { id: "c_contemp_sat", style: "Contemporary", day: "Saturday", time: "10am", instructorId: "i_tasha", hours: 1.5, room: "Studio B", ageMin: 12, ageMax: 18, level: "Intermediate", capacity: 10, priceCents: 8000 },
    { id: "c_tots_sat", style: "Tiny Tots Ballet", day: "Saturday", time: "9am", instructorId: "i_tasha", hours: 0.75, room: "Studio A", ageMin: 3, ageMax: 5, level: "Intro", capacity: 8, priceCents: 5500 },
    { id: "c_creative_fri", style: "Creative Movement", day: "Friday", time: "4pm", instructorId: "i_elena", hours: 0.75, room: "Studio B", ageMin: 4, ageMax: 6, level: "Intro", capacity: 10, priceCents: 5500 },
    { id: "c_ballet_thu", style: "Ballet", day: "Thursday", time: "5pm", instructorId: "i_elena", hours: 1, room: "Studio B", ageMin: 5, ageMax: 8, level: "Pre Ballet", capacity: 10, priceCents: 7500 },
  ];
  const students: Student[] = [
    { id: "s_maya", name: "Maya Lopez", familyId: "fam_lopez", classId: "c_hh_tue", rateCents: 8500, startDate: "2026-09-01", active: true, size: "Child M", age: 10 },
    { id: "s_priya", name: "Priya Patel", familyId: "fam_patel", classId: "c_jazz_wed", rateCents: 6000, startDate: "2026-09-01", active: true, size: "Child L", age: 12 },
    { id: "s_dev", name: "Dev Patel", familyId: "fam_patel", classId: "c_hh_tue", rateCents: 6000, startDate: "2026-09-01", active: true, size: "Child S", age: 8 },
    { id: "s_ava", name: "Ava Johnson", familyId: "fam_johnson", classId: "c_ballet_mon", rateCents: 9000, startDate: "2026-08-15", active: true, size: "Child M", age: 11 },
    { id: "s_lily", name: "Lily Johnson", familyId: "fam_johnson", classId: "c_tots_sat", rateCents: 5500, startDate: "2026-09-05", active: true, size: "Child XS", age: 4 },
    { id: "s_kai", name: "Kai Nguyen", familyId: "fam_nguyen", classId: "c_contemp_sat", rateCents: 8000, startDate: "2026-09-05", active: true, size: "Adult S", age: 14 },
    { id: "s_bella", name: "Bella Rossi", familyId: "fam_rossi", classId: "c_ballet_mon", rateCents: 9000, startDate: "2026-09-01", active: true, size: "Child S", age: 9 },
    { id: "s_zoe", name: "Zoe Rossi", familyId: "fam_rossi", classId: "c_jazz_wed", rateCents: 6000, startDate: "2026-09-01", active: true, size: "Child L", age: 13 },
  ];
  // October attendance history for every class meeting up to yesterday
  const attendance: Attendance[] = []; let a = 0;
  const end = new Date(); end.setHours(0, 0, 0, 0);
  for (let d = new Date(end.getFullYear(), end.getMonth(), 1); d < end; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const k of classes.filter(c => c.day === DAYS[d.getDay()]))
      students.filter(s => s.classId === k.id).forEach((s, i) => { if (!(s.id === "s_dev" && d.getDate() % 2 === 0) || i < 0) attendance.push({ id: `a${++a}`, studentId: s.id, classId: k.id, date: iso }); });
  }
  const ym = today().slice(0, 7);
  return {
    version: SEED_VERSION,
    studio: "Blue Ocean Dance Studio",
    families: [
      { id: "fam_lopez", name: "Lopez", parentName: "Ana Lopez", phone: "(555) 201 4410", email: "ana.lopez@example.com", cardLast4: "1881" },
      { id: "fam_chen", name: "Chen", parentName: "Li Chen", phone: "(555) 201 7734", email: "li.chen@example.com", cardLast4: "4242" },
      { id: "fam_patel", name: "Patel", parentName: "Raj Patel", phone: "(555) 318 0092", email: "raj.patel@example.com", cardLast4: "5100" },
      { id: "fam_johnson", name: "Johnson", parentName: "Keisha Johnson", phone: "(555) 442 1187", email: "keisha.j@example.com", cardLast4: "0005" },
      { id: "fam_nguyen", name: "Nguyen", parentName: "Thao Nguyen", phone: "(555) 610 2290", email: "thao.nguyen@example.com", cardLast4: "3220" },
      { id: "fam_rossi", name: "Rossi", parentName: "Marco Rossi", phone: "(555) 774 5531", email: "m.rossi@example.com", cardLast4: "7788" },
    ],
    classes, students,
    instructors: [
      { id: "i_sarah", name: "Sarah Kim", ratePerClassCents: 4500, backgroundCheck: "2026-03-12", checkOk: true },
      { id: "i_elena", name: "Elena Petrova", ratePerClassCents: 5500, backgroundCheck: "2025-11-02", checkOk: true },
      { id: "i_marcus", name: "Marcus Hill", ratePerClassCents: 4000, backgroundCheck: "2024-06-20", checkOk: false },
      { id: "i_tasha", name: "Tasha Brooks", ratePerClassCents: 4200, backgroundCheck: "2026-01-08", checkOk: true },
    ],
    payouts: [
      { id: "p1", instructorId: "i_sarah", month: "September", classes: 9, hours: 9, amountCents: 40500, date: "2026-10-01" },
      { id: "p2", instructorId: "i_elena", month: "September", classes: 4, hours: 6, amountCents: 22000, date: "2026-10-01" },
      { id: "p3", instructorId: "i_marcus", month: "September", classes: 4, hours: 4, amountCents: 16000, date: "2026-10-01" },
      { id: "p4", instructorId: "i_tasha", month: "September", classes: 8, hours: 9, amountCents: 33600, date: "2026-10-01" },
    ],
    ledger: [
      { id: "l1", familyId: "fam_lopez", type: "charge", amountCents: 8500, description: "September tuition", date: "2026-09-01", thread: "owner" },
      { id: "l2", familyId: "fam_lopez", type: "payment", amountCents: 8500, description: "September tuition", date: "2026-09-02", processor: "Stripe", feeCents: 277, thread: "owner" },
      { id: "l3", familyId: "fam_patel", type: "charge", amountCents: 12000, description: "September tuition", date: "2026-09-01", thread: "owner" },
      { id: "l4", familyId: "fam_johnson", type: "charge", amountCents: 14500, description: "September tuition", date: "2026-09-01", thread: "owner" },
      { id: "l5", familyId: "fam_johnson", type: "payment", amountCents: 14500, description: "September tuition", date: "2026-09-03", processor: "Stripe", feeCents: 451, thread: "owner" },
      { id: "l6", familyId: "fam_nguyen", type: "charge", amountCents: 8000, description: "September tuition", date: "2026-09-01", thread: "owner" },
      { id: "l7", familyId: "fam_nguyen", type: "payment", amountCents: 8000, description: "September tuition", date: "2026-09-04", processor: "Stripe", feeCents: 262, thread: "owner" },
      { id: "l8", familyId: "fam_rossi", type: "charge", amountCents: 15000, description: "September tuition", date: "2026-09-01", thread: "owner" },
      { id: "l9", familyId: "fam_rossi", type: "payment", amountCents: 15000, description: "September tuition", date: `${ym}-05`, processor: "Stripe", feeCents: 465, thread: "owner" },
    ],
    attendance,
    messages: [
      { id: "m1", thread: "owner", from: "system", ts: now, text: "Welcome to the Blue Ocean owner thread. Everything you run, front desk and back office, happens right here. Tap a suggestion below or type help." },
      ...["lopez", "chen", "patel", "johnson", "nguyen", "rossi"].map((f, i) => ({ id: `mp${i}`, thread: `parent:fam_${f}`, from: "system" as const, ts: now, text: "Hi! This is your Blue Ocean family thread. Ask about your balance, pay tuition, book a trial, ask a question, or cancel or switch a class." })),
    ],
    processor: { name: "Stripe", ratePct: 2.9, fixedCents: 30, external: false },
    pending: {},
    costumes: [
      { id: "co_leo", name: "Black leotard", number: "Opening Number", color: "black", priceCents: 4500, stock: { "Child XS": 2, "Child S": 3, "Child M": 1, "Child L": 2, "Adult S": 1 } },
      { id: "co_tutu", name: "Pink tutu", number: "Waltz of the Flowers", color: "pink", priceCents: 6500, stock: { "Child XS": 1, "Child S": 2, "Child M": 1, "Child L": 0, "Adult S": 0 } },
      { id: "co_jacket", name: "Silver hip hop jacket", number: "Hip Hop Party", color: "silver", priceCents: 5500, stock: { "Child XS": 0, "Child S": 1, "Child M": 2, "Child L": 1, "Adult S": 0 } },
      { id: "co_jazz", name: "Red jazz dress", number: "All That Jazz", color: "red", priceCents: 6000, stock: { "Child XS": 0, "Child S": 1, "Child M": 1, "Child L": 1, "Adult S": 1 } },
    ],
    assignments: [
      { studentId: "s_ava", costumeId: "co_tutu", size: "Child M", billed: true, paid: true },
      { studentId: "s_bella", costumeId: "co_tutu", size: "Child S", billed: false, paid: false },
      { studentId: "s_dev", costumeId: "co_jacket", size: "Child S", billed: false, paid: false },
      { studentId: "s_priya", costumeId: "co_jazz", size: "Child L", billed: false, paid: false },
      { studentId: "s_zoe", costumeId: "co_jazz", size: "Child L", billed: false, paid: false },
    ],
    merch: [
      { id: "mx_hoodie", name: "Studio hoodie", priceCents: 4500, stock: 18, sold: 7 },
      { id: "mx_tee", name: "Logo tee", priceCents: 2200, stock: 31, sold: 14 },
      { id: "mx_bag", name: "Dance bag", priceCents: 3500, stock: 4, sold: 9 },
      { id: "mx_bottle", name: "Water bottle", priceCents: 1500, stock: 22, sold: 11 },
      { id: "mx_leotard", name: "Black leotard", priceCents: 2800, stock: 11, sold: 6, sizes: { "Child XS": 2, "Child S": 4, "Child M": 3, "Child L": 0, "Adult S": 2 } },
      { id: "mx_tights", name: "Pink tights", priceCents: 1200, stock: 17, sold: 10, sizes: { "Child S": 6, "Child M": 5, "Child L": 4, "Adult S": 2 } },
      { id: "mx_slippers", name: "Pink ballet slippers", priceCents: 2400, stock: 7, sold: 5, sizes: { "Child 10": 2, "Child 12": 3, "Child 1": 2 } },
      { id: "mx_scrunchie", name: "Recital scrunchie", priceCents: 800, stock: 0, sold: 25 },
    ],
    sales: [],
    recital: {
      name: "Spring Showcase", date: "2027-05-15", venue: "Riverside Theater", seats: 320, ticketCents: 2000, sold: 186, ticketSales: [],
      order: [
        { number: "Opening Number", studentIds: ["s_ava", "s_kai", "s_zoe"], costumeId: "co_leo" },
        { number: "Tiny Tots Teddy Bear Picnic", classId: "c_tots_sat", studentIds: ["s_lily"] },
        { number: "Waltz of the Flowers", classId: "c_ballet_mon", studentIds: ["s_ava", "s_bella"], costumeId: "co_tutu" },
        { number: "Hip Hop Party", classId: "c_hh_tue", studentIds: ["s_dev"], costumeId: "co_jacket" },
        { number: "All That Jazz", classId: "c_jazz_wed", studentIds: ["s_priya", "s_zoe"], costumeId: "co_jazz" },
        { number: "Contemporary Solo", classId: "c_contemp_sat", studentIds: ["s_kai"] },
      ],
      vendors: [
        { name: "Riverside Theater", role: "Venue", status: "booked", costCents: 180000, due: "2027-04-01" },
        { name: "Flash Studio", role: "Photographer", status: "booked", costCents: 60000, due: "2027-05-01" },
        { name: "Reel Moments", role: "Videographer", status: "pending", costCents: 75000, due: "2027-03-15" },
        { name: "Bloom and Stem", role: "Florist", status: "pending", costCents: 25000, due: "2027-05-08" },
        { name: "PrintCo", role: "Programs", status: "pending", costCents: 18000, due: "2027-05-01" },
        { name: "Stage Sound Pros", role: "Sound and lights", status: "booked", costCents: 90000, due: "2027-04-15" },
      ],
    },
    waivers: [
      { id: "w_liability", name: "Liability release", required: true },
      { id: "w_photo", name: "Photo release", required: true },
      { id: "w_medical", name: "Medical info form", required: true },
    ],
    signatures: [
      ...["fam_lopez", "fam_chen", "fam_patel", "fam_johnson", "fam_nguyen", "fam_rossi"].map(f => ({ familyId: f, waiverId: "w_liability", date: "2026-08-28" })),
      ...["fam_lopez", "fam_johnson", "fam_nguyen"].map(f => ({ familyId: f, waiverId: "w_photo", date: "2026-09-02" })),
      ...["fam_lopez", "fam_patel", "fam_johnson", "fam_rossi"].map(f => ({ familyId: f, waiverId: "w_medical", date: "2026-09-02" })),
    ],
    requests: [],
    cancellations: [],
    seq: 1000,
  };
}
