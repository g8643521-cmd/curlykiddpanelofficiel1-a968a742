import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/cheater-search';
const TITLE = 'Cheater Search — CurlyKiddPanel';
const DESC = 'Search the FiveM cheater database by name, license, Discord ID or Steam ID to spot known offenders.';

export const Route = createFileRoute('/cheater-search')({
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
