import { createFileRoute, redirect } from '@tanstack/react-router';

// Backward-compat: redirect old /auth URLs to /login
export const Route = createFileRoute('/auth')({
  beforeLoad: ({ location }) => {
    throw redirect({ to: '/login', search: location.search as never, replace: true });
  },
  component: () => null,
});
