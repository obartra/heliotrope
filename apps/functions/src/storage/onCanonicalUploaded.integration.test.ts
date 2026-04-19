import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearUserData, emulatorRunning, testTimestamp } from '../test-utils.js';
import { handleCanonicalUploaded } from './onCanonicalUploaded.js';

vi.mock('firebase-admin/storage', () => {
  const savedBuffers = new Map<string, Buffer>();
  return {
    getStorage: () => ({
      bucket: () => ({
        file: (path: string) => ({
          download: () => {
            const buf = savedBuffers.get(path);
            if (!buf) return Promise.reject(new Error(`File not found: ${path}`));
            return Promise.resolve([buf]);
          },
          save: (buffer: Buffer) => {
            savedBuffers.set(path, buffer);
            return Promise.resolve();
          },
        }),
      }),
    }),
    __savedBuffers: savedBuffers,
  };
});

const TEST_UID = 'storage-trigger-test-user';

async function createTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 64, b: 32 },
    },
  })
    .png()
    .toBuffer();
}

function makeStorageEvent(name: string) {
  return {
    data: { name },
  } as Parameters<typeof handleCanonicalUploaded>[0];
}

describe.skipIf(!emulatorRunning)('handleCanonicalUploaded (integration)', () => {
  const db = emulatorRunning
    ? getFirestore()
    : (undefined as unknown as FirebaseFirestore.Firestore);

  beforeEach(async () => {
    await clearUserData(TEST_UID);
  });

  afterEach(async () => {
    await clearUserData(TEST_UID);
  });

  it('generates Slack variant and updates Firestore', async () => {
    const imageId = '550e8400-e29b-41d4-a716-446655440010';
    const canonicalPath = `users/${TEST_UID}/avatars/${imageId}.png`;

    // Seed the canonical image in the mock storage
    const pngBuffer = await createTestPng(1024, 1024);
    const storageMod = await import('firebase-admin/storage');
    const savedBuffers = (storageMod as unknown as { __savedBuffers: Map<string, Buffer> })
      .__savedBuffers;
    savedBuffers.set(canonicalPath, pngBuffer);

    // Seed the image document in Firestore
    const ts = testTimestamp();
    await db.doc(`users/${TEST_UID}/images/${imageId}`).set({
      id: imageId,
      filename: 'test.png',
      displayName: 'Test',
      storagePath: canonicalPath,
      contentType: 'image/png',
      bytes: pngBuffer.length,
      width: 1024,
      height: 1024,
      tags: [],
      createdAt: Timestamp.fromMillis(ts.seconds * 1000),
      updatedAt: Timestamp.fromMillis(ts.seconds * 1000),
    });

    await handleCanonicalUploaded(makeStorageEvent(canonicalPath));

    // Verify Firestore was updated with variants
    const imageDoc = await db.doc(`users/${TEST_UID}/images/${imageId}`).get();
    const data = imageDoc.data();
    expect(data).toBeDefined();

    const variants = data?.variants as Record<string, unknown> | undefined;
    expect(variants).toBeDefined();
    expect(variants?.slack).toBeDefined();

    const slack = variants?.slack as {
      storagePath: string;
      contentType: string;
      width: number;
      height: number;
      bytes: number;
    };
    expect(slack.storagePath).toBe(`users/${TEST_UID}/avatars/${imageId}_slack.jpg`);
    expect(slack.contentType).toBe('image/jpeg');
    expect(slack.width).toBe(512);
    expect(slack.height).toBe(512);
    expect(slack.bytes).toBeGreaterThan(0);

    // Verify the variant was saved to storage
    const variantBuffer = savedBuffers.get(slack.storagePath);
    expect(variantBuffer).toBeDefined();

    const meta = await sharp(variantBuffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('ignores variant files (prevents infinite loop)', async () => {
    const event = makeStorageEvent(`users/${TEST_UID}/avatars/abc_slack.jpg`);
    // Should return without error or action
    await handleCanonicalUploaded(event);
  });

  it('ignores files outside the avatars path', async () => {
    const event = makeStorageEvent('some/other/path.png');
    await handleCanonicalUploaded(event);
  });

  it('ignores events with no file name', async () => {
    const event = { data: { name: undefined } } as unknown as Parameters<
      typeof handleCanonicalUploaded
    >[0];
    await handleCanonicalUploaded(event);
  });
});
