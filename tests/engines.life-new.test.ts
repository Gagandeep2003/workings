import { describe, it, expect } from "vitest";
import { engines as time } from "@/engines/everyday/time";
import { engines as planning } from "@/engines/money/planning";
import { engines as overtime } from "@/engines/career/overtime";
import { engines as convert } from "@/engines/everyday/convert";
import { errs, out, primary, run, sec } from "./util";

describe("time duration", () => {
  const dur = (v: Record<string, string | number>) => run(time, "time-duration-calculator", v);
  it("between two clock times, with a break", () => {
    const r = dur({ mode: "between", start: "09:00", end: "17:45", break_min: 30 });
    expect(primary(r)).toBe("8 h 15 min"); // 8 h 45 min − 30 min
    expect(sec(r, "In decimal hours")).toBe(8.25);
    expect(sec(r, "In minutes")).toBe(495);
    expect(sec(r, "Before the break")).toBe("8 h 45 min");
  });
  it("treats an earlier end as the next day", () => {
    const r = dur({ mode: "between", start: "22:00", end: "06:00" });
    expect(primary(r)).toBe("8 h 00 min");
    expect(sec(r, "Crosses midnight")).toMatch(/Yes/);
    expect(primary(dur({ mode: "between", start: "09:00", end: "09:00" }))).toBe("0 h 00 min");
  });
  it("validates times and breaks", () => {
    expect(errs(dur({ mode: "between", start: "25:00", end: "10:00" }))).toMatch(/start time/);
    expect(errs(dur({ mode: "between", start: "09:00", end: "9am" }))).toMatch(/end time/);
    expect(errs(dur({ mode: "between", start: "09:00", end: "10:00", break_min: 90 }))).toMatch(/longer than the time between/);
  });
  it("adds and subtracts durations across midnight", () => {
    const add = dur({ mode: "add", time: "22:30", op: "add", add_hours: 3, add_minutes: 45 });
    expect(primary(add)).toBe("02:15  (2:15 AM)");
    expect(sec(add, "Day")).toBe("next day");
    expect(primary(dur({ mode: "add", time: "01:00", op: "subtract", add_hours: 2, add_minutes: 0 }))).toBe("23:00  (11:00 PM)");
    expect(sec(dur({ mode: "add", time: "01:00", op: "subtract", add_hours: 2, add_minutes: 0 }), "Day")).toBe("previous day");
    const day = dur({ mode: "add", time: "10:00", op: "add", add_hours: 30, add_minutes: 0 });
    expect(primary(day)).toBe("16:00  (4:00 PM)");
    expect(sec(day, "Day")).toBe("next day");
    expect(sec(dur({ mode: "add", time: "10:00", op: "add", add_hours: 60, add_minutes: 0 }), "Day")).toBe("2 days later");
    expect(primary(dur({ mode: "add", time: "00:00", op: "add", add_hours: 12, add_minutes: 0 }))).toBe("12:00  (12:00 PM)");
    expect(primary(dur({ mode: "add", time: "12:30", op: "add", add_hours: 0, add_minutes: 0 }))).toBe("12:30  (12:30 PM)");
  });
});

