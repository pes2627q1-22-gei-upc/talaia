import { getAuthClient } from './supabase';

/** El client HTTP obté el token vigent; els ViewModels no el necessiten. */
export async function getAccessToken(): Promise<string | null> {
  const client = getAuthClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}
