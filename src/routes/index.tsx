import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

const URL = 'https://curlykiddpanelofficiel1.lovable.app/';
const TITLE = 'CurlyKiddPanel — FiveM Server Lookup & Player Tracking';
const DESC = 'FiveM toolkit with server analytics, community cheater database, mods directory, coordinate lookup and live player tracking.';

export const Route = createFileRoute('/')({
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
