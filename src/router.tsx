import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    trailingSlash: 'never',
    // Show pending UI quickly so transitions never feel "frozen", but
    // keep it long enough to avoid flash on fast routes.
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
