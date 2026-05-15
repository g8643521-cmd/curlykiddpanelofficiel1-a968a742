import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/moderator';
const TITLE = 'Moderator Panel — CurlyKiddPanel';
const DESC = 'Moderator tools for reviewing reports, handling cheater submissions and keeping the CurlyKiddPanel community safe.';

export const Route = createFileRoute('/moderator')({
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
