import { describe, expect, it } from 'vitest';

import {
  buildFollowUpReminderNotification,
  buildIntroductionCoordinationNotification,
  buildInviteDeliveryNotification,
  buildOutcomePromptNotification,
} from '@/lib/notifications/templates/builders';
import type { NotificationMessage, NotificationRecipient } from '@/lib/notifications/types';

const identityRecipient: NotificationRecipient = {
  type: 'identity',
  identityId: 'identity_123',
  displayName: 'Jordan',
};

const addressRefRecipient: NotificationRecipient = {
  type: 'delivery_address_ref',
  addressRef: 'invite_delivery_address_456',
};

const forbiddenPhrases = [
  'private steward note',
  'resume contents',
  'private message',
  'compensation',
  'salary',
  'health information',
  'raw introduction context',
  'AI wrote',
  'AI-generated endorsement',
  'endorsed by AI',
];

function searchable(message: NotificationMessage): string {
  return JSON.stringify(message).toLowerCase();
}

function expectRequiredFields(message: NotificationMessage): void {
  expect(message.category).toBeTruthy();
  expect(message.recipient).toBeTruthy();
  expect(message.subject).toBeTruthy();
  expect(message.textBody).toBeTruthy();
  expect(message.htmlBody).toBeTruthy();
  expect(message.metadata).toBeTruthy();
  expect(message.idempotencyKey).toMatch(/^notification:/);
}

function expectSensitiveDataExcluded(message: NotificationMessage): void {
  const output = searchable(message);

  for (const phrase of forbiddenPhrases) {
    expect(output).not.toContain(phrase.toLowerCase());
  }
}

describe('notification template builders', () => {
  it('builds an invite delivery notification with required fields and a stable idempotency key', () => {
    const message = buildInviteDeliveryNotification({
      inviteId: 'invite_123',
      recipient: addressRefRecipient,
      inviterDisplayName: 'Avery',
      communityName: 'Neighborhood Helpers',
      acceptUrl: 'https://example.test/invites/accept',
    });

    expectRequiredFields(message);
    expect(message.category).toBe('invite_delivery');
    expect(message.subject).toBe("You're invited to Neighborhood Helpers");
    expect(message.textBody).toContain('Avery invited you to join Neighborhood Helpers.');
    expect(message.textBody).toContain('https://example.test/invites/accept');
    expect(message.metadata).toEqual({
      inviteId: 'invite_123',
      template: 'invite_delivery_v1',
      hasInviterDisplayName: true,
      hasCommunityName: true,
    });
    expect(message.idempotencyKey).toBe(
      'notification:invite_delivery:invite_123:delivery_address_ref:invite_delivery_address_456',
    );
    expectSensitiveDataExcluded(message);
  });

  it('builds an introduction coordination notification without raw introduction context', () => {
    const message = buildIntroductionCoordinationNotification({
      introductionId: 'intro_123',
      recipient: identityRecipient,
      coordinatorDisplayName: 'Sam',
      counterpartDisplayName: 'Taylor',
      introductionUrl: 'https://example.test/dashboard/introductions/intro_123',
    });

    expectRequiredFields(message);
    expect(message.category).toBe('introduction_coordination');
    expect(message.textBody).toContain('Sam is coordinating an introduction with Taylor.');
    expect(message.metadata).toEqual({
      introductionId: 'intro_123',
      template: 'introduction_coordination_v1',
      hasCoordinatorDisplayName: true,
      hasCounterpartDisplayName: true,
    });
    expect(message.idempotencyKey).toBe(
      'notification:introduction_coordination:intro_123:identity:identity_123',
    );
    expectSensitiveDataExcluded(message);
  });

  it('builds a follow-up reminder notification with reminder-specific idempotency', () => {
    const message = buildFollowUpReminderNotification({
      introductionId: 'intro_123',
      reminderId: 'reminder_789',
      recipient: identityRecipient,
      introductionUrl: 'https://example.test/dashboard/introductions/intro_123',
      dueAt: '2026-08-01T12:00:00.000Z',
    });

    expectRequiredFields(message);
    expect(message.category).toBe('follow_up_reminder');
    expect(message.textBody).toContain('neutral reminder');
    expect(message.metadata).toEqual({
      introductionId: 'intro_123',
      reminderId: 'reminder_789',
      template: 'follow_up_reminder_v1',
      dueAt: '2026-08-01T12:00:00.000Z',
    });
    expect(message.idempotencyKey).toBe(
      'notification:follow_up_reminder:intro_123:identity:identity_123:reminder_789',
    );
    expectSensitiveDataExcluded(message);
  });

  it('builds an outcome prompt notification with neutral data-entry language', () => {
    const message = buildOutcomePromptNotification({
      introductionId: 'intro_123',
      promptId: 'prompt_abc',
      recipient: identityRecipient,
      outcomeUrl: 'https://example.test/dashboard/introductions/intro_123/outcome',
    });

    expectRequiredFields(message);
    expect(message.category).toBe('outcome_prompt');
    expect(message.textBody).toContain('Please share a brief outcome update');
    expect(message.textBody).toContain('do not add private notes or sensitive personal details');
    expect(message.metadata).toEqual({
      introductionId: 'intro_123',
      promptId: 'prompt_abc',
      template: 'outcome_prompt_v1',
    });
    expect(message.idempotencyKey).toBe(
      'notification:outcome_prompt:intro_123:identity:identity_123:prompt_abc',
    );
    expectSensitiveDataExcluded(message);
  });

  it('requires core identifiers and delivery targets before building a message', () => {
    expect(() =>
      buildInviteDeliveryNotification({
        inviteId: ' ',
        recipient: addressRefRecipient,
        acceptUrl: 'https://example.test/invites/accept',
      }),
    ).toThrow('Invite id is required.');

    expect(() =>
      buildOutcomePromptNotification({
        introductionId: 'intro_123',
        promptId: 'prompt_abc',
        recipient: { type: 'identity', identityId: ' ' },
        outcomeUrl: 'https://example.test/outcome',
      }),
    ).toThrow('Recipient identity id is required.');
  });
});
