/* eslint-disable @typescript-eslint/no-unsafe-assignment */

const EMULATOR_FIRESTORE = 'http://127.0.0.1:8080';
const EMULATOR_STORAGE = 'http://127.0.0.1:9199';

const PROJECT_ID = 'heliotrope-85736';
const STORAGE_BUCKET = `${PROJECT_ID}.appspot.com`;

const TEST_EMAIL = 'ruletest@example.com';
const TEST_PASSWORD = 'testpass123';

function writeFirestoreDoc(path: string, fields: Record<string, unknown>) {
  return cy.request({
    method: 'PATCH',
    url: `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    headers: { Authorization: 'Bearer owner' },
    body: { fields },
  });
}

function deleteFirestoreDoc(path: string) {
  return cy.request({
    method: 'DELETE',
    url: `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    headers: { Authorization: 'Bearer owner' },
    failOnStatusCode: false,
  });
}

function uploadStorageFile(storagePath: string) {
  return cy.request({
    method: 'POST',
    url: `${EMULATOR_STORAGE}/v0/b/${STORAGE_BUCKET}/o?name=${encodeURIComponent(storagePath)}`,
    headers: { 'Content-Type': 'image/png', Authorization: 'Bearer owner' },
    body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    encoding: 'binary',
  });
}

function fs(value: string) {
  return { stringValue: value };
}

function fi(value: number) {
  return { integerValue: value.toString() };
}

function fb(value: boolean) {
  return { booleanValue: value };
}

function fts() {
  return {
    mapValue: {
      fields: { seconds: fi(1700000000), nanoseconds: fi(0) },
    },
  };
}

function fa(values: Array<Record<string, unknown>>) {
  if (values.length === 0) return { arrayValue: {} };
  return { arrayValue: { values } };
}

function fmap(fields: Record<string, unknown>) {
  return { mapValue: { fields } };
}

const IMAGE_ID = '550e8400-e29b-41d4-a716-446655440020';
const RULE_ID_1 = '550e8400-e29b-41d4-a716-446655440030';
const RULE_ID_2 = '550e8400-e29b-41d4-a716-446655440031';

