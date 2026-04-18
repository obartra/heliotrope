import { z } from 'zod';

/**
 * Structural type for a Firestore Timestamp. Works with both Admin SDK
 * and client SDK Timestamp instances without importing either.
 */
export interface FirestoreTimestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
}

/**
 * Validates a Firestore Timestamp-like object by checking for the
 * required `seconds` and `nanoseconds` number properties.
 */
export const TimestampSchema = z.custom<FirestoreTimestamp>(
  (val): val is FirestoreTimestamp =>
    val != null &&
    typeof val === 'object' &&
    'seconds' in val &&
    typeof (val as Record<string, unknown>).seconds === 'number' &&
    'nanoseconds' in val &&
    typeof (val as Record<string, unknown>).nanoseconds === 'number',
  { message: 'Expected a Firestore Timestamp (object with seconds and nanoseconds)' },
);
