import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/dashboard';
const TITLE = 'Dashboard — CurlyKiddPanel';
const DESC = 'Your CurlyKiddPanel dashboard with FiveM server lookup, favorites, recent searches and the latest community mods.';

export const Route = createFileRoute('/dashboard')({
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
