// Pure logic for moving money between buckets. The database function
// transfer_between_buckets() enforces the same rules; this is what the UI checks first.
// All money is integer halalas.

export type TransferError = "invalid-amount" | "same-bucket" | "no-destination" | "exceeds-balance";

/** Why a transfer cannot be made, or null if it can. */
export function transferError(t: {
  /** null = the typed amount is not a valid number */
  amount: number | null;
  /** balance of the source bucket */
  balance: number;
  fromBucketId: string;
  toBucketId: string;
}): TransferError | null {
  if (!t.toBucketId) return "no-destination";
  if (t.toBucketId === t.fromBucketId) return "same-bucket";
  if (t.amount === null || !Number.isSafeInteger(t.amount) || t.amount <= 0) return "invalid-amount";
  if (t.amount > t.balance) return "exceeds-balance";
  return null;
}

/** The two ledger entries of a transfer. They always sum to zero: the total never changes. */
export const transferLegs = (amount: number) => ({ source: -amount, destination: amount });

/** A bank transfer is needed only when the two buckets live in different accounts. */
export const needsBankTransfer = (fromAccountId: string, toAccountId: string) => fromAccountId !== toAccountId;

/**
 * What "set the balance to X" does: one adjustment entry for the difference.
 * Unlike a transfer, this changes the total of all money by `delta`.
 */
export const adjustmentDelta = (balance: number, target: number) => target - balance;