describe("pace calculator", () => {
  const pace = (v: Record<string, string | number>) => run(time, "pace-calculator", v);
  it("pace from distance and time", () => {
    const r = pace({ solve: "pace", distance: 10, dist_unit: "km", hours: 0, minutes: 50, seconds: 0 });
    expect(sec(r, "Pace per km")).toBe("5:00");
    expect(sec(r, "Pace per mile")).toBe("8:03"); // 300 s × 1.609344 = 482.8 s
    expect(String(sec(r, "Speed"))).toMatch(/^12 km\/h  ·  7\.456\d? mph$/);
    expect(primary(r)).toBe("5:00 per km  ·  8:03 per mile");
  });
  it("finish time from distance and pace, in km or miles", () => {
    expect(primary(pace({ solve: "time", distance: 5, dist_unit: "km", pace_min: 5, pace_sec: 30, pace_unit: "km" }))).toBe("27:30");
    expect(primary(pace({ solve: "time", distance: 10, dist_unit: "mi", pace_min: 8, pace_sec: 0, pace_unit: "mi" }))).toBe("1:20:00");
    const mixed = pace({ solve: "time", distance: 10, dist_unit: "km", pace_min: 8, pace_sec: 0, pace_unit: "mi" }); // 8:00/mile for 10 km
    expect(primary(mixed)).toBe("49:43"); // 480 s × (10 ÷ 1.609344) = 2982.6 s = 49 min 42.6 s, rounded to the nearest second
  });
  it("distance from time and pace", () => {
    const r = pace({ solve: "distance", hours: 0, minutes: 50, seconds: 0, pace_min: 5, pace_sec: 0, pace_unit: "km" });
    expect(primary(r)).toBe(10);
    expect(JSON.stringify(out(r).primary.value)).toContain("km");
  });
  it("race table at a constant pace", () => {
    const rows = out(pace({ solve: "pace", distance: 10, dist_unit: "km", hours: 0, minutes: 50, seconds: 0 })).table!.rows;
    const at = (label: string) => rows.find((x) => String(x[0]).startsWith(label))![1];
    expect(at("5 km")).toBe("25:00");
    expect(at("10 km")).toBe("50:00");
    expect(at("Half marathon")).toBe("1:45:29"); // 300 × 21.0975 = 6329.25 s
    expect(at("Marathon")).toBe("3:30:59"); // 300 × 42.195 = 12658.5 s → rounds to 12659
    expect(at("1 mile")).toBe("8:03");
  });
  it("validates", () => {
    expect(errs(pace({ solve: "pace", distance: 0, dist_unit: "km", hours: 0, minutes: 50, seconds: 0 }))).toMatch(/distance greater than zero/);
    expect(errs(pace({ solve: "pace", distance: 5, dist_unit: "km", hours: 0, minutes: 0, seconds: 0 }))).toMatch(/time greater than zero/);
    expect(errs(pace({ solve: "time", distance: 5, dist_unit: "km", pace_min: 0, pace_sec: 0, pace_unit: "km" }))).toMatch(/pace greater than zero/);
  });
});

describe("data storage converter", () => {
  const c = (value: number, from: string, to: string) => run(convert, "data-storage-converter", { value, from, to });
  it("keeps decimal and binary units apart", () => {
    expect(primary(c(1, "TB", "GiB")) as number).toBeCloseTo(1e12 / 2 ** 30, 6); // 931.3226
    expect(primary(c(1, "GB", "MB"))).toBe(1000);
    expect(primary(c(1, "GiB", "MiB"))).toBe(1024);
    expect(primary(c(1, "B", "bit"))).toBe(8);
    expect(primary(c(1, "MiB", "KiB"))).toBe(1024);
    expect(primary(c(2048, "MB", "GB"))).toBe(2.048);
  });
});

describe("lumpsum calculator", () => {
  const lump = (v: Record<string, string | number>) => run(planning, "lumpsum-calculator", { principal: 100000, rate: 12, years: 10, compounding: "annually", currency: "INR", ...v });
  it("future value = P(1 + r/n)^(nt)", () => {
    expect(primary(lump({}))).toBeCloseTo(100000 * 1.12 ** 10, 2); // 310,584.82
    expect(primary(lump({ years: 1, compounding: "monthly" }))).toBeCloseTo(100000 * 1.01 ** 12, 2); // 112,682.50
    expect(primary(lump({ years: 2, compounding: "quarterly", rate: 8 }))).toBeCloseTo(100000 * 1.02 ** 8, 2);
    expect(primary(lump({ years: 0.5, compounding: "half", rate: 10 }))).toBeCloseTo(100000 * 1.05, 2);
  });
  it("derived figures", () => {
    const r = lump({ inflation: 6 });
    expect(sec(r, "Estimated gain")).toBeCloseTo(100000 * 1.12 ** 10 - 100000, 2);
    expect(sec(r, "Effective annual return")).toBe(12);
    expect(sec(lump({ compounding: "monthly" }), "Effective annual return")).toBeCloseTo((1.01 ** 12 - 1) * 100, 3);
    expect(sec(r, "Time to double at this rate")).toBe("about 6.1 years"); // ln 2 ÷ ln 1.12 = 6.116
    expect(sec(r, "Value in today's money (6% inflation)")).toBeCloseTo((100000 * 1.12 ** 10) / 1.06 ** 10, 2);
    expect(out(r).table!.rows).toHaveLength(10);
  });
  it("zero return keeps the principal and omits a doubling time", () => {
    const r = lump({ rate: 0 });
    expect(primary(r)).toBe(100000);
    expect(out(r).secondary!.some((s) => s.label.startsWith("Time to double"))).toBe(false);
  });
  it("validates", () => {
    expect(errs(lump({ principal: 0 }))).toMatch(/greater than zero/);
    expect(errs(lump({ years: 100, rate: 100, compounding: "monthly" }))).toMatch(/too large/);
  });
});

