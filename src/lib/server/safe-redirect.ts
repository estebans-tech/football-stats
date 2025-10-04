export function safeRedirect(url: URL, fallback = '/'): string {
    const to = url.searchParams.get('redirectTo') ?? '';
  
    // tomt -> fallback
    if (!to) return fallback;
  
    // Gör absolut mot samma origin, kastar på ogiltig
    let dest: URL;
    try {
      dest = new URL(to, url.origin);
    } catch {
      return fallback;
    }
  
    // Blockera andra origins
    if (dest.origin !== url.origin) return fallback;
  
    // Tillåt bara absoluta, interna paths
    if (!dest.pathname.startsWith('/')) return fallback;
  
    // (Valfritt) allow-lista specifika rutter
    // const ALLOWED = new Set([
    //   '/', '/players', '/sessions', '/invite', '/settings'
    // ]);
    // if (!ALLOWED.has(dest.pathname)) return fallback;
  
    // returnera path + ev. query/hash
    return dest.pathname + dest.search + dest.hash;
  }