import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { describe, it, beforeAll, afterAll, afterEach } from 'vitest';

const STORAGE_PORT = 9199;

const emulatorRunning = await fetch(`http://localhost:${STORAGE_PORT}`).then(
  () => true,
  () => false,
);

const PROJECT_ID = 'heliotrope-storage-rules-test';
const OWNER_UID = 'owner-abc';
const OTHER_UID = 'other-xyz';
const AVATAR_PATH = `users/${OWNER_UID}/avatars/photo.png`;
const FAKE_FILE = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
      host: 'localhost',
      port: STORAGE_PORT,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearStorage();
});

function ownerStorage() {
  return testEnv.authenticatedContext(OWNER_UID).storage();
}

function otherStorage() {
  return testEnv.authenticatedContext(OTHER_UID).storage();
}

function unauthStorage() {
  return testEnv.unauthenticatedContext().storage();
}

describe.skipIf(!emulatorRunning)('users/{uid}/avatars/', () => {
  it('owner can upload', async () => {
    await assertSucceeds(uploadBytes(ref(ownerStorage(), AVATAR_PATH), FAKE_FILE));
  });

  it('owner can read', async () => {
    // Seed the file via admin, then read as owner.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), AVATAR_PATH), FAKE_FILE);
    });
    await assertSucceeds(getBytes(ref(ownerStorage(), AVATAR_PATH)));
  });

  it('other user cannot upload', async () => {
    await assertFails(uploadBytes(ref(otherStorage(), AVATAR_PATH), FAKE_FILE));
  });

  it('other user cannot read', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), AVATAR_PATH), FAKE_FILE);
    });
    await assertFails(getBytes(ref(otherStorage(), AVATAR_PATH)));
  });

  it('unauthenticated cannot upload', async () => {
    await assertFails(uploadBytes(ref(unauthStorage(), AVATAR_PATH), FAKE_FILE));
  });

  it('unauthenticated cannot read', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), AVATAR_PATH), FAKE_FILE);
    });
    await assertFails(getBytes(ref(unauthStorage(), AVATAR_PATH)));
  });

  it('owner cannot write to another user path', async () => {
    const crossPath = `users/${OTHER_UID}/avatars/photo.png`;
    await assertFails(uploadBytes(ref(ownerStorage(), crossPath), FAKE_FILE));
  });
});
