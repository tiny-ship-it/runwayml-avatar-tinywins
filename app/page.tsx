import { redirect } from 'next/navigation';
import { auth, signIn, signOut } from '../auth';
import AvatarPage from './AvatarPage';

export default async function Home() {
  const session = await auth();

  // Middleware already redirects unauthenticated requests to /api/auth/signin,
  // but guard here too so TypeScript knows session is defined below.
  if (!session?.user) {
    // Trigger the Google sign-in flow.
    await signIn('google');
    redirect('/'); // unreachable; signIn redirects
  }

  const user = session.user!;
  const tenantId = (session as unknown as Record<string, string>).tenantId;

  return (
    <main className="page">
      <header className="header">
        <div className="header-inner">
          <h1 className="title">Runway Characters Demo</h1>
          <div className="user-bar">
            {user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name ?? 'User avatar'} className="user-avatar" />
            )}
            <span className="user-name">{user.name ?? user.email}</span>
            {/* Sign-out is a server action — must be inside a form */}
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button type="submit" className="signout-btn">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Pass tenantId down to the interactive client component */}
      <AvatarPage tenantId={tenantId} />
    </main>
  );
}
