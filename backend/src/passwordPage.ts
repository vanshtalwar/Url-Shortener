const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Self-contained Zelqit password page for a protected short link (no external assets). Pure. */
export function passwordPage(code: string, error?: string): string {
  const action = `/${encodeURIComponent(code)}/unlock`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Protected link · Zelqit</title>
<style>
  :root { --bg:#fafafe; --card:#fff; --text:#14121f; --muted:#5e5a73; --border:#e6e4f2; --danger:#dc2626; }
  @media (prefers-color-scheme: dark) { :root { --bg:#07060b; --card:#0f0d17; --text:#f4f3ff; --muted:#a19fb8; --border:#27233a; --danger:#ef4444; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,sans-serif; }
  main { width:100%; max-width:380px; background:var(--card); border:1px solid var(--border); border-radius:16px; padding:28px; }
  .brand { font-weight:700; font-size:18px; background:linear-gradient(135deg,#8b5cf6,#4f46e5); -webkit-background-clip:text; background-clip:text; color:transparent; }
  h1 { font-size:20px; margin:16px 0 4px; }
  p { color:var(--muted); margin:0 0 20px; font-size:14px; }
  label { display:block; font-size:14px; margin-bottom:6px; }
  input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:transparent; color:inherit; font:inherit; }
  input:focus { outline:2px solid #8b5cf6; outline-offset:1px; }
  button { margin-top:16px; width:100%; padding:10px; border:0; border-radius:10px; font:inherit; font-weight:600; color:#fff; background:linear-gradient(135deg,#8b5cf6,#4f46e5); cursor:pointer; }
  .error { color:var(--danger); margin:12px 0 0; }
</style>
</head>
<body>
<main>
  <div class="brand">Zelqit</div>
  <h1>This link is password protected</h1>
  <p>Enter the password you were given to continue.</p>
  <form method="post" action="${escapeHtml(action)}">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    <button type="submit">Continue</button>
  </form>
</main>
</body>
</html>`;
}
