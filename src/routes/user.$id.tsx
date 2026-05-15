import { createFileRoute } from '@tanstack/react-router';
import { SpaRoute } from './-SpaRoute';

export const Route = createFileRoute('/user/$id')({
  component: SpaRoute,
  head: ({ params }) => {
    const url = `https://curlykiddpanelofficiel1.lovable.app/user/${params.id}`;
    const title = `User Profile — CurlyKiddPanel`;
    const desc = `View the public CurlyKiddPanel profile, achievements and activity for user ${params.id}.`;
    return {
      meta: [
        { title },
        { name: 'description', content: desc },
        { property: 'og:title', content: title },
        { property: 'og:description', content: desc },
        { property: 'og:url', content: url },
        { property: 'og:type', content: 'profile' },
      ],
      links: [{ rel: 'canonical', href: url }],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: `User ${params.id}`,
            url,
          }),
        },
      ],
    };
  },
});
