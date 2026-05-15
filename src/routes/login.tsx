import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/login';
const TITLE = 'Sign In — CurlyKiddPanel';
const DESC = 'Sign in or create a CurlyKiddPanel account to access FiveM tools, dashboards and the cheater database.';

export const Route = createFileRoute('/login')({
  component: SpaRoute,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESC },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESC },
      { property: 'og:url', content: URL },
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
});
