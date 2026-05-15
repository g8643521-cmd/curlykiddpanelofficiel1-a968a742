import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/profile';
const TITLE = 'My Profile — CurlyKiddPanel';
const DESC = 'Manage your CurlyKiddPanel profile: avatar, banner, achievements, activity and personal stats.';

export const Route = createFileRoute('/profile')({
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
