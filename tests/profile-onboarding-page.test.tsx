import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <section className={className}>{children}</section>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/app/onboarding/_components/onboarding-shell', () => ({
  OnboardingShell: ({ children }: React.PropsWithChildren) => <main>{children}</main>,
}));

import ProfileOnboardingPage from '@/app/onboarding/profile/page';

describe('ProfileOnboardingPage', () => {
  it('renders production-ready labels, helper text, and completion guidance', () => {
    const markup = renderToStaticMarkup(<ProfileOnboardingPage />);

    expect(markup).toContain('Display name');
    expect(markup).toContain('Use the name members should recognize');
    expect(markup).toContain('Location');
    expect(markup).toContain('Share a city, region, remote preference, or time zone');
    expect(markup).toContain('Completion guidance');
    expect(markup).toContain('Saving this step marks your profile setup complete');
    expect(markup).toContain('We save only the supported profile fields shown here.');
  });

  it('renders invalid submission errors and successful submission guidance', () => {
    const errorMarkup = renderToStaticMarkup(
      <ProfileOnboardingPage
        searchParams={{ error: 'Display name must be at least 2 characters.' }}
      />,
    );
    const savedMarkup = renderToStaticMarkup(
      <ProfileOnboardingPage searchParams={{ saved: '1' }} />,
    );

    expect(errorMarkup).toContain('We could not save your profile.');
    expect(errorMarkup).toContain('Display name must be at least 2 characters.');
    expect(errorMarkup).toContain('role="alert"');
    expect(savedMarkup).toContain('Profile details saved.');
    expect(savedMarkup).toContain('continue to privacy settings');
  });
});
