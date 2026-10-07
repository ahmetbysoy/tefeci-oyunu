export interface RepaymentRecord {
  loansPaidOnTime: number;
  loansPaidLate: number;
  loansDefaulted: number;
  totalBorrowed: number;
  totalRepaid: number;
}

export function calculateCreditScore(record: RepaymentRecord): number {
  const completed = record.loansPaidOnTime + record.loansPaidLate + record.loansDefaulted;
  if (record.totalBorrowed <= 0 && completed === 0) return 50;

  const repaymentRatio = record.totalBorrowed > 0
    ? Math.min(1, record.totalRepaid / record.totalBorrowed)
    : 0;
  const punctualityRatio = completed > 0 ? record.loansPaidOnTime / completed : 0;
  const lateRatio = completed > 0 ? record.loansPaidLate / completed : 0;
  const defaultRatio = completed > 0 ? record.loansDefaulted / completed : 0;

  const score =
    30 +
    repaymentRatio * 30 +
    punctualityRatio * 35 -
    lateRatio * 12 -
    defaultRatio * 55;
  return Math.round(Math.min(100, Math.max(0, score)));
}
