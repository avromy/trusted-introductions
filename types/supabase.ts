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
      helper_capabilities: {
        Row: {
          availability_status: 'available' | 'limited' | 'unavailable';
          categories: Array<
            | 'career_navigation'
            | 'resume_review'
            | 'interview_practice'
            | 'network_introduction'
            | 'industry_insight'
            | 'portfolio_review'
            | 'accountability'
            | 'resource_navigation'
          >;
          created_at: string;
          geographies: string[];
          id: string;
          identity_id: string;
          industries: string[];
          languages: string[];
          next_available_at: string | null;
          private_notes: string | null;
          updated_at: string;
          weekly_intro_capacity: number;
        };
      };
      job_seeker_requests: {
        Row: {
          closed_at: string | null;
          created_at: string;
          headline: string;
          id: string;
          identity_id: string;
          notes: string | null;
          opened_at: string | null;
          remote_preference: string | null;
          resume_url: string | null;
          salary_expectation: string | null;
          status: Database['public']['Enums']['job_seeker_request_status'];
          target_companies: string[];
          target_locations: string[];
          target_role: string;
          updated_at: string;
          work_authorization: string | null;
        };
      };
      match_suggestions: {
        Row: {
          created_at: string;
          helper_capability_id: string;
          helper_identity_id: string;
          id: string;
          metadata: Json;
          rank: number;
          reasons: string[];
          request_id: string;
          score: number;
          updated_at: string;
        };
      };
      steward_reviews: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decision_reason: string | null;
          id: string;
          match_suggestion_id: string | null;
          request_id: string;
          status: Database['public']['Enums']['steward_review_status'];
          steward_identity_id: string;
          subject_identity_id: string;
          updated_at: string;
        };
      };
      privacy_settings: {
        Row: {
          allow_ai_summary: boolean;
          contact_visibility: Database['public']['Enums']['privacy_visibility'];
          created_at: string;
          id: string;
          helper_activity_visible: boolean;
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
      job_seeker_request_status: 'draft' | 'open' | 'paused' | 'matched' | 'closed' | 'withdrawn';
      invite_redemption_status: 'not_redeemed' | 'redeemed' | 'blocked';
      privacy_visibility: 'private' | 'community' | 'stewards';
      steward_review_status: 'pending' | 'approved' | 'rejected' | 'needs_info';
      trusted_identity_status: 'pending' | 'active' | 'suspended' | 'archived';
      user_role_name: 'member' | 'steward' | 'admin';
    };
    CompositeTypes: Record<string, never>;
  };
}
