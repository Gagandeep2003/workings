import { describe, it, expect } from "vitest";
import { engines as marks } from "@/engines/student/marks";
import { engines as grades } from "@/engines/student/grades";
import { errs, out, primary, run, sec } from "./util";

describe("marks and attendance", () => {
  it("percentage from marks", () => {
    expect(primary(run(marks, "marks-percentage-calculator", { mode: "percentage", obtained: 450, total: 500 }))).toBe(90);
    expect(primary(run(marks, "marks-percentage-calculator", { mode: "percentage", obtained: 0, total: 50 }))).toBe(0);
    expect(primary(run(marks, "marks-percentage-calculator", { mode: "percentage", obtained: 1, total: 3 }))).toBe(33.33);
    expect(errs(run(marks, "marks-percentage-calculator", { mode: "percentage", obtained: 51, total: 50 }))).toMatch(/more than the total/);
    expect(errs(run(marks, "marks-percentage-calculator", { mode: "percentage", obtained: 1, total: 0 }))).toMatch(/greater than zero/);
  });
  it("marks from percentage and several subjects", () => {
    expect(primary(run(marks, "marks-percentage-calculator", { mode: "marks", percentage: 85, total2: 600 }))).toBe(510);
    expect(errs(run(marks, "marks-percentage-calculator", { mode: "marks", percentage: 101, total2: 600 }))).toMatch(/above 100/);
    const r = run(marks, "marks-percentage-calculator", { mode: "subjects", subjects: "78/100\n85 / 100\n92 out of 100" });
    expect(primary(r)).toBe(85);
    expect(sec(r, "Total marks obtained")).toBe(255);
    expect(primary(run(marks, "marks-percentage-calculator", { mode: "subjects", subjects: "18/20\n40, 80" }))).toBe(58);
    expect(errs(run(marks, "marks-percentage-calculator", { mode: "subjects", subjects: "78/100\nabc" }))).toMatch(/Line 2/);
    expect(errs(run(marks, "marks-percentage-calculator", { mode: "subjects", subjects: "120/100" }))).toMatch(/more than the maximum/);
  });
  it("attendance percentage", () => {
    const ok75 = run(marks, "attendance-percentage-calculator", { attended: 30, total: 40, target: 75 });
    expect(primary(ok75)).toBe(75);
    expect(sec(ok75, "Against the 75% requirement")).toBe("Meets the requirement");
    expect(sec(run(marks, "attendance-percentage-calculator", { attended: 29, total: 40, target: 75 }), "Against the 75% requirement")).toBe("Short by 2.5 percentage points");
    expect(errs(run(marks, "attendance-percentage-calculator", { attended: 5, total: 4, target: 75 }))).toMatch(/more than the total/);
    expect(errs(run(marks, "attendance-percentage-calculator", { attended: 0, total: 0, target: 75 }))).toMatch(/at least 1/);
  });
  it("required attendance", () => {
    const need = run(marks, "required-attendance-calculator", { target: 75, held: 40, attended: 28 });
    expect(primary(need)).toBe(8);
    expect(sec(need, "Attendance after those classes")).toBe(75);
    expect(primary(run(marks, "required-attendance-calculator", { target: 75, held: 40, attended: 34 }))).toBe(5);
    expect(primary(run(marks, "required-attendance-calculator", { target: 100, held: 40, attended: 40 }))).toBe(0);
    expect(errs(run(marks, "required-attendance-calculator", { target: 100, held: 40, attended: 39 }))).toMatch(/can't be reached/);
    expect(out(run(marks, "required-attendance-calculator", { target: 75, held: 40, attended: 28, left: 5 })).notes?.[0]).toMatch(/isn't reachable/);
    expect(errs(run(marks, "required-attendance-calculator", { target: 75, held: 0, attended: 0 }))).toMatch(/at least 1/);
    expect(errs(run(marks, "required-attendance-calculator", { target: 0, held: 10, attended: 5 }))).toMatch(/between 0 and 100/);
  });
  it("exam score with negative marking", () => {
    const r = run(marks, "exam-score-calculator", { total: 100, correct: 60, wrong: 20, plus: 2, minus: 0.5 });
    expect(primary(r)).toBe(110);
    expect(sec(r, "Maximum marks")).toBe(200);
    expect(sec(r, "Accuracy (correct ÷ attempted)")).toBe(75);
    expect(sec(r, "Unattempted")).toBe(20);
    expect(primary(run(marks, "exam-score-calculator", { total: 10, correct: 0, wrong: 4, plus: 1, minus: 0.25 }))).toBe(-1);
    expect(out(run(marks, "exam-score-calculator", { total: 10, correct: 0, wrong: 4, plus: 1, minus: 0.25 })).notes?.[0]).toMatch(/Negative net score/);
    expect(errs(run(marks, "exam-score-calculator", { total: 10, correct: 8, wrong: 5, plus: 1, minus: 0 }))).toMatch(/more than the 10 questions/);
  });
  it("required marks", () => {
    expect(primary(run(marks, "required-marks-calculator", { target: 80, current: 75, done: 60 }))).toBe(87.5);
    expect(errs(run(marks, "required-marks-calculator", { target: 80, current: 75, done: 100 }))).toMatch(/nothing left/);
    const secured = run(marks, "required-marks-calculator", { target: 50, current: 90, done: 80 });
    expect(primary(secured)).toBe(0);
    expect(out(secured).notes?.[0]).toMatch(/already secured/);
    const impossible = run(marks, "required-marks-calculator", { target: 95, current: 70, done: 50, max: 200 });
    expect(primary(impossible)).toBe(120);
    expect(out(impossible).notes?.[0]).toMatch(/above 100%/);
    expect(sec(run(marks, "required-marks-calculator", { target: 80, current: 75, done: 60, max: 40 }), "Marks needed out of 40")).toBe(35);
  });
  it("weighted marks", () => {
    const r = run(marks, "weighted-marks-calculator", { items: "42, 50, 30\n80, 100, 70" });
    expect(primary(r)).toBe(81.2);
    expect(sec(r, "Letter grade (US 90/80/70/60 scale)")).toBe("B");
    const partial = run(marks, "weighted-marks-calculator", { items: "50 100 20\n100 100 20" });
    expect(primary(partial)).toBe(75);
    expect(out(partial).notes?.[0]).toMatch(/add up to 40%/);
    expect(errs(run(marks, "weighted-marks-calculator", { items: "42, 50" }))).toMatch(/three numbers/);
    expect(errs(run(marks, "weighted-marks-calculator", { items: "60, 50, 30" }))).toMatch(/more than the maximum/);
    expect(errs(run(marks, "weighted-marks-calculator", { items: "5, 10, 0" }))).toMatch(/add up to zero/);
  });
});

describe("grade tools", () => {
  it("CGPA from semester grades", () => {
    expect(primary(run(grades, "cgpa-calculator", { scale: "10", sgpas: "8.2 7.9 8.5 9.0", credits: "" }))).toBe(8.4);
    expect(primary(run(grades, "cgpa-calculator", { scale: "10", sgpas: "8.2, 7.9, 8.5, 9.0", credits: "20 22 24 18" }))).toBe(8.38);
    expect(primary(run(grades, "cgpa-calculator", { scale: "4", sgpas: "3.5", credits: "" }))).toBe(3.5);
    expect(errs(run(grades, "cgpa-calculator", { scale: "10", sgpas: "8 11", credits: "" }))).toMatch(/Semester 2/);
    expect(errs(run(grades, "cgpa-calculator", { scale: "10", sgpas: "8 9", credits: "20" }))).toMatch(/match one-to-one/);
    expect(errs(run(grades, "cgpa-calculator", { scale: "10", sgpas: "8 9", credits: "20 0" }))).toMatch(/greater than zero/);
  });
  it("CGPA to percentage and back", () => {
    expect(primary(run(grades, "cgpa-to-percentage-calculator", { cgpa: 8.5, method: "cbse" }))).toBe(80.75);
    expect(primary(run(grades, "cgpa-to-percentage-calculator", { cgpa: 8.5, method: "x10" }))).toBe(85);
    expect(primary(run(grades, "cgpa-to-percentage-calculator", { cgpa: 8, method: "custom", multiplier: 10, offset: 0.75 }))).toBe(72.5);
    expect(errs(run(grades, "cgpa-to-percentage-calculator", { cgpa: 11, method: "cbse" }))).toMatch(/more than 10/);
    expect(errs(run(grades, "cgpa-to-percentage-calculator", { cgpa: 8, method: "custom" }))).toMatch(/multiplier/);
    expect(out(run(grades, "cgpa-to-percentage-calculator", { cgpa: 10, method: "custom", multiplier: 12, offset: 0 })).notes?.[0]).toMatch(/above 100%/);
    expect(primary(run(grades, "percentage-to-cgpa-calculator", { percentage: 80.75, method: "cbse" }))).toBe(8.5);
    expect(primary(run(grades, "percentage-to-cgpa-calculator", { percentage: 70, method: "cbse" }))).toBe(7.37);
    expect(primary(run(grades, "percentage-to-cgpa-calculator", { percentage: 70, method: "custom", multiplier: 10, offset: 0.75 }))).toBe(7.75);
    expect(primary(run(grades, "percentage-to-cgpa-calculator", { percentage: 0, method: "x10" }))).toBe(0);
    expect(errs(run(grades, "percentage-to-cgpa-calculator", { percentage: 120, method: "x10" }))).toMatch(/more than 100/);
    expect(errs(run(grades, "percentage-to-cgpa-calculator", { percentage: 50, method: "custom", multiplier: 0 }))).toMatch(/non-zero/);
  });
  it("GPA on the 4.0 scale", () => {
    const base = { aplus: "4" };
    const r = run(grades, "gpa-calculator", { ...base, courses: "A, 3\nB, 4\nA-, 3" });
    expect(primary(r)).toBe(3.51);
    expect(sec(r, "Credits this term")).toBe(10);
    expect(primary(run(grades, "gpa-calculator", { aplus: "4.3", courses: "A+, 3\nB, 3" }))).toBe(3.65);
    expect(primary(run(grades, "gpa-calculator", { ...base, courses: "3.7 3\nc+ 3" }))).toBe(3);
    expect(sec(run(grades, "gpa-calculator", { ...base, courses: "A, 3\nB, 4\nA-, 3", priorGpa: 3.2, priorCredits: 30 }), "Cumulative GPA (with previous credits)")).toBe(3.28);
    expect(errs(run(grades, "gpa-calculator", { ...base, courses: "Z, 3" }))).toMatch(/isn't a grade/);
    expect(errs(run(grades, "gpa-calculator", { ...base, courses: "A, 0" }))).toMatch(/credits must be/);
    expect(errs(run(grades, "gpa-calculator", { ...base, courses: "5, 3" }))).toMatch(/above the maximum/);
    expect(errs(run(grades, "gpa-calculator", { ...base, courses: "A" }))).toMatch(/two parts/);
    expect(errs(run(grades, "gpa-calculator", { ...base, courses: "" }))).toMatch(/at least one course/);
  });
  it("SGPA on the 10-point scale", () => {
    expect(primary(run(grades, "sgpa-calculator", { courses: "O, 4\nA+, 3\nB, 4\n8.5, 3" }))).toBe(8.32);
    expect(primary(run(grades, "sgpa-calculator", { courses: "10 4" }))).toBe(10);
    expect(primary(run(grades, "sgpa-calculator", { courses: "F, 3\nP, 3" }))).toBe(2);
    expect(errs(run(grades, "sgpa-calculator", { courses: "11, 4" }))).toMatch(/above the maximum of 10/);
  });
});
