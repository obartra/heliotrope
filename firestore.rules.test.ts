import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { describe, it, beforeAll, afterAll, afterEach } from 'vitest';

const FIRESTORE_PORT = 8080;

const emulatorRunning = await fetch(`http://localhost:${FIRESTORE_PORT}`).then(
  () => true,
  () => false,
);

const PROJECT_ID = 'heliotrope-rules-test';
const OWNER_UID = 'owner-abc';
const OTHER_UID = 'other-xyz';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: FIRESTORE_PORT,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

function ownerFirestore() {
  return testEnv.authenticatedContext(OWNER_UID).firestore();
}

function otherFirestore() {
  return testEnv.authenticatedContext(OTHER_UID).firestore();
}

function unauthFirestore() {
  return testEnv.unauthenticatedContext().firestore();
}

// Collections where the owner has full read/write access.
const ownerReadWriteCollections = ['profile', 'images', 'rules', 'overrides', 'locations'] as const;

describe.skipIf(!emulatorRunning).each(ownerReadWriteCollections)(
  'users/{uid}/%s/{doc}',
  (collection) => {
    const path = `users/${OWNER_UID}/${collection}/doc1`;

    it('owner can read', async () => {
      await assertSucceeds(getDoc(doc(ownerFirestore(), path)));
    });

    it('owner can write', async () => {
      await assertSucceeds(setDoc(doc(ownerFirestore(), path), { x: 1 }));
    });

    it('other user cannot read', async () => {
      await assertFails(getDoc(doc(otherFirestore(), path)));
    });

    it('other user cannot write', async () => {
      await assertFails(setDoc(doc(otherFirestore(), path), { x: 1 }));
    });

    it('unauthenticated cannot read', async () => {
      await assertFails(getDoc(doc(unauthFirestore(), path)));
    });

    it('unauthenticated cannot write', async () => {
      await assertFails(setDoc(doc(unauthFirestore(), path), { x: 1 }));
    });
  },
);

// Collections where the owner can read but not write (server-only writes).
const ownerReadOnlyCollections = ['decisions', 'slackState'] as const;

describe.skipIf(!emulatorRunning).each(ownerReadOnlyCollections)(
  'users/{uid}/%s/{doc}',
  (collection) => {
    const path = `users/${OWNER_UID}/${collection}/doc1`;

    it('owner can read', async () => {
      await assertSucceeds(getDoc(doc(ownerFirestore(), path)));
    });

    it('owner cannot write', async () => {
      await assertFails(setDoc(doc(ownerFirestore(), path), { x: 1 }));
    });

    it('other user cannot read', async () => {
      await assertFails(getDoc(doc(otherFirestore(), path)));
    });

    it('other user cannot write', async () => {
      await assertFails(setDoc(doc(otherFirestore(), path), { x: 1 }));
    });

    it('unauthenticated cannot read', async () => {
      await assertFails(getDoc(doc(unauthFirestore(), path)));
    });

    it('unauthenticated cannot write', async () => {
      await assertFails(setDoc(doc(unauthFirestore(), path), { x: 1 }));
    });
  },
);

// Secrets: no client access at all.
describe.skipIf(!emulatorRunning)('users/{uid}/secrets/{doc}', () => {
  const path = `users/${OWNER_UID}/secrets/doc1`;

  it('owner cannot read', async () => {
    await assertFails(getDoc(doc(ownerFirestore(), path)));
  });

  it('owner cannot write', async () => {
    await assertFails(setDoc(doc(ownerFirestore(), path), { x: 1 }));
  });

  it('other user cannot read', async () => {
    await assertFails(getDoc(doc(otherFirestore(), path)));
  });

  it('other user cannot write', async () => {
    await assertFails(setDoc(doc(otherFirestore(), path), { x: 1 }));
  });

  it('unauthenticated cannot read', async () => {
    await assertFails(getDoc(doc(unauthFirestore(), path)));
  });

  it('unauthenticated cannot write', async () => {
    await assertFails(setDoc(doc(unauthFirestore(), path), { x: 1 }));
  });
});
