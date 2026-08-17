/* Shared payroll calculation helpers for the payroll page and Excel reports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PayrollCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function num(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundMoney(value) {
    return Math.round((num(value) + Number.EPSILON) * 100) / 100;
  }

  function normalizeStatus(status) {
    const value = String(status || '').trim();
    return value === 'มาครึ่งวัน' ? 'ครึ่งวัน' : value;
  }

  function dateParts(value) {
    const matched = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matched) return { year: +matched[1], month: +matched[2] - 1, day: +matched[3] };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
  }

  function isSunday(value) {
    const parts = dateParts(value);
    return !!parts && new Date(parts.year, parts.month, parts.day).getDay() === 0;
  }

  function automaticDeduction(row, dayRate, percent) {
    const recorded = num(row && row.deduction);
    // The attendance screen writes rounded deductions. Fall back to the same
    // rule for old/incomplete rows whose deduction was not persisted.
    return recorded > 0 ? recorded : Math.round(num(dayRate) * percent);
  }

  function calculateAttendancePay(employee, attendanceRows, scheduledWorkDays) {
    const rows = Array.isArray(attendanceRows) ? attendanceRows : [];
    const monthly = employee && employee.pay_type === 'รายเดือน';
    const schedule = Math.max(0, num(scheduledWorkDays));
    const salary = Math.max(0, num(employee && employee.salary));
    const dailyWage = Math.max(0, num(employee && employee.daily_wage));
    const dayRate = monthly ? (schedule ? salary / schedule : 0) : dailyWage;
    let grossBeforeDeductions = 0;
    let attendanceDeduction = 0;
    let workDays = 0;
    let countedAttendanceDays = 0;

    rows.forEach((row) => {
      const status = normalizeStatus(row && row.status);
      if (!status) return;

      if (monthly) {
        // Monthly salary is based on Monday-Saturday. Sunday attendance does
        // not increase or reduce the monthly salary.
        if (isSunday(row && row.date)) return;
        countedAttendanceDays += 1;
        grossBeforeDeductions += dayRate;

        if (status === 'ขาด') {
          attendanceDeduction += automaticDeduction(row, dayRate, 1);
        } else if (status === 'ครึ่งวัน') {
          workDays += 0.5;
          attendanceDeduction += automaticDeduction(row, dayRate, 0.5);
        } else if (status === 'มาสาย') {
          workDays += 1;
          attendanceDeduction += automaticDeduction(row, dayRate, 0.05);
        } else {
          // Paid leave is a paid day for monthly employees.
          workDays += 1;
          if (status !== 'ลา') attendanceDeduction += num(row && row.deduction);
        }
        return;
      }

      // Daily workers are paid only for worked days. Leave/absence creates no
      // daily wage, while late and half-day deductions follow attendance rules.
      if (status === 'ขาด' || status === 'ลา') return;
      countedAttendanceDays += 1;
      grossBeforeDeductions += dailyWage;
      if (status === 'ครึ่งวัน') {
        workDays += 0.5;
        attendanceDeduction += automaticDeduction(row, dailyWage, 0.5);
      } else if (status === 'มาสาย') {
        workDays += 1;
        attendanceDeduction += automaticDeduction(row, dailyWage, 0.05);
      } else {
        workDays += 1;
        attendanceDeduction += num(row && row.deduction);
      }
    });

    if (monthly) grossBeforeDeductions = Math.min(salary, grossBeforeDeductions);
    attendanceDeduction = Math.min(grossBeforeDeductions, attendanceDeduction);
    return {
      isMonthly: monthly,
      dayRate: roundMoney(dayRate),
      workDays: roundMoney(Math.min(monthly && schedule ? schedule : Number.MAX_SAFE_INTEGER, workDays)),
      attendanceDays: countedAttendanceDays,
      grossBeforeDeductions: roundMoney(grossBeforeDeductions),
      attendanceDeduction: roundMoney(attendanceDeduction),
      earn: roundMoney(Math.max(0, grossBeforeDeductions - attendanceDeduction)),
    };
  }

  function sumMatches(text, expression) {
    let total = 0;
    let match;
    expression.lastIndex = 0;
    while ((match = expression.exec(String(text || '')))) {
      total += num(String(match[1] || '').replace(/,/g, ''));
    }
    return roundMoney(total);
  }

  function parseNoteDeductions(note) {
    const result = { socialSecurity: 0, other: 0, unclassified: 0, total: 0 };
    String(note || '').split(/\s*\|\s*/).forEach((part) => {
      const markedSocial = sumMatches(part, /\[payroll_ss=([0-9,]+(?:\.\d+)?)\]/gi);
      const markedOther = sumMatches(part, /\[payroll_other=([0-9,]+(?:\.\d+)?)\]/gi);
      if (markedSocial || markedOther) {
        result.socialSecurity += markedSocial;
        result.other += markedOther;
        return;
      }

      const textSocial = sumMatches(part, /(?:หัก\s*)?ประกันสังคม\s*฿?\s*([0-9,]+(?:\.\d+)?)/gi);
      const textOther = sumMatches(part, /(?:หัก\s*)?อื่น\s*ๆ\s*฿?\s*([0-9,]+(?:\.\d+)?)/gi);
      const legacyTotal = sumMatches(part, /\[payroll_extra_deduct=([0-9,]+(?:\.\d+)?)\]/gi);
      if (legacyTotal) {
        if (textSocial || textOther) {
          result.socialSecurity += textSocial;
          result.other += textOther;
          result.unclassified += Math.max(0, legacyTotal - textSocial - textOther);
        } else {
          result.unclassified += legacyTotal;
        }
      } else {
        result.socialSecurity += textSocial;
        result.other += textOther;
      }
    });
    result.socialSecurity = roundMoney(result.socialSecurity);
    result.other = roundMoney(result.other);
    result.unclassified = roundMoney(result.unclassified);
    result.total = roundMoney(result.socialSecurity + result.other + result.unclassified);
    return result;
  }

  function paymentDeductions(row) {
    const parsed = parseNoteDeductions(row && row.note);
    const explicitSocial = num(row && row.deduct_ss);
    const explicitOther = num(row && row.deduct_other);
    const socialSecurity = roundMoney(explicitSocial > 0 ? explicitSocial : parsed.socialSecurity);
    const other = roundMoney((explicitOther > 0 ? explicitOther : parsed.other) + parsed.unclassified);
    return {
      socialSecurity,
      other,
      total: roundMoney(socialSecurity + other),
    };
  }

  function paymentTotals(rows) {
    const totals = (Array.isArray(rows) ? rows : []).reduce((total, row) => {
      const deductions = paymentDeductions(row);
      total.netPaid += num(row && row.net_paid);
      total.debtDeducted += num(row && row.deduct_withdraw);
      total.socialSecurity += deductions.socialSecurity;
      total.other += deductions.other;
      total.bonus += num(row && row.bonus);
      total.accounted += num(row && row.net_paid) + num(row && row.deduct_withdraw) + deductions.total;
      return total;
    }, { netPaid: 0, debtDeducted: 0, socialSecurity: 0, other: 0, bonus: 0, accounted: 0 });
    Object.keys(totals).forEach(key => { totals[key] = roundMoney(totals[key]); });
    return totals;
  }

  function resolvePayrollBalance(options) {
    const attendancePay = options && options.attendancePay || {};
    const paymentRows = Array.isArray(options && options.paymentRows) ? options.paymentRows : [];
    const paidTotals = paymentTotals(paymentRows);
    const latestPaid = [...paymentRows]
      .sort((a, b) => new Date(b && b.paid_date || 0) - new Date(a && a.paid_date || 0))[0] || null;
    const useStoredSnapshot = !!(
      options && options.monthStart < options.currentMonthStart
      && latestPaid && num(latestPaid.base_salary) > 0
    );
    const attendanceEarn = roundMoney(useStoredSnapshot ? latestPaid.base_salary : attendancePay.earn);
    const attendanceDeduction = roundMoney(
      useStoredSnapshot ? latestPaid.deduct_absent : attendancePay.attendanceDeduction,
    );
    const grossBeforeAttendance = roundMoney(
      useStoredSnapshot
        ? attendanceEarn + attendanceDeduction
        : attendancePay.grossBeforeDeductions,
    );
    const workDays = roundMoney(
      useStoredSnapshot && num(latestPaid.working_days) > 0
        ? latestPaid.working_days
        : attendancePay.workDays,
    );
    const bonus = roundMoney(paidTotals.bonus);
    const entitlement = roundMoney(attendanceEarn + bonus);
    const consumed = roundMoney(paidTotals.accounted);
    return {
      latestPaid,
      useStoredSnapshot,
      paidTotals,
      attendanceEarn,
      attendanceDeduction,
      grossBeforeAttendance,
      workDays,
      bonus,
      entitlement,
      consumed,
      remaining: roundMoney(Math.max(0, entitlement - consumed)),
    };
  }

  return {
    num,
    roundMoney,
    normalizeStatus,
    calculateAttendancePay,
    parseNoteDeductions,
    paymentDeductions,
    paymentTotals,
    resolvePayrollBalance,
  };
});
