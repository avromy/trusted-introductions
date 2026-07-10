import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function htmlIncludesNavigationAction(markup: string, label: string): boolean {
  return markup.includes(`>${label} →</a>`);
}

export function selectValue(markup: string, name: string): string | null {
  const selectMatch = markup.match(new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`));
  if (!selectMatch) return null;
  const optionMatch = selectMatch[1].match(/<option[^>]*value="([^"]+)"[^>]*selected=""/);
  return optionMatch?.[1] ?? null;
}

export function checkboxChecked(markup: string, name: string): boolean {
  const match = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  return Boolean(match?.[0].includes('checked=""'));
}

export async function renderPage(node: React.ReactNode | Promise<React.ReactNode>): Promise<string> {
  return renderToStaticMarkup(<>{await node}</>);
}

export const e2eNow = new Date('2026-01-15T00:00:00.000Z');

export function inviteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e2e-invite',
    invitee_email: 'invitee@example.com',
    community_id: 'community-e2e',
    expires_at: '2099-01-01T00:00:00.000Z',
    redeemed_at: null,
    redemption_status: 'pending',
    status: 'pending',
    token_hash: '',
    ...overrides,
  };
}