describe('Rules', () => {
  let uid: string;

  before(() => {
    cy.task('createFirebaseUser', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      projectId: PROJECT_ID,
    }).then((result) => {
      uid = result as string;
    });
  });

  function signIn() {
    cy.visit('/');
    cy.contains('h1', /Sign in|Dashboard/, { timeout: 10000 });
    cy.url().then((url) => {
      if (url.includes('/dashboard')) {
        return;
      }
      cy.get('#email').type(TEST_EMAIL);
      cy.get('#password').type(TEST_PASSWORD);
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/dashboard', { timeout: 10000 });
    });
  }

  function seedImage() {
    uploadStorageFile(`users/${uid}/avatars/${IMAGE_ID}.png`);
    writeFirestoreDoc(`users/${uid}/images/${IMAGE_ID}`, {
      id: fs(IMAGE_ID),
      filename: fs('avatar.png'),
      displayName: fs('Test Avatar'),
      storagePath: fs(`users/${uid}/avatars/${IMAGE_ID}.png`),
      contentType: fs('image/png'),
      bytes: fi(1024),
      width: fi(256),
      height: fi(256),
      tags: fa([]),
      createdAt: fts(),
      updatedAt: fts(),
    });
  }

  function seedRule(
    ruleId: string,
    name: string,
    priority: number,
    conditions: Array<Record<string, unknown>> = [],
  ) {
    writeFirestoreDoc(`users/${uid}/rules/${ruleId}`, {
      id: fs(ruleId),
      name: fs(name),
      enabled: fb(true),
      priority: fi(priority),
      imageId: fs(IMAGE_ID),
      conditions: fa(conditions.map((c) => fmap(c))),
      createdAt: fts(),
      updatedAt: fts(),
    });
  }

  function cleanup() {
    deleteFirestoreDoc(`users/${uid}/images/${IMAGE_ID}`);
    deleteFirestoreDoc(`users/${uid}/rules/${RULE_ID_1}`);
    deleteFirestoreDoc(`users/${uid}/rules/${RULE_ID_2}`);
  }

  describe('Create rule with conditions', () => {
    beforeEach(() => {
      signIn();
      seedImage();
    });

    afterEach(() => {
      cleanup();
      // Clean up any dynamically created rules by listing and deleting
      cy.request({
        method: 'GET',
        url: `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/rules`,
        headers: { Authorization: 'Bearer owner' },
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status === 200 && resp.body.documents) {
          for (const doc of resp.body.documents as Array<{ name: string }>) {
            const docPath = doc.name.split('/documents/')[1];
            if (docPath) {
              cy.request({
                method: 'DELETE',
                url: `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
                headers: { Authorization: 'Bearer owner' },
                failOnStatusCode: false,
              });
            }
          }
        }
      });
    });

    it('creates a rule with three conditions and saves it', () => {
      cy.visit('/rules');

      // Add a new rule
      cy.contains('button', 'Add rule').click();
      cy.url().should('match', /\/rules\/.+/);

      // Fill in name
      cy.get('#rule-name').clear().type('Winter weather rule');

      // Select the image
      cy.get('button[title="Test Avatar"]').click();

      // Add condition 1: Weather
      cy.contains('button', 'Add condition').click();
      cy.contains('[role="menuitem"]', 'Weather').click();
      // The condition card should appear and be expanded
      cy.contains('Weather:').should('be.visible');

      // Add condition 2: Time of Day
      cy.contains('button', 'Add condition').click();
      cy.contains('[role="menuitem"]', 'Time of Day').click();
      cy.contains('Time of Day:').should('be.visible');

      // Add condition 3: Month Range
      cy.contains('button', 'Add condition').click();
      cy.contains('[role="menuitem"]', 'Month Range').click();
      cy.contains('Month Range:').should('be.visible');

      // Save
      cy.contains('button', 'Save').click();
      cy.url().should('include', '/rules');
      cy.url().should('not.match', /\/rules\/.+/);

      // Verify the rule shows up on the list
      cy.contains('Winter weather rule').should('be.visible');
      cy.contains('3 conditions').should('be.visible');
    });
  });

  describe('Enable/disable toggle', () => {
    beforeEach(() => {
      signIn();
      seedImage();
      seedRule(RULE_ID_1, 'Toggle Test Rule', 20);
    });

    afterEach(() => {
      cleanup();
    });

    it('toggles a rule enabled/disabled inline', () => {
      cy.visit('/rules');

      // Rule should be visible
      cy.contains('Toggle Test Rule', { timeout: 10000 }).should('be.visible');

      // Find the switch and toggle it off
      cy.get('button[role="switch"]').first().click();

      // Verify the switch is now unchecked (aria-checked="false")
      cy.get('button[role="switch"]').first().should('have.attr', 'aria-checked', 'false');

      // Reload and verify it persisted
      cy.reload();
      cy.contains('Toggle Test Rule', { timeout: 10000 }).should('be.visible');
      cy.get('button[role="switch"]').first().should('have.attr', 'aria-checked', 'false');

      // Toggle back on
      cy.get('button[role="switch"]').first().click();
      cy.get('button[role="switch"]').first().should('have.attr', 'aria-checked', 'true');
    });
  });

  describe('Delete rule', () => {
    beforeEach(() => {
      signIn();
      seedImage();
      seedRule(RULE_ID_1, 'Rule to delete', 20);
    });

    afterEach(() => {
      cleanup();
    });

    it('deletes a rule via the confirmation dialog', () => {
      cy.visit('/rules');

      cy.contains('Rule to delete', { timeout: 10000 }).should('be.visible');

      // Click delete button
      cy.contains('button', 'Delete').click();

      // Confirmation dialog should appear
      cy.contains('Are you sure').should('be.visible');
      cy.contains('Rule to delete').should('be.visible');

      // Confirm deletion
      cy.get('[role="dialog"]').contains('button', 'Delete').click();

      // Rule should be gone
      cy.contains('Rule to delete').should('not.exist');
      cy.contains('No rules yet').should('be.visible');
    });
  });

  describe('Reorder rules', () => {
    beforeEach(() => {
      signIn();
      seedImage();
      seedRule(RULE_ID_1, 'High priority', 30);
      seedRule(RULE_ID_2, 'Low priority', 10);
    });

    afterEach(() => {
      cleanup();
    });

    it('moves a rule up and down', () => {
      cy.visit('/rules');

      // Wait for both rules to load (ordered by priority desc)
      cy.contains('High priority', { timeout: 10000 }).should('be.visible');
      cy.contains('Low priority').should('be.visible');

      // "High priority" should be first, "Low priority" second
      cy.get('[class*="space-y"]')
        .find('a')
        .then(($links) => {
          const names = $links.toArray().map((el) => el.textContent);
          expect(names[0]).to.equal('High priority');
          expect(names[1]).to.equal('Low priority');
        });

      // Move "High priority" down (should swap with "Low priority")
      cy.get('[aria-label="Move down"]').first().click();

      // After reorder, "Low priority" should now be first
      cy.wait(500); // allow Firestore snapshot to propagate
      cy.get('[class*="space-y"]')
        .find('a')
        .then(($links) => {
          const names = $links.toArray().map((el) => el.textContent);
          expect(names[0]).to.equal('Low priority');
          expect(names[1]).to.equal('High priority');
        });
    });
  });
});
