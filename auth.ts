import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// Emails that map to known tenants. Add more entries as needed.
const EMAIL_TENANT_MAP: Record<string, string> = {
  'patrick@tinywins.com': '053a498b-5fde-45a7-93b5-197f096f037a',
  'patrick.craig@gmail.com': '053a498b-5fde-45a7-93b5-197f096f037a',
};

/** Derive a stable tenantId from an authenticated Google email. */
export function tenantIdFromEmail(email: string): string {
  const known = EMAIL_TENANT_MAP[email.toLowerCase().trim()];
  if (known) return known;
  // Fallback: stable synthetic tenant scoped to the Google account
  return `google-${email.toLowerCase().trim()}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    /**
     * Expose tenantId on the session so both server components and API
     * routes can read it without re-deriving it from the raw email every time.
     */
    session({ session }) {
      if (session.user?.email) {
        (session as unknown as Record<string, unknown>).tenantId =
          tenantIdFromEmail(session.user.email);
      }
      return session;
    },
  },
});
