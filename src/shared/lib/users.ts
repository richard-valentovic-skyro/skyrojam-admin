/* Student accounts and their credit.

   No backend yet: this is fixture data, and the admin screen mutates a copy
   in React state. When the API lands, replace these exports with fetches —
   every screen reads accounts and ledger through this module and nothing
   else, so it is the only seam that has to change. */

import { LUNCH_PRICE } from "./pricing";

export type Student = {
  id: string;
  name: string;
  email: string;
  /** Slovak school class, e.g. "3.A". */
  trieda: string;
  balance: number;
  active: boolean;
  /** When the account was created. */
  created: string;
};

/** Who is signed in on the student app. */
export const CURRENT_STUDENT_ID = "s1";

export const STUDENTS: Student[] = [
  { id: "s1", name: "Matej Hrušovský", email: "matej.hrusovsky@skyro.ai", trieda: "3.A", balance: 47.5, active: true, created: "1. sep 2026" },
  { id: "s2", name: "Nina Bartošová", email: "nina.bartosova@skyro.ai", trieda: "3.A", balance: 112, active: true, created: "1. sep 2026" },
  { id: "s3", name: "Tomáš Ondrejka", email: "tomas.ondrejka@skyro.ai", trieda: "2.B", balance: 5.5, active: true, created: "1. sep 2026" },
  { id: "s4", name: "Adam Šimko", email: "adam.simko@skyro.ai", trieda: "2.B", balance: 2, active: true, created: "3. sep 2026" },
  { id: "s5", name: "Zuzana Kráľová", email: "zuzana.kralova@skyro.ai", trieda: "1.A", balance: 88.5, active: true, created: "1. sep 2026" },
  { id: "s6", name: "Lenka Michalcová", email: "lenka.michalcova@skyro.ai", trieda: "1.A", balance: 0, active: true, created: "8. sep 2026" },
  { id: "s7", name: "Peter Kollár", email: "peter.kollar@skyro.ai", trieda: "4.A", balance: 33, active: true, created: "1. sep 2026" },
  { id: "s8", name: "Sofia Danišová", email: "sofia.danisova@skyro.ai", trieda: "4.A", balance: 61, active: false, created: "1. sep 2026" },
];

export type LedgerEntry = {
  id: string;
  studentId: string;
  /** Positive amounts are credit added, negative are lunches charged. */
  amount: number;
  label: string;
  at: string;
  /** Who credited it. Absent on charges. */
  by?: string;
};

export const LEDGER: LedgerEntry[] = [
  { id: "l1", studentId: "s1", amount: -LUNCH_PRICE, label: "Obed 1, Bryndzové halušky", at: "dnes 9:02" },
  { id: "l2", studentId: "s1", amount: -LUNCH_PRICE, label: "Obed 3, Kuracie prsia", at: "včera 8:58" },
  { id: "l3", studentId: "s1", amount: 50, label: "Dobitie kreditu", at: "11. sep 8:40", by: "Katarína Vrábľová" },
  { id: "l4", studentId: "s1", amount: -LUNCH_PRICE, label: "Obed 2, Vyprážaný rezeň", at: "11. sep 8:12" },
  { id: "l5", studentId: "s1", amount: -LUNCH_PRICE, label: "Obed 9, Caesar šalát", at: "9. sep 8:30" },
  { id: "l6", studentId: "s2", amount: 100, label: "Dobitie kreditu", at: "10. sep 11:20", by: "Katarína Vrábľová" },
  { id: "l7", studentId: "s4", amount: 20, label: "Dobitie kreditu", at: "5. sep 7:55", by: "Katarína Vrábľová" },
  { id: "l8", studentId: "s5", amount: 100, label: "Dobitie kreditu", at: "2. sep 9:10", by: "Katarína Vrábľová" },
  { id: "l9", studentId: "s3", amount: 30, label: "Dobitie kreditu", at: "1. sep 8:05", by: "Katarína Vrábľová" },
];

/** Email the school issues for a new account. Strips Slovak diacritics. */
export function schoolEmail(name: string): string {
  const plain = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".");
  return plain ? `${plain}@skyro.ai` : "";
}
