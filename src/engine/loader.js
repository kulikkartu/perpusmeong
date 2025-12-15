export function ContentLoader({ baseUrl }){
  const cache = new Map();

  const fetchJson = async (path) => {
    if (cache.has(path)) return cache.get(path);
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    const data = await res.json();
    cache.set(path, data);
    return data;
  };

  return {
    async loadIndex(){
      return fetchJson(`${baseUrl}/index.json`);
    },
    async loadManifest(story){
      // story.version_or_hash required by build output
      const ver = story.version_or_hash || story.version || story.hash;
      if (!ver) throw new Error('Missing version_or_hash in story index entry');
      return fetchJson(`${baseUrl}/packs/${story.story_id}/${ver}/manifest.json`);
    },
    async loadChunk(story, manifest, chunkId){
      // A1 manifest: chunks list and pointers (paths). We support both.
      const ver = story.version_or_hash || story.version || story.hash;
      const base = `${baseUrl}/packs/${story.story_id}/${ver}`;
      let path = null;

      if (manifest?.chunks && Array.isArray(manifest.chunks)){
        const found = manifest.chunks.find(c => (c.id === chunkId || c.chunk_id === chunkId));
        if (found) path = found.path || found.url || found.file;
      }
      if (!path){
        // default expected name
        path = `${chunkId}.json`;
      }
      const full = path.startsWith('http') ? path : `${base}/${path}`;
      return fetchJson(full);
    }
  };
}
