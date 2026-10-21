"use client";
import type { DB, Family } from "./types";
import { balance, money, fmtDate, catFor } from "./engine";
import { today } from "./clock";
import { BILLING } from "./policy";

async function doc() { const { jsPDF } = await import("jspdf"); return new jsPDF({ unit: "pt", format: "letter" }); }
function page(pdf: any, db: DB, f: Family, invoice: boolean) {
  const W = 612; let y = 56;
  pdf.setFillColor(30, 26, 22); pdf.rect(0, 0, W, 84, "F"); pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(18); pdf.text("Blue Ocean Dance Studio", 40, 44);
  pdf.setFontSize(10); pdf.setFont("helvetica", "normal"); pdf.text(invoice ? "INVOICE" : "STATEMENT", W - 40, 44, { align: "right" }); pdf.text(`Date ${fmtDate(today())}`, W - 40, 60, { align: "right" });
  y = 116; pdf.setTextColor(30); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.text(`${f.name} family`, 40, y); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  pdf.text([f.parentName, f.email, f.phone], 40, y + 16);
  const bal = balance(db, f.id); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.text(`Balance due ${money(Math.max(0, bal))}`, W - 40, y, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text(`Due on day ${BILLING.dueDay} · late fee ${money(BILLING.lateFeeCents)} after ${BILLING.graceDays} days`, W - 40, y + 16, { align: "right" });
  y += 66; pdf.setFillColor(246, 242, 234); pdf.rect(40, y - 12, W - 80, 20, "F"); pdf.setFont("helvetica", "bold");
  pdf.text("Date", 46, y + 2); pdf.text("Category", 120, y + 2); pdf.text("Description", 210, y + 2); pdf.text("Amount", W - 46, y + 2, { align: "right" }); pdf.setFont("helvetica", "normal"); y += 22;
  let lines = db.ledger.filter(l => l.familyId === f.id);
  if (invoice) { const lastPay = [...lines].reverse().find(l => l.type === "payment"); lines = lines.filter(l => l.type !== "payment" && (!lastPay || l.date >= lastPay.date)); }
  for (const l of lines) {
    if (y > 720) { pdf.addPage(); y = 60; }
    const cat = l.type === "payment" ? "Payment" : l.category ?? (l.type === "credit" ? "Credit" : catFor(l.description));
    pdf.text(fmtDate(l.date), 46, y); pdf.text(cat, 120, y); pdf.text(pdf.splitTextToSize(l.description, 280)[0], 210, y); pdf.text(`${l.type === "charge" ? "" : "minus "}${money(l.amountCents)}`, W - 46, y, { align: "right" });
    pdf.setDrawColor(235); pdf.line(40, y + 6, W - 40, y + 6); y += 18;
  }
  y += 10; pdf.setFont("helvetica", "bold"); pdf.text(invoice ? "Amount due" : "Ending balance", W - 160, y); pdf.text(money(bal), W - 46, y, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(120); pdf.text("Pay in your family chat thread. Demo document, payments are simulated.", 40, 760);
}
export async function downloadPdf(db: DB, which: string) {
  const [kind, id] = which.split(":"); const pdf = await doc();
  const fams = id === "all" ? db.families : id === "balance" ? db.families.filter(f => balance(db, f.id) > 0) : db.families.filter(f => f.id === id);
  fams.forEach((f, i) => { if (i) pdf.addPage(); page(pdf, db, f, kind === "invoice"); });
  const name = fams.length === 1 ? `${kind === "invoice" ? "Invoice" : "Statement"} ${fams[0].name} ${today()}.pdf` : `Statements ${today()}.pdf`;
  pdf.save(name); return { name, pages: pdf.getNumberOfPages(), families: fams.length };
}