/** Independent reference: a plain floating-point reducing-balance loan. */
function simulate(P: number, annual: number, months: number, after: number, prepay: number) {
  const i = annual / 1200;
  const emi = Math.round((P * i * (1 + i) ** months) / ((1 + i) ** months - 1) * 100) / 100;
  let bal = P, interest = 0, paid = 0;
  const run_ = (target: number | null) => { for (; bal > 0.005 && (target === null || paid < target); paid++) { const int = bal * i; interest += int; bal = Math.max(0, bal + int - emi); } };
  run_(after);
  const interestSoFar = interest, balAtPrepay = bal;
  bal -= prepay;
  run_(null);
  const baseInterest = emi * months - P;
  return { emi, balAtPrepay, interestSaved: baseInterest - interest, months: paid, interestSoFar };
}

describe("loan prepayment", () => {
  const tenure = 20;
  const prep = (v: Record<string, string | number> = {}) => run(planning, "loan-prepayment-calculator", { principal: 3000000, rate: 8.5, tenure, tenureUnit: "years", prepayment: 300000, after: 24, effect: "tenure", currency: "INR", ...v });
  const monthsOf = (t: string) => { const y = /(\d+) year/.exec(t), m = /(\d+) month/.exec(t); return (y ? Number(y[1]) * 12 : 0) + (m ? Number(m[1]) : 0); };
  it("interest saved and new tenure match an independent simulation", () => {
    const ref = simulate(3000000, 8.5, 240, 24, 300000);
    const r = prep();
    expect(primary(r) as number).toBeGreaterThan(0);
    expect(Math.abs((primary(r) as number) - ref.interestSaved)).toBeLessThan(25); // a few rupees of rounding between methods
    expect(Math.abs(monthsOf(String(sec(r, "New loan tenure"))) - ref.months)).toBeLessThanOrEqual(1);
    expect(Math.abs((sec(r, "Outstanding principal before prepaying") as number) - ref.balAtPrepay)).toBeLessThan(5);
    expect(Math.abs((sec(r, "Original EMI") as number) - ref.emi)).toBeLessThan(0.02);
  });
  it("keeping the tenure lowers the EMI instead", () => {
    const r = prep({ effect: "emi" });
    const ref = simulate(3000000, 8.5, 240, 24, 300000);
    const i = 8.5 / 1200, n = 216, newBal = ref.balAtPrepay - 300000;
    const expectedEmi = (newBal * i * (1 + i) ** n) / ((1 + i) ** n - 1);
    expect(Math.abs((sec(r, "New EMI") as number) - expectedEmi)).toBeLessThan(1);
    expect(sec(r, "EMI reduction") as number).toBeGreaterThan(0);
    expect(primary(r) as number).toBeGreaterThan(0);
    expect(primary(prep({ effect: "emi" })) as number).toBeLessThan(primary(prep()) as number); // shortening saves more interest than lowering the EMI
  });
  it("paying earlier saves more", () => {
    expect(primary(prep({ after: 6 })) as number).toBeGreaterThan(primary(prep({ after: 60 })) as number);
  });
  it("a bigger prepayment saves more, and the full balance closes the loan", () => {
    expect(primary(prep({ prepayment: 600000 })) as number).toBeGreaterThan(primary(prep()) as number);
    const ref = simulate(3000000, 8.5, 240, 24, 0);
    const closed = prep({ prepayment: Math.floor(ref.balAtPrepay) });
    expect(sec(closed, "Outstanding principal after prepaying") as number).toBeLessThan(2);
  });
  it("validates", () => {
    expect(errs(prep({ prepayment: 9e9 }))).toMatch(/more than clear the loan/);
    expect(errs(prep({ after: 240 }))).toMatch(/whole number from 0 to 239/);
    expect(errs(prep({ after: 1.5 }))).toMatch(/whole number/);
    expect(errs(prep({ prepayment: 0 }))).toMatch(/greater than zero/);
  });
});

