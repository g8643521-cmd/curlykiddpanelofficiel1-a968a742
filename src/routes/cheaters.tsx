import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/cheaters';
const TITLE = 'Cheater Database — CurlyKiddPanel';
const DESC = 'Browse the community-reported FiveM cheater database with player history, evidence and server activity.';

export const Route = createFileRoute('/cheaters')({
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
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: TITLE,
          description: DESC,
          url: URL,
        }),
      },
    ],
  }),
});
