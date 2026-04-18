import { describe, it, expect } from 'vitest';
import { RuleSchema } from './rule.js';

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

const ts = { seconds: 1700000000, nanoseconds: 0 };
const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
const uuid2 = '660e8400-e29b-41d4-a716-446655440001';

const validRule = {
  id: uuid1,
  name: 'Winter avatar',
  enabled: true,
  priority: 10,
  imageId: uuid2,
  conditions: [{ type: 'monthRange' as const, fromMonth: 11, toMonth: 2 }],
  createdAt: ts,
  updatedAt: ts,
};

describe('RuleSchema', () => {
  it('parses a valid rule', () => {
    expect(RuleSchema.parse(validRule)).toEqual(validRule);
  });

  it('accepts empty conditions array (always-match rule)', () => {
    expect(RuleSchema.parse({ ...validRule, conditions: [] })).toBeTruthy();
  });

  it('accepts multiple conditions', () => {
    const rule = {
      ...validRule,
      conditions: [
        { type: 'monthRange' as const, fromMonth: 11, toMonth: 2 },
        { type: 'timeOfDay' as const, value: 'day' as const },
        { type: 'country' as const, codes: ['US'] },
      ],
    };
    expect(RuleSchema.parse(rule)).toBeTruthy();
  });

  it('accepts disabled rule', () => {
    expect(RuleSchema.parse({ ...validRule, enabled: false })).toBeTruthy();
  });

  it('accepts negative priority', () => {
    expect(RuleSchema.parse({ ...validRule, priority: -5 })).toBeTruthy();
  });

  it('accepts zero priority', () => {
    expect(RuleSchema.parse({ ...validRule, priority: 0 })).toBeTruthy();
  });

  it('rejects non-integer priority', () => {
    expect(() => RuleSchema.parse({ ...validRule, priority: 10.5 })).toThrow();
  });

  it('rejects invalid UUID for id', () => {
    expect(() => RuleSchema.parse({ ...validRule, id: 'bad-id' })).toThrow();
  });

  it('rejects invalid UUID for imageId', () => {
    expect(() => RuleSchema.parse({ ...validRule, imageId: 'bad-id' })).toThrow();
  });

  it('rejects missing name', () => {
    expect(() => RuleSchema.parse(omit(validRule, 'name'))).toThrow();
  });

  it('rejects missing enabled', () => {
    expect(() => RuleSchema.parse(omit(validRule, 'enabled'))).toThrow();
  });

  it('rejects invalid condition inside conditions array', () => {
    expect(() =>
      RuleSchema.parse({
        ...validRule,
        conditions: [{ type: 'unknown', value: 42 }],
      }),
    ).toThrow();
  });

  it('rejects missing createdAt', () => {
    expect(() => RuleSchema.parse(omit(validRule, 'createdAt'))).toThrow();
  });

  it('rejects missing updatedAt', () => {
    expect(() => RuleSchema.parse(omit(validRule, 'updatedAt'))).toThrow();
  });
});
