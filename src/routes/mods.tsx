import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/mods';
const TITLE = 'FiveM Mods Directory — CurlyKiddPanel';
const DESC = 'Discover, preview and download community FiveM mods, scripts and resources curated by CurlyKiddPanel.';

export const Route = createFileRoute('/mods')({
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
