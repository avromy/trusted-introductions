export type ProfileVisibility = 'private' | 'members' | 'public';

export type SensitiveFieldVisibility = 'private' | 'introduction' | 'helpers' | 'members' | 'public';

export interface PrivacySettings {
  profileVisibility: ProfileVisibility;
  resumeVisibility: SensitiveFieldVisibility;
  contactVisibility: SensitiveFieldVisibility;
  publicMeetPageEnabled: boolean;
  helperActivityVisible: boolean;
  allowAiSummary: boolean;
}
