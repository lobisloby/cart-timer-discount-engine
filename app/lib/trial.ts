/** Milliseconds in a standard solar day (billing-style countdown uses wall-clock spans). */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type TrialState = {
  trialEndDate: Date;
  /** Whole days remaining until trial end (0 after expiry). */
  daysLeft: number;
  trialExpired: boolean;
  trialEndDateFormatted: string;
};

/**
 * Trial ends exactly `trialLengthDays` calendar days after `installedAt`
 * (same instant of day + N days via setDate).
 */
export function computeTrialState(
  installedAt: Date,
  now = new Date(),
  trialLengthDays = 7,
): TrialState {
  const trialEndDate = new Date(installedAt);
  trialEndDate.setDate(trialEndDate.getDate() + trialLengthDays);

  const diffMs = trialEndDate.getTime() - now.getTime();
  const daysLeft =
    diffMs <= 0 ? 0 : Math.ceil(diffMs / MS_PER_DAY);
  const trialExpired = daysLeft <= 0;

  return {
    trialEndDate,
    daysLeft,
    trialExpired,
    trialEndDateFormatted: trialEndDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}
