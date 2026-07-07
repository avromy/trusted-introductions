export const USER_ROLE_VALUES = ['job_seeker', 'helper', 'both', 'steward', 'admin'] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];

export const INVITE_STATUS_VALUES = ['pending', 'redeemed', 'expired', 'revoked'] as const;

export type InviteStatus = (typeof INVITE_STATUS_VALUES)[number];

export type TrustedIdentityStatus = 'active' | 'inactive' | 'suspended';

export interface TrustedIdentity {
  id: string;
  primaryEmail: string;
  displayName: string;
  legalName?: string | null;
  phone?: string | null;
  communityAffiliation?: string | null;
  status: TrustedIdentityStatus;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
}

export interface Invite {
  id: string;
  inviterIdentityId: string;
  inviteeEmail: string;
  status: InviteStatus;
  expiresAt: string;
  redeemedByIdentityId?: string | null;
  createdAt: string;
  redeemedAt?: string | null;
}

export interface Community {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Affiliation {
  id: string;
  identityId: string;
  communityId: string;
  role: UserRole;
  label?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ResumeVisibility = 'private' | 'stewards' | 'helpers' | 'matched_helpers';
export type ProfileVisibility = 'private' | 'community' | 'matched_helpers';
export type ContactVisibility = 'private' | 'stewards' | 'matched_helpers';

export interface PrivacySettings {
  id: string;
  identityId: string;
  resumeVisibility: ResumeVisibility;
  profileVisibility: ProfileVisibility;
  contactVisibility: ContactVisibility;
  publicMeetPageEnabled: boolean;
  allowAiSummary: boolean;
  updatedAt: string;
}

export interface AuditEvent<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  actorIdentityId?: string | null;
  eventType: string;
  subjectTable: string;
  subjectId: string;
  metadata: TMetadata;
  createdAt: string;
}

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLE_VALUES as readonly string[]).includes(value);
}

export function isInviteStatus(value: string): value is InviteStatus {
  return (INVITE_STATUS_VALUES as readonly string[]).includes(value);
}
