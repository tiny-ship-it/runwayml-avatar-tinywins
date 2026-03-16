export { auth as middleware } from './auth';

export const config = {
  // Protect everything EXCEPT Next.js internals and Auth.js's own routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
