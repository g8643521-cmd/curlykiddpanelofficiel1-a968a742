import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import '@/index.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { property: 'og:site_name', content: 'CurlyKiddPanel' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { title: "Lovable App" },
      { property: "og:title", content: "Lovable App" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "description", content: "Cloud Starter Kit simplifies cloud application deployment with pre-configured components." },
      { property: "og:description", content: "Cloud Starter Kit simplifies cloud application deployment with pre-configured components." },
      { name: "twitter:description", content: "Cloud Starter Kit simplifies cloud application deployment with pre-configured components." },
      { name: "twitter:card", content: "summary" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'CurlyKiddPanel',
          url: 'https://curlykiddpanelofficiel1.lovable.app',
        }),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'CurlyKiddPanel',
          url: 'https://curlykiddpanelofficiel1.lovable.app',
        }),
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: SpaRoute,
});

function RootComponent() {
  return (
    <RootDocument>
      <RootErrorBoundary>
        <Outlet />
      </RootErrorBoundary>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SpaRoute() {
  return <div id="spa-root" />;
}
