const { test, expect, seedAuthenticatedSession, clearE2ESession } = require('../fixtures/auth');
const { buildE2ERecord, cleanupE2ERecords } = require('../fixtures/data');

const INTRODUCTION_ID = buildE2ERecord('intro-follow-up-outcome', { id: 'intro-e2e-follow-up-outcome' }).id;
const PRIVATE_FOLLOW_UP_NOTE = 'PRIVATE follow-up note: do not expose in audit-facing UI';
const PRIVATE_OUTCOME_NOTE = 'PRIVATE outcome note: do not expose in audit-facing UI';
const FUTURE_REMINDER_TIME = '2099-07-10T12:00';
const PAST_REMINDER_TIME = '2020-01-01T12:00';
const OUTCOME_VALUES = [
  'connected',
  'meeting_scheduled',
  'in_conversation',
  'opportunity_created',
  'not_a_fit',
  'no_response',
];

async function gotoFollowUp(page) {
  const response = await page.goto(`/introductions/${INTRODUCTION_ID}/follow-up`);
  expect(response && response.status()).toBeLessThan(500);
}

async function gotoOutcome(page) {
  const response = await page.goto(`/introductions/${INTRODUCTION_ID}/outcome`);
  expect(response && response.status()).toBeLessThan(500);
}

test.describe('follow-up and outcome browser coverage', () => {
  test.beforeEach(async ({ context }) => {
    await seedAuthenticatedSession(context, 'steward');
  });

  test.afterEach(async ({ context }) => {
    await clearE2ESession(context);
    await cleanupE2ERecords();
  });

  test('schedules a valid future follow-up with normalized recipient intent and optional private note', async ({ page }) => {
    await gotoFollowUp(page);

    await page.getByTestId('follow-up-remind-at').fill(FUTURE_REMINDER_TIME);
    await page.getByTestId('follow-up-recipient-ids').fill('identity-seeker, identity-helper, identity-helper');
    await page.getByTestId('follow-up-note').fill(PRIVATE_FOLLOW_UP_NOTE);

    await expect(page.getByTestId('follow-up-confirmation')).toContainText('scheduled');
    await expect(page.getByTestId('follow-up-confirmation')).toContainText('without copying the note text');
    await expect(page.getByTestId('follow-up-status-steps')).toContainText('Scheduled');

    const validity = await page.getByTestId('follow-up-form').evaluate((form) => form.checkValidity());
    expect(validity).toBe(true);
  });

  test('rejects invalid or past reminder times and requires recipients in the browser', async ({ page }) => {
    await gotoFollowUp(page);

    await page.getByTestId('follow-up-remind-at').fill(PAST_REMINDER_TIME);
    await page.getByTestId('follow-up-recipient-ids').fill('identity-helper');
    await expect(page.getByTestId('follow-up-remind-at')).toHaveJSProperty('validity.valid', false);

    await page.getByTestId('follow-up-remind-at').fill(FUTURE_REMINDER_TIME);
    await page.getByTestId('follow-up-recipient-ids').fill('');
    await expect(page.getByTestId('follow-up-recipient-ids')).toHaveJSProperty('validity.valueMissing', true);

    await page.getByTestId('follow-up-recipient-ids').fill('identity-helper');
    const validity = await page.getByTestId('follow-up-form').evaluate((form) => form.checkValidity());
    expect(validity).toBe(true);
  });

  test('captures every supported outcome status and requires a selected outcome', async ({ page }) => {
    await gotoOutcome(page);

    const missingValidity = await page.getByTestId('outcome-form').evaluate((form) => form.checkValidity());
    expect(missingValidity).toBe(false);

    for (const outcome of OUTCOME_VALUES) {
      await page.getByTestId(`outcome-option-${outcome}`).check();
      await page.getByTestId('outcome-note').fill(`${PRIVATE_OUTCOME_NOTE}: ${outcome}`);
      const validity = await page.getByTestId('outcome-form').evaluate((form) => form.checkValidity());
      expect(validity).toBe(true);
      await expect(page.getByTestId('outcome-confirmation')).toContainText('privacy-safe audit metadata');
      await expect(page.getByTestId('outcome-confirmation')).toContainText('note text is not copied');
    }
  });

  test('keeps private notes out of audit-facing copy and unauthenticated UI', async ({ page, context }) => {
    await gotoFollowUp(page);
    await page.getByTestId('follow-up-note').fill(PRIVATE_FOLLOW_UP_NOTE);
    await expect(page.getByTestId('follow-up-confirmation')).not.toContainText(PRIVATE_FOLLOW_UP_NOTE);

    await gotoOutcome(page);
    await page.getByTestId('outcome-note').fill(PRIVATE_OUTCOME_NOTE);
    await expect(page.getByTestId('outcome-confirmation')).not.toContainText(PRIVATE_OUTCOME_NOTE);

    await clearE2ESession(context);
    await page.goto(`/introductions/${INTRODUCTION_ID}/follow-up`);
    await expect(page.getByTestId('follow-up-page')).not.toContainText(PRIVATE_FOLLOW_UP_NOTE);
    await page.goto(`/introductions/${INTRODUCTION_ID}/outcome`);
    await expect(page.getByTestId('outcome-page')).not.toContainText(PRIVATE_OUTCOME_NOTE);
  });
});
