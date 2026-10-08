import { describe, it, expect } from "vitest";
import { engines as loans, emiMinor, buildSchedule } from "@/engines/money/loans";
import { engines as growth } from "@/engines/money/growth";
import { engines as tax } from "@/engines/money/tax";
import { errs, out, primary, run, sec } from "./util";

const loan = (extra: Record<string, number | string> = {}) => ({ principal: 1000000, rate: 8.5, tenure: 20, tenureUnit: "years", currency: "", ...extra });

describe("EMI and loans (expected values from an independent Decimal calculation)", () => {
  it("EMI", () => {
    const r = run(loans, "emi-calculator", loan());
    expect(primary(r)).toBe(8678.23);
    expect(sec(r, "Total interest")).toBe(1082775.2);
    expect(sec(r, "Total amount payable")).toBe(2082775.2);
    expect(primary(run(loans, "emi-calculator", loan({ principal: 500000, rate: 10.5, tenure: 60, tenureUnit: "months" })))).toBe(10746.95);
    expect(primary(run(loans, "emi-calculator", loan({ principal: 2500000, rate: 9, tenure: 25 })))).toBe(20979.91);
    expect(primary(run(loans, "emi-calculator", loan({ principal: 120000, rate: 0, tenure: 12, tenureUnit: "months" })))).toBe(10000);
    expect(primary(run(loans, "emi-calculator", loan({ principal: 1, rate: 12, tenure: 1, tenureUnit: "months" })))).toBe(1.01);
  });
  it("year-by-year table ends with a zero balance", () => {
    const rows = out(run(loans, "emi-calculator", loan())).table!.rows;
    expect(rows).toHaveLength(20);
    const last = rows[rows.length - 1][3] as { value: number };
    expect(last.value).toBe(0);
  });
  it("rejects impossible loans", () => {
    expect(errs(run(loans, "emi-calculator", loan({ tenure: 0.7, tenureUnit: "years" })))).toBe("tenure: " + "Tenure must work out to a whole number of months (for example 2.5 years = 30 months).");
    expect(errs(run(loans, "emi-calculator", loan({ tenure: 51 })))).toMatch(/50 years/);
    expect(errs(run(loans, "emi-calculator", loan({ principal: 0.5 })))).toMatch(/at least 1/);
  });
  it("amortization schedule with the final payment clearing the balance", () => {
    const r = run(loans, "amortization-schedule-calculator", loan({ principal: 500000, rate: 10.5, tenure: 60, tenureUnit: "months" }));
    expect(primary(r)).toBe(144816.99);
    const rows = out(r).table!.rows;
    expect(rows).toHaveLength(60);
    expect((rows[59][1] as { value: number }).value).toBe(10746.94);
    expect((rows[59][4] as { value: number }).value).toBe(0);
    const big = run(loans, "amortization-schedule-calculator", loan());
    expect(primary(big)).toBe(1082776.63);
    expect((out(big).table!.rows[239][1] as { value: number }).value).toBe(8679.66);
  });
  it("extra payments shorten the loan and save interest", () => {
    const r = run(loans, "amortization-schedule-calculator", loan({ extra: 5000 }));
    expect(primary(r)).toBe(413709.26);
    expect(sec(r, "Months to pay off")).toBe(104);
    expect(sec(r, "Interest saved by paying extra")).toBeCloseTo(1082776.63 - 413709.26, 2);
    expect(sec(r, "Time saved")).toBe("11 years 4 months earlier");
  });
  it("schedule helper conserves principal exactly", () => {
    const p = 123456789;
    const rows = buildSchedule(p, 7.3, 97, emiMinor(p, 7.3, 97));
    expect(rows.reduce((s, r) => s + r.principal, 0)).toBe(p);
    expect(rows[rows.length - 1].balance).toBe(0);
  });
  it("finds the interest rate from the payment", () => {
    const r = run(loans, "loan-interest-rate-calculator", { principal: 1000000, payment: 8678.23, tenure: 20, tenureUnit: "years" });
    expect(primary(r)).toBeCloseTo(8.5, 3);
    expect(sec(r, "Effective annual rate (with monthly compounding)")).toBeCloseTo(8.839, 2);
    expect(primary(run(loans, "loan-interest-rate-calculator", { principal: 12000, payment: 1000, tenure: 12, tenureUnit: "months" }))).toBe(0);
    expect(primary(run(loans, "loan-interest-rate-calculator", { principal: 100000, payment: 8884.88, tenure: 12, tenureUnit: "months" }))).toBeCloseTo(12, 3);
    expect(errs(run(loans, "loan-interest-rate-calculator", { principal: 12000, payment: 900, tenure: 12, tenureUnit: "months" }))).toMatch(/doesn't even repay/);
    expect(errs(run(loans, "loan-interest-rate-calculator", { principal: 10000, payment: 5000000, tenure: 12, tenureUnit: "months" }))).toMatch(/above 100%/);
  });
});

describe("interest and growth", () => {
  it("simple interest", () => {
    const si = (extra: Record<string, number | string>) => run(growth, "simple-interest-calculator", { principal: 50000, rate: 8, currency: "", ...extra });
    expect(primary(si({ time: 3, unit: "years" }))).toBe(12000);
    expect(primary(si({ time: 6, unit: "months" }))).toBe(2000);
    expect(primary(si({ time: 90, unit: "days" }))).toBe(986.3);
    expect(sec(si({ time: 3, unit: "years" }), "Total amount (principal + interest)")).toBe(62000);
    expect(primary(si({ time: 0, unit: "years" }))).toBe(0);
  });
  it("compound interest", () => {
    const ci = (extra: Record<string, number | string>) => run(growth, "compound-interest-calculator", { principal: 10000, rate: 5, years: 10, freq: "12", currency: "", ...extra });
    expect(primary(ci({}))).toBe(16470.09);
    expect(primary(ci({ freq: "1" }))).toBe(16288.95);
    expect(primary(ci({ freq: "continuous" }))).toBe(16487.21);
    expect(primary(ci({ rate: 8, years: 2.5, freq: "4" }))).toBe(12189.94);
    expect(primary(ci({ rate: 0 }))).toBe(10000);
    expect(out(ci({ freq: "1" })).table!.rows).toHaveLength(10);
    expect(out(ci({ years: 2.5 })).table!.rows).toHaveLength(3);
    expect(sec(ci({ freq: "1" }), "Effective annual rate")).toBe(5);
    expect(errs(ci({ principal: 1e12, rate: 100, years: 100, freq: "365" }))).toMatch(/too large/);
  });
  it("SIP", () => {
    const sip = (extra: Record<string, number | string>) => run(growth, "sip-calculator", { monthly: 5000, rate: 12, years: 10, timing: "start", currency: "", ...extra });
    expect(primary(sip({}))).toBe(1161695.38);
    expect(sec(sip({}), "Total invested")).toBe(600000);
    expect(primary(sip({ timing: "end" }))).toBe(1150193.45);
    const stepped = sip({ monthly: 10000, stepUp: 10 });
    expect(primary(stepped)).toBe(3374326.26);
    expect(sec(stepped, "Total invested")).toBe(1912490.95);
    expect(primary(sip({ rate: 0 }))).toBe(600000);
    expect(out(sip({})).table!.rows).toHaveLength(10);
    expect(errs(sip({ years: 0.01 }))).toMatch(/at least 1 month/);
    expect(errs(sip({ years: 60 }))).toMatch(/50 years/);
  });
  it("FD", () => {
    const fd = (extra: Record<string, number | string>) => run(growth, "fd-calculator", { principal: 100000, rate: 7, tenure: 5, tenureUnit: "years", compounding: "4", currency: "", ...extra });
    expect(primary(fd({}))).toBe(141477.82);
    expect(primary(fd({ compounding: "1" }))).toBe(140255.17);
    expect(primary(fd({ tenure: 400, tenureUnit: "days" }))).toBe(107901.53);
    expect(primary(fd({ compounding: "simple" }))).toBe(135000);
    expect(sec(fd({ compounding: "1" }), "Interest earned")).toBe(40255.17);
    expect(errs(fd({ tenure: 0 }))).toMatch(/greater than zero/);
  });
  it("RD", () => {
    const rd = (extra: Record<string, number | string>) => run(growth, "rd-calculator", { monthly: 5000, rate: 6.5, tenure: 24, tenureUnit: "months", compounding: "4", currency: "", ...extra });
    expect(primary(rd({}))).toBe(128425.3);
    expect(primary(rd({ compounding: "12" }))).toBe(128472.7);
    expect(sec(rd({}), "Total deposited")).toBe(120000);
    expect(primary(rd({ monthly: 1000, rate: 0, tenure: 1, tenureUnit: "years" }))).toBe(12000);
    expect(errs(rd({ tenure: 0.4, tenureUnit: "months" }))).toMatch(/at least 1 month/);
  });
  it("inflation", () => {
    const inf = (extra: Record<string, number | string>) => run(growth, "inflation-calculator", { currency: "", ...extra });
    expect(primary(inf({ mode: "future", amount: 100000, rate: 6, years: 10 }))).toBe(179084.77);
    expect(primary(inf({ mode: "today", amount: 100000, rate: 6, years: 10 }))).toBe(55839.48);
    expect(primary(inf({ mode: "rate", start: 100, end: 179.084769654, years: 10 }))).toBeCloseTo(6, 2);
    expect(primary(inf({ mode: "future", amount: 100, rate: 0, years: 5 }))).toBe(100);
    expect(primary(inf({ mode: "future", amount: 100, rate: -2, years: 1 }))).toBe(98);
    expect(errs(inf({ mode: "rate", start: 0, end: 1, years: 5 }))).toMatch(/greater than zero/);
  });
  it("CAGR", () => {
    expect(primary(run(growth, "cagr-calculator", { begin: 10000, end: 25000, years: 5 }))).toBe(20.1124);
    const doubling = run(growth, "cagr-calculator", { begin: 100, end: 200, years: 10 });
    expect(primary(doubling)).toBe(7.1773);
    expect(sec(doubling, "Years to double at this rate")).toBe(10);
    expect(primary(run(growth, "cagr-calculator", { begin: 100, end: 50, years: 2 }))).toBeCloseTo(-29.2893, 4);
    expect(primary(run(growth, "cagr-calculator", { begin: 100, end: 0, years: 3 }))).toBe(-100);
    expect(errs(run(growth, "cagr-calculator", { begin: 0, end: 5, years: 3 }))).toMatch(/greater than zero/);
    expect(errs(run(growth, "cagr-calculator", { begin: 5, end: 5, years: 0 }))).toMatch(/greater than zero/);
  });
});

describe("GST", () => {
  it("adds and removes GST", () => {
    const ex = run(tax, "gst-calculator", { amount: 1000, rate: 18, mode: "exclusive", currency: "" });
    expect(primary(ex)).toBe(1180);
    expect(sec(ex, "GST amount")).toBe(180);
    expect(sec(ex, "CGST (half, same-state sale)")).toBe(90);
    const inc = run(tax, "gst-calculator", { amount: 1180, rate: 18, mode: "inclusive", currency: "" });
    expect(primary(inc)).toBe(1000);
    expect(sec(inc, "GST amount")).toBe(180);
    const odd = run(tax, "gst-calculator", { amount: 1000, rate: 18, mode: "inclusive", currency: "" });
    expect(primary(odd)).toBe(847.46);
    expect(sec(odd, "GST amount")).toBe(152.54);
    expect(primary(run(tax, "gst-calculator", { amount: 1000, rate: 0, mode: "exclusive", currency: "" }))).toBe(1000);
    expect(primary(run(tax, "gst-calculator", { amount: 100, rate: 2.5, mode: "exclusive", currency: "" }))).toBe(102.5);
    expect(errs(run(tax, "gst-calculator", { amount: 100, rate: 150, mode: "exclusive", currency: "" }))).toMatch(/above 100/);
  });
});
