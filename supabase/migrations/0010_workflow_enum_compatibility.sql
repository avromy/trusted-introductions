alter type public.follow_up_status add value if not exists 'sent' after 'scheduled';
alter type public.introduction_outcome_type add value if not exists 'in_conversation' after 'meeting_scheduled';
alter type public.introduction_outcome_type add value if not exists 'opportunity_created' after 'in_conversation';
