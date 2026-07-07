export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      affiliations: {
        Row: {
          affiliation_type: Database['public']['Enums']['affiliation_type'];
          community_id: string;
          created_at: string;
          ends_at: string | null;
          id: string;
          identity_id: string;
          organization: string | null;
          starts_at: string | null;
          title: string | null;
          updated_at: string;
        };
      };
      audit_events: {
        Row: {
          actor_identity_id: string | null;
          community_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          subject_id: string | null;
          subject_table: string;
        };
      };
      communities: {
        Row: {
          created_at: string;
          created_by_identity_id: string | null;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
      };
      invitations: {
        Row: {
          community_id: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          invitee_email: string;
          inviter_identity_id: string | null;
          redeemed_at: string | null;
          redeemed_by_identity_id: string | null;
          redemption_status: Database['public']['Enums']['invite_redemption_status'];
          status: Database['public']['Enums']['invitation_status'];
          token_hash: string;
          updated_at: string;
        };
      };
      privacy_settings: {
        Row: {
          allow_ai_summary: boolean;
          contact_visibility: Database['public']['Enums']['privacy_visibility'];
          created_at: string;
          id: string;
          identity_id: string;
          profile_visibility: Database['public']['Enums']['privacy_visibility'];
          public_meet_page_enabled: boolean;
          resume_visibility: Database['public']['Enums']['privacy_visibility'];
          updated_at: string;
        };
      };
      trusted_identities: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          legal_name: string | null;
          metadata: Json;
          phone: string | null;
          primary_email: string;
          status: Database['public']['Enums']['trusted_identity_status'];
          updated_at: string;
          user_id: string | null;
        };
      };
      user_roles: {
        Row: {
          community_id: string | null;
          created_at: string;
          granted_by_identity_id: string | null;
          id: string;
          identity_id: string;
          role: Database['public']['Enums']['user_role_name'];
          updated_at: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      affiliation_type: 'member' | 'alumni' | 'employee' | 'volunteer' | 'partner' | 'other';
      invitation_status: 'pending' | 'accepted' | 'expired' | 'revoked';
      invite_redemption_status: 'not_redeemed' | 'redeemed' | 'blocked';
      privacy_visibility: 'private' | 'community' | 'stewards';
      trusted_identity_status: 'pending' | 'active' | 'suspended' | 'archived';
      user_role_name: 'member' | 'steward' | 'admin';
    };
    CompositeTypes: Record<string, never>;
  };
}
