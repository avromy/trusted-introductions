export type ProfileContributionMode = 'job_seeker' | 'helper' | 'both';

export type ProfileRow = {
  id: string;
  identity_id: string;
  display_name: string | null;
  headline: string | null;
  summary: string | null;
  contribution_mode: ProfileContributionMode | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileMutationResult = {
  data: ProfileRow | null;
  error: Error | null;
};

type ProfileLookupResult = {
  data: ProfileRow | null;
  error: Error | null;
};

type ProfileSelectQuery = {
  eq(column: 'identity_id', value: string): {
    maybeSingle(): Promise<ProfileLookupResult>;
  };
};

type ProfileMutationQuery = {
  select(columns?: string): {
    single(): Promise<ProfileMutationResult>;
  };
};

export type ProfilesSupabaseClient = {
  from(table: 'profiles'): {
    select(columns?: string): ProfileSelectQuery;
    upsert(
      payload: Partial<ProfileRow> & Pick<ProfileRow, 'identity_id'>,
      options: { onConflict: 'identity_id' },
    ): ProfileMutationQuery;
    update(payload: Partial<ProfileRow>): {
      eq(column: 'identity_id', value: string): ProfileMutationQuery;
    };
  };
};

export type UpsertProfileInput = {
  identityId: string;
  displayName?: string | null;
  headline?: string | null;
  summary?: string | null;
  contributionMode?: ProfileContributionMode | null;
  completedAt?: string | null;
};

const PROFILE_COLUMNS =
  'id, identity_id, display_name, headline, summary, contribution_mode, completed_at, created_at, updated_at';

function requireIdentityId(identityId: string): void {
  if (identityId.trim().length === 0) {
    throw new Error('Profile identity id is required.');
  }
}

function toProfileUpsertPayload(
  input: UpsertProfileInput,
): Partial<ProfileRow> & Pick<ProfileRow, 'identity_id'> {
  const payload: Partial<ProfileRow> & Pick<ProfileRow, 'identity_id'> = {
    identity_id: input.identityId,
  };

  if ('displayName' in input) {
    payload.display_name = input.displayName ?? null;
  }

  if ('headline' in input) {
    payload.headline = input.headline ?? null;
  }

  if ('summary' in input) {
    payload.summary = input.summary ?? null;
  }

  if ('contributionMode' in input) {
    payload.contribution_mode = input.contributionMode ?? null;
  }

  if ('completedAt' in input) {
    payload.completed_at = input.completedAt ?? null;
  }

  return payload;
}

export async function getProfileByIdentityId(
  supabase: ProfilesSupabaseClient,
  identityId: string,
): Promise<ProfileRow | null> {
  requireIdentityId(identityId);

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('identity_id', identityId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertProfile(
  supabase: ProfilesSupabaseClient,
  input: UpsertProfileInput,
): Promise<ProfileRow> {
  requireIdentityId(input.identityId);

  const { data, error } = await supabase
    .from('profiles')
    .upsert(toProfileUpsertPayload(input), { onConflict: 'identity_id' })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Profile upsert did not return a row.');
  }

  return data;
}

export async function updateProfileContributionMode(
  supabase: ProfilesSupabaseClient,
  identityId: string,
  contributionMode: ProfileContributionMode | null,
): Promise<ProfileRow> {
  requireIdentityId(identityId);

  const { data, error } = await supabase
    .from('profiles')
    .update({ contribution_mode: contributionMode })
    .eq('identity_id', identityId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Profile contribution mode update did not return a row.');
  }

  return data;
}

export async function markProfileComplete(
  supabase: ProfilesSupabaseClient,
  identityId: string,
  completedAt: Date = new Date(),
): Promise<ProfileRow> {
  requireIdentityId(identityId);

  const { data, error } = await supabase
    .from('profiles')
    .update({ completed_at: completedAt.toISOString() })
    .eq('identity_id', identityId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Profile completion update did not return a row.');
  }

  return data;
}
