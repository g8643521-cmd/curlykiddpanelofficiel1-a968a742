export function renderErrorPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CurlyKiddPanel</title>
    <style>
      html,body{margin:0;min-height:100%;background:#07100f;color:#f8fafc;font-family:Inter,system-ui,sans-serif}
      main{min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center}
      section{max-width:520px}h1{font-size:28px;margin:0 0 12px}p{color:#94a3b8;line-height:1.6}
      a,button{display:inline-flex;margin:8px;padding:12px 18px;border-radius:10px;border:1px solid #1de9c3;background:#1de9c3;color:#04110f;font-weight:700;text-decoration:none;cursor:pointer}
      a.secondary{background:transparent;color:#dbeafe;border-color:#334155}
    </style>
  </head>
  <body>
    <main><section><h1>CurlyKiddPanel</h1><p>The app is restarting. Try refreshing the page.</p><button onclick="location.reload()">Refresh</button><a class="secondary" href="/">Go home</a></section></main>
  </body>
</html>`;
}