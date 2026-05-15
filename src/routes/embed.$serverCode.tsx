import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

export const Route = createFileRoute('/embed/$serverCode')({
  component: SpaRoute,
  head: ({ params }) => {
    const url = `https://curlykiddpanelofficiel1.lovable.app/embed/${params.serverCode}`;
    const title = `Server Embed ${params.serverCode} — CurlyKiddPanel`;
    const desc = `Live FiveM server status embed for ${params.serverCode}, powered by CurlyKiddPanel.`;
    return {
      meta: [
        { title },
        { name: 'description', content: desc },
        { name: 'robots', content: 'noindex, nofollow' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: desc },
        { property: 'og:url', content: url },
      ],
      links: [{ rel: 'canonical', href: url }],
    };
  },
});
