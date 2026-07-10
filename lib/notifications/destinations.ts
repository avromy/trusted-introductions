export type NotificationDestinationClient = {
  from(table: 'trusted_identities'): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: { primary_email: string | null; status: string } | null; error: { message?: string } | null }>;
      };
    };
  };
};

const IDENTITY_DESTINATION = /^identity:([^:]+):primary_email$/;

export async function resolveNotificationDestination(
  destinationRef: string,
  client: NotificationDestinationClient,
): Promise<string> {
  const normalized = destinationRef.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return normalized;

  const match = IDENTITY_DESTINATION.exec(destinationRef.trim());
  if (!match) throw new Error('notification_destination_invalid');

  const { data, error } = await client
    .from('trusted_identities')
    .select('primary_email,status')
    .eq('id', match[1])
    .maybeSingle();

  if (error) throw new Error('notification_destination_lookup_failed');
  if (!data || data.status !== 'active' || !data.primary_email) {
    throw new Error('notification_destination_unavailable');
  }

  const email = data.primary_email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('notification_destination_invalid');
  return email;
}
