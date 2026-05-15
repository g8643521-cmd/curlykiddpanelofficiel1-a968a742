import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/settings';
const TITLE = 'Settings — CurlyKiddPanel';
const DESC = 'Account, privacy, notification and appearance settings for your CurlyKiddPanel account.';

export const Route = createFileRoute('/settings')({
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
