import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/admin';
const TITLE = 'Admin Panel — CurlyKiddPanel';
const DESC = 'Internal admin tools for managing users, roles, system settings and audit logs on CurlyKiddPanel.';

export const Route = createFileRoute('/admin')({
  component: SpaRoute,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESC },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESC },
      { property: 'og:url', content: URL },
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
});