describe("loan affordability", () => {
  const aff = (v: Record<string, string | number> = {}) => run(planning, "loan-affordability-calculator", { income: 100000, existing: 10000, share: 40, rate: 8.5, tenure: 20, tenureUnit: "years", currency: "INR", ...v });
  const pv = (emi: number, annual: number, n: number) => { const i = annual / 1200; return i === 0 ? emi * n : (emi * (1 - (1 + i) ** -n)) / i; };
  it("maximum loan = present value of the affordable EMI", () => {
    const r = aff();
    expect(sec(r, "Affordable new EMI")).toBe(30000); // 40% × 100,000 − 10,000
    expect(primary(r) as number).toBeCloseTo(pv(30000, 8.5, 240), 1); // ≈ 34,56,6xx
    expect(sec(r, "Total repayable over the tenure")).toBe(30000 * 240);
    expect(sec(r, "Total interest") as number).toBeCloseTo(30000 * 240 - pv(30000, 8.5, 240), 1);
    expect(out(r).table!.rows[0][0]).toBe("5 years");
  });
  it("zero interest and other tenures", () => {
    expect(primary(aff({ rate: 0 }))).toBe(30000 * 240);
    expect(primary(aff({ tenure: 60, tenureUnit: "months" })) as number).toBeCloseTo(pv(30000, 8.5, 60), 1);
    expect((primary(aff({ tenure: 30 })) as number)).toBeGreaterThan(primary(aff({ tenure: 10 })) as number);
  });
  it("explains when there is no room", () => {
    expect(errs(aff({ existing: 40000 }))).toMatch(/no room for a new EMI/);
    expect(errs(aff({ existing: 50000 }))).toMatch(/no room/);
    expect(errs(aff({ income: 0 }))).toMatch(/greater than zero/);
  });
});

describe("overtime pay", () => {
  const ot = (v: Record<string, string | number>) => run(overtime, "overtime-pay-calculator", { currency: "INR", ...v });
  it("monthly salary basis", () => {
    const r = ot({ basis: "monthly", monthly_salary: 30000, days: 26, hours_per_day: 8, overtime_hours: 10, multiplier: 2 });
    expect(sec(r, "Normal hourly rate")).toBe(144.23); // 30,000 ÷ 208
    expect(primary(r)).toBe(2884.62); // 144.2308 × 2 × 10
    expect(sec(r, "Overtime rate per hour")).toBe(288.46);
    expect(sec(r, "Normal pay plus overtime")).toBe(32884.62);
    expect(sec(r, "Extra earned compared with normal pay for those hours")).toBe(1442.31);
  });
  it("hourly basis", () => {
    const r = ot({ basis: "hourly", hourly_rate: 250, overtime_hours: 10, multiplier: 1.5, regular_hours: 160 });
    expect(primary(r)).toBe(3750);
    expect(sec(r, "Normal pay plus overtime")).toBe(43750);
    expect(out(ot({ basis: "hourly", hourly_rate: 250, overtime_hours: 10, multiplier: 1.5 })).secondary!.some((s) => s.label === "Normal pay plus overtime")).toBe(false);
  });
  it("zero overtime and bad multipliers", () => {
    expect(primary(ot({ basis: "hourly", hourly_rate: 250, overtime_hours: 0, multiplier: 2 }))).toBe(0);
    expect(errs(ot({ basis: "hourly", hourly_rate: 250, overtime_hours: 5, multiplier: 0.5 }))).toMatch(/can't be below 1/);
  });
});
