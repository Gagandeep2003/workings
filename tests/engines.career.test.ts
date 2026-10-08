import { describe, it, expect } from "vitest";
import { engines as salary } from "@/engines/career/salary";
import { engines as time } from "@/engines/career/time";
import { engines as ctcEngines, incomeTaxNewRegime, slabTax } from "@/engines/career/ctc";
import { makeContext } from "@/engines/helpers";
import { errs, out, primary, run, sec } from "./util";

const today = (d: string) => makeContext({ today: d });

describe("salary tools", () => {
  it("salary increment", () => {
    const r = run(salary, "salary-increment-calculator", { salary: 600000, period: "annual", pct: 10, years: 2, currency: "" });
    expect(primary(r)).toBe(660000);
    expect(sec(r, "New monthly salary")).toBe(55000);
    expect(out(r).table?.rows).toHaveLength(2);
    expect(primary(run(salary, "salary-increment-calculator", { salary: 50000, period: "monthly", pct: 8, currency: "" }))).toBe(54000);
    expect(sec(run(salary, "salary-increment-calculator", { salary: 50000, period: "monthly", pct: 8, currency: "" }), "New annual salary")).toBe(648000);
    expect(primary(run(salary, "salary-increment-calculator", { salary: 50000, period: "monthly", pct: 0, currency: "" }))).toBe(50000);
    expect(primary(run(salary, "salary-increment-calculator", { salary: 33333.33, period: "annual", pct: 7.5, currency: "" }))).toBe(35833.33);
  });
  it("salary hike percentage", () => {
    expect(primary(run(salary, "salary-hike-percentage-calculator", { old: 500000, new: 575000, currency: "" }))).toBe(15);
    const cut = run(salary, "salary-hike-percentage-calculator", { old: 500000, new: 450000, currency: "" });
    expect(primary(cut)).toBe(10);
    expect(sec(cut, "Result")).toBe("Reduction");
    expect(errs(run(salary, "salary-hike-percentage-calculator", { old: 0, new: 1, currency: "" }))).toMatch(/can't be zero/);
  });
  it("salary comparison", () => {
    const r = run(salary, "salary-comparison-calculator", { period: "annual", abase: 1200000, abonus: 100000, bbase: 1100000, bbonus: 250000, currency: "" });
    expect(primary(r)).toBe(50000);
    expect(out(r).primary.label).toBe("Offer B pays more");
    expect(sec(r, "Per month")).toBeCloseTo(4166.67, 2);
    const monthly = run(salary, "salary-comparison-calculator", { period: "monthly", abase: 100000, bbase: 90000, bother: 10000, currency: "" });
    expect(out(monthly).primary.label).toBe("The offers are equal");
    expect(out(run(salary, "salary-comparison-calculator", { period: "annual", abase: 5, bbase: 4, currency: "" })).primary.label).toBe("Offer A pays more");
  });
  it("hourly to salary", () => {
    expect(primary(run(salary, "hourly-to-salary-calculator", { mode: "hourly", rate: 25, hours: 40, weeks: 52, currency: "" }))).toBe(52000);
    expect(primary(run(salary, "hourly-to-salary-calculator", { mode: "annual", annual: 104000, hours: 40, weeks: 52, currency: "" }))).toBe(50);
    expect(primary(run(salary, "hourly-to-salary-calculator", { mode: "hourly", rate: 25, hours: 40, weeks: 52, off: 2, currency: "" }))).toBe(50000);
    expect(sec(run(salary, "hourly-to-salary-calculator", { mode: "hourly", rate: 20, hours: 40, weeks: 52, currency: "" }), "Weekly")).toBe(800);
    expect(errs(run(salary, "hourly-to-salary-calculator", { mode: "hourly", rate: 20, hours: 200, weeks: 52, currency: "" }))).toMatch(/168/);
    expect(errs(run(salary, "hourly-to-salary-calculator", { mode: "hourly", rate: 20, hours: 40, weeks: 4, off: 4, currency: "" }))).toMatch(/fewer than/);
  });
});

describe("experience, notice and leave", () => {
  it("experience counts inclusive days and merges overlaps", () => {
    const one = run(time, "experience-calculator", { periods: "Acme: 2019-06-03 to 2022-03-31" }, today("2026-01-01"));
    expect(primary(one)).toBe(JSON.stringify({ years: 2, months: 9, days: 29 }));
    const merged = run(time, "experience-calculator", { periods: "2020-01-01 to 2020-12-31\n2020-06-01 to 2021-06-30" });
    expect(primary(merged)).toBe(JSON.stringify({ years: 1, months: 6, days: 0 }));
    expect(out(merged).notes?.join(" ")).toMatch(/Overlapping periods are counted once/);
    const current = run(time, "experience-calculator", { periods: "2021-01-01 - present" }, today("2026-01-01"));
    expect(primary(current)).toBe(JSON.stringify({ years: 5, months: 0, days: 1 }));
    const gap = run(time, "experience-calculator", { periods: "2020-01-01 to 2020-12-31\n2021-02-01 to 2021-12-31" });
    expect(sec(gap, "Gaps between jobs")).toBe(31);
    expect(primary(run(time, "experience-calculator", { periods: "2020-01-01 to 2020-06-30\n2020-07-01 to 2020-12-31" }))).toBe(JSON.stringify({ years: 1, months: 0, days: 0 }));
    expect(errs(run(time, "experience-calculator", { periods: "2022-01-01 to 2021-01-01" }))).toMatch(/before the start/);
    expect(errs(run(time, "experience-calculator", { periods: "2022-02-30 to 2022-03-01" }))).toMatch(/doesn't exist/);
    expect(errs(run(time, "experience-calculator", { periods: "2022-01-01" }))).toMatch(/start and an end/);
    expect(errs(run(time, "experience-calculator", { periods: "" }))).toMatch(/at least one job/);
  });
  it("notice period", () => {
    const base = { start: "2026-10-01", length: 30, unit: "days", counting: "calendar", dayOne: "after" };
    const a = run(time, "notice-period-calculator", base, today("2026-10-03"));
    expect(primary(a)).toBe("2026-10-31");
    expect(out(a).notes?.[0]).toMatch(/Saturday/);
    expect(sec(a, "From today (your device date)")).toBe("28 days to go");
    expect(primary(run(time, "notice-period-calculator", { ...base, dayOne: "same" }, today("2026-10-03")))).toBe("2026-10-30");
    expect(primary(run(time, "notice-period-calculator", { ...base, length: 2, unit: "months" }, today("2026-10-03")))).toBe("2026-12-01");
    expect(primary(run(time, "notice-period-calculator", { ...base, length: 2, unit: "months", dayOne: "same" }, today("2026-10-03")))).toBe("2026-11-30");
    expect(primary(run(time, "notice-period-calculator", { ...base, length: 2, unit: "weeks" }, today("2026-10-03")))).toBe("2026-10-15");
    const wd = { start: "2024-01-05", length: 10, unit: "days", counting: "working", dayOne: "after" };
    expect(primary(run(time, "notice-period-calculator", wd, today("2024-01-01")))).toBe("2024-01-19");
    expect(primary(run(time, "notice-period-calculator", { ...wd, length: 2, unit: "weeks" }, today("2024-01-01")))).toBe("2024-01-19");
    expect(errs(run(time, "notice-period-calculator", { ...wd, unit: "months" }, today("2024-01-01")))).toMatch(/days or weeks/);
    expect(errs(run(time, "notice-period-calculator", { ...base, length: 1.5, unit: "months" }, today("2026-10-03")))).toMatch(/whole number/);
  });
  it("leave balance", () => {
    const base = { annual: 24, startMonth: "1", asof: "2026-07-01", method: "daily", taken: 3, carry: 2 };
    const daily = run(time, "leave-calculator", base);
    expect(sec(daily, "Accrued so far this leave year")).toBe(11.97);
    expect(primary(daily)).toBe(10.97);
    const monthly = run(time, "leave-calculator", { ...base, method: "monthly" });
    expect(sec(monthly, "Accrued so far this leave year")).toBe(12);
    expect(primary(monthly)).toBe(11);
    const joined = run(time, "leave-calculator", { ...base, method: "monthly", joining: "2026-04-01", taken: 0, carry: 0 });
    expect(sec(joined, "Accrued so far this leave year")).toBe(6);
    expect(sec(joined, "Full-year entitlement (pro-rata if you joined late)")).toBe(18.08);
    const april = run(time, "leave-calculator", { ...base, startMonth: "4", asof: "2026-03-31", method: "monthly", taken: 0, carry: 0 });
    expect(sec(april, "Leave year")).toBe("2025-04-01 to 2026-03-31");
    expect(sec(april, "Accrued so far this leave year")).toBe(24);
    expect(out(run(time, "leave-calculator", { ...base, taken: 20, carry: 0 })).notes?.[0]).toMatch(/more days than/);
    expect(errs(run(time, "leave-calculator", { ...base, joining: "2026-09-01" }))).toMatch(/after the 'as of'/);
  });
});

describe("CTC to take-home (India, new regime FY 2026-27)", () => {
  const base = { basicPct: 40, pf: "ceiling", pt: 2400, currency: "" };
  it("matches an independent calculation", () => {
    const r = run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 1800000 });
    expect(primary(r)).toBe(134007.73);
    expect(sec(r, "Estimated annual take-home")).toBe(1608092.8);
    expect(sec(r, "Income tax + cess (estimated)")).toBe(146307.2);
    expect(primary(run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 1000000 }))).toBe(79533.33);
    expect(primary(run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 1275000, pt: 0 }))).toBe(102650);
    const high = run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 5000000, basicPct: 50 });
    expect(primary(high)).toBe(321778.27);
    expect(out(high).notes?.[0]).toMatch(/surcharge/i);
  });
  it("applies the rebate and marginal relief around ₹12 lakh", () => {
    const zero = run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 1231600 });
    expect(sec(zero, "Income tax + cess (estimated)")).toBe(0);
    const relief = run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 1306600 });
    expect(sec(relief, "Income tax + cess (estimated)")).toBe(10400);
  });
  it("tax helpers", () => {
    expect(slabTax(400000)).toBe(0);
    expect(slabTax(800000)).toBe(20000);
    expect(slabTax(1200000)).toBe(60000);
    expect(slabTax(2400000)).toBe(300000);
    expect(incomeTaxNewRegime(1200000).total).toBe(0);
    expect(incomeTaxNewRegime(1210000).taxBeforeCess).toBe(10000);
    expect(incomeTaxNewRegime(1500000).total).toBeCloseTo(105000 * 1.04, 6);
  });
  it("validates inputs", () => {
    expect(errs(run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 1000000, basicPct: 120 }))).toMatch(/more than 100%/);
    expect(errs(run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 1000000, benefits: 1000000 }))).toMatch(/as large as/);
    expect(errs(run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 100000, benefits: 90000, pt: 50000 }))).toMatch(/deductions are larger|nothing is left/);
    expect(sec(run(ctcEngines, "ctc-to-take-home-calculator", { ...base, ctc: 1000000, pf: "none" }), "Take-home as a share of CTC")).toBeGreaterThan(95);
  });
});
