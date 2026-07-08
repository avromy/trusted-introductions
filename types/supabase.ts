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
      helper_capabilities: {
        Row: {
          availability_status: Database['public']['Enums']['helper_availability_status'];
          categories: string[];
          community_id: string | null;
          created_at: string;
          geographies: string[];
          id: string;
          identity_id: string;
          industries: string[];
          languages: string[];
          metadata: Json;
          next_available_at: string | null;
          private_notes: string | null;
          updated_at: string;
          weekly_intro_capacity: number;
        };
      };
      introduction_follow_ups: {
        Row: {
          assigned_to_identity_id: string | null;
          created_at: string;
          due_at: string;
          id: string;
          introduction_id: string;
          metadata: Json;
          notes: string | null;
          sent_at: string | null;
          sequence_number: number;
          skipped_reason: string | null;
          status: Database['public']['Enums']['introduction_follow_up_status'];
          updated_at: string;
        };
      };
      introduction_outcomes: {
        Row: {
          created_at: string;
          id: string;
          introduction_id: string;
          metadata: Json;
          met_at: string | null;
          next_steps: string | null;
          outcome_summary: string | null;
          reported_by_identity_id: string | null;
          status: Database['public']['Enums']['introduction_outcome_status'];
          success_score: number | null;
          updated_at: string;
        };
      };
      introductions: {
        Row: {
          canceled_at: string | null;
          community_id: string | null;
          completed_at: string | null;
          consent_requested_at: string | null;
          consented_at: string | null;
          created_at: string;
          helper_identity_id: string;
          id: string;
          introduced_by_identity_id: string | null;
          job_seeker_request_id: string;
          match_suggestion_id: string | null;
          message: string | null;
          metadata: Json;
          responded_at: string | null;
          seeker_identity_id: string;
          sent_at: string | null;
          status: Database['public']['Enums']['introduction_status'];
          subject: string | null;
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
      job_seeker_requests: {
        Row: {
          closed_at: string | null;
          community_id: string | null;
          created_at: string;
          headline: string;
          id: string;
          identity_id: string;
          metadata: Json;
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
          community_id: string | null;
          converted_introduction_id: string | null;
          created_at: string;
          expires_at: string | null;
          helper_capability_id: string | null;
          helper_identity_id: string;
          id: string;
          job_seeker_request_id: string;
          metadata: Json;
          rationale: string | null;
          score: number | null;
          status: Database['public']['Enums']['match_suggestion_status'];
          suggested_by_identity_id: string | null;
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
      steward_match_reviews: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decision_reason: string | null;
          due_at: string | null;
          id: string;
          match_suggestion_id: string;
          metadata: Json;
          status: Database['public']['Enums']['steward_match_review_status'];
          steward_identity_id: string;
          subject_identity_id: string;
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
      helper_availability_status: 'available' | 'limited' | 'unavailable';
      introduction_follow_up_status: 'pending' | 'sent' | 'skipped' | 'canceled';
      introduction_outcome_status: 'pending' | 'positive' | 'neutral' | 'negative' | 'no_response' | 'unknown';
      introduction_status: 'draft' | 'pending_consent' | 'sent' | 'responded' | 'completed' | 'declined' | 'canceled';
      job_seeker_request_status: 'draft' | 'open' | 'paused' | 'matched' | 'closed' | 'withdrawn';
      match_suggestion_status: 'proposed' | 'in_review' | 'approved' | 'rejected' | 'expired' | 'converted';
      invitation_status: 'pending' | 'accepted' | 'expired' | 'revoked';
      invite_redemption_status: 'not_redeemed' | 'redeemed' | 'blocked';
      privacy_visibility: 'private' | 'community' | 'stewards';
      steward_match_review_status: 'pending' | 'approved' | 'rejected' | 'needs_info';
      trusted_identity_status: 'pending' | 'active' | 'suspended' | 'archived';
      user_role_name: 'member' | 'steward' | 'admin';
    };
    CompositeTypes: Record<string, never>;
  };
}
