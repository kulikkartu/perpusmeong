export function ContentLoader({ baseUrl }){
  const cache = new Map();

  const normalizeBase = (u) => String(u || '').replace(/\/+$/, '');
  const base = normalizeBase(baseUrl);

  const isHttp = (p) => /^https?:\/\//i.test(String(p || ''));
  const stripDotSlash = (p) => String(p || '').replace(/^\.\//, '');

  // Join URL segments without duplicating base path (e.g., avoiding content/content/...)
  const joinUrlSafe = (baseUrlStr, ...parts) => {
    const b = normalizeBase(baseUrlStr);
    const bNoDot = stripDotSlash(b);
    const cleaned = parts
      .filter(Boolean)
      .map(p => String(p))
      .map(p => p.replace(/^\/+/, ''));
    if (!cleaned.length) return b;

    // If first part already includes the base (with or without ./), do not prefix base.
    const first = cleaned[0];
    const firstNoDot = stripDotSlash(first);
    if (first.startsWith(b) || first.startsWith(bNoDot) || firstNoDot.startsWith(bNoDot)){
      return [first.replace(/\/+$/, ''), ...cleaned.slice(1)].join('/');
    }

    return [b, ...cleaned].join('/');
  };

  // Resolve a resource path against the story-pack base, supporting absolute and relative paths.
  const resolvePath = (packBase, path) => {
    const p = String(path || '');
    if (!p) return '';
    if (isHttp(p)) return p;
    if (p.startsWith('/')) return p; // root-relative
    return joinUrlSafe(packBase, p);
  };

  const fetchJson = async (url) => {
    const key = String(url);
    if (cache.has(key)) return cache.get(key);
    try {
      const res = await fetch(key, { cache: 'no-store' });
      if (!res.ok){
        const err = new Error(`Failed to fetch ${key}: ${res.status}`);
        err.url = key;
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      cache.set(key, data);
      return data;
    } catch (e){
      // Ensure error always contains the URL for debugging.
      if (e && typeof e === 'object' && !('url' in e)) e.url = key;
      console.error('[ContentLoader] fetchJson error', { url: key, error: e });
      throw e;
    }
  };

  return {
    async loadIndex(){
      return fetchJson(joinUrlSafe(base, 'index.json'));
    },
    async loadManifest(story){
      // story.version_or_hash required by build output
      const ver = story.version_or_hash || story.version || story.hash;
      if (!ver) throw new Error('Missing version_or_hash in story index entry');
      const url = joinUrlSafe(base, 'packs', story.story_id, ver, 'manifest.json');
      const manifest = await fetchJson(url);
      if (!manifest || !Array.isArray(manifest.chunks)){
        const err = new Error('Invalid manifest: missing chunks[]');
        err.url = url;
        console.error('[ContentLoader] manifest schema invalid', { url, manifest });
        throw err;
      }
      return manifest;
    },
    async loadChunk(story, manifest, chunkId){
      // A1 manifest: chunks list and pointers (paths). We support both.
      const ver = story.version_or_hash || story.version || story.hash;
      const packBase = joinUrlSafe(base, 'packs', story.story_id, ver);
      let path = null;

      if (manifest?.chunks && Array.isArray(manifest.chunks)){
        const found = manifest.chunks.find(c => (c.id === chunkId || c.chunk_id === chunkId));
        if (found) path = found.path || found.url || found.file;
      }
      if (!path){
        // default expected name
        path = `${chunkId}.json`;
      }

      const full = resolvePath(packBase, path);
      const chunk = await fetchJson(full);
      if (!chunk || !Array.isArray(chunk.events)){
        const err = new Error('Invalid chunk: missing events[]');
        err.url = full;
        console.error('[ContentLoader] chunk schema invalid', { url: full, chunk });
        throw err;
      }
      return chunk;
    }
  };
}
