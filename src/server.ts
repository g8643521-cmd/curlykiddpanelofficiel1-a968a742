import './lib/error-capture';
import { consumeLastCapturedError } from './lib/error-capture';
import { renderErrorPage } from './lib/error-page';

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import('@tanstack/react-start/server-entry').then(
      (module) => (module.default ?? module) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') && !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`SSR error response: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function redirectTrailingSlash(request: Request): Response | undefined {
  const url = new URL(request.url);
  if (url.pathname === '/' || !url.pathname.endsWith('/')) return undefined;

  url.pathname = url.pathname.replace(/\/+$/, '');
  return Response.redirect(url.toString(), 308);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const redirect = redirectTrailingSlash(request);
      if (redirect) return redirect;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
  },
};