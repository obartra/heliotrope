import { HttpsError } from 'firebase-functions/v2/identity';
import { describe, it, expect } from 'vitest';
import { checkAllowlist } from './beforeUserCreated.js';

const ALLOWLIST = JSON.stringify(['alice@example.com', 'bob@example.com']);

describe('checkAllowlist', () => {
  it('passes for an allowed email', () => {
    expect(() => checkAllowlist('alice@example.com', ALLOWLIST)).not.toThrow();
  });

  it('is case-insensitive', () => {
    expect(() => checkAllowlist('Alice@Example.COM', ALLOWLIST)).not.toThrow();
  });

  it('rejects a disallowed email', () => {
    expect(() => checkAllowlist('eve@example.com', ALLOWLIST)).toThrow(HttpsError);
    expect(() => checkAllowlist('eve@example.com', ALLOWLIST)).toThrow(
      'This email is not allowed to sign up.',
    );
  });

  it('rejects when email is undefined', () => {
    expect(() => checkAllowlist(undefined, ALLOWLIST)).toThrow(HttpsError);
    expect(() => checkAllowlist(undefined, ALLOWLIST)).toThrow('Email is required to sign up.');
  });

  it('rejects when allowlist JSON is empty string', () => {
    expect(() => checkAllowlist('alice@example.com', '')).toThrow(HttpsError);
    expect(() => checkAllowlist('alice@example.com', '')).toThrow(
      'Allowlist configuration is invalid',
    );
  });

  it('rejects when allowlist JSON is malformed', () => {
    expect(() => checkAllowlist('alice@example.com', 'not-json')).toThrow(HttpsError);
  });

  it('rejects when allowlist contains invalid entries', () => {
    expect(() => checkAllowlist('alice@example.com', JSON.stringify(['not-an-email']))).toThrow(
      HttpsError,
    );
  });

  it('rejects when allowlist is an empty array', () => {
    expect(() => checkAllowlist('alice@example.com', '[]')).toThrow(
      'This email is not allowed to sign up.',
    );
  });
});
