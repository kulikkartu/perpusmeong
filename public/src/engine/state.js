import { Runtime } from './runtime.js';
import { Resolver } from './resolver.js';

const LS_PREFIX = 'perpusmeong:bookmark:';
const LS_COMMENT_PREFIX = 'perpusmeong:comment:'; // legacy single-note per eventKey
const LS_COMMENT_THREAD_PREFIX = 'perpusmeong:comments:'; // public thread per story/version/event

function makeThreadKey(storyId, version, eventId){
  return `${LS_COMMENT_THREAD_PREFIX}${storyId}:${version}:${eventId}`;
}

export function Store(){
  return {
    loadBookmark(storyId){
      try { return JSON.parse(localStorage.getItem(LS_PREFIX + storyId) || 'null'); } catch { return null; }
    },
    saveBookmark(storyId, snapshot){
      localStorage.setItem(LS_PREFIX + storyId, JSON.stringify(snapshot));
    },
    loadComment(storyId, eventKey){
      try { return localStorage.getItem(`${LS_COMMENT_PREFIX}${storyId}:${eventKey}`) || ''; } catch { return ''; }
    },
    saveComment(storyId, eventKey, text){
      localStorage.setItem(`${LS_COMMENT_PREFIX}${storyId}:${eventKey}`, text || '');
    },

    // Public discussion thread per story_id + version + event_id
    loadCommentThread({ storyId, version, eventId }){
      const key = makeThreadKey(storyId, version, eventId);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { comments: [] };
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || !Array.isArray(data.comments)) return { comments: [] };
        return { comments: data.comments };
      } catch {
        return { comments: [] };
      }
    },
    saveCommentThread({ storyId, version, eventId }, thread){
      const key = makeThreadKey(storyId, version, eventId);
      const safe = (thread && typeof thread === 'object' && Array.isArray(thread.comments))
        ? { comments: thread.comments }
        : { comments: [] };
      localStorage.setItem(key, JSON.stringify(safe));
    },
    initState({ story, chunk, snapshot }){
      // state is single source of truth; must include stage/_step/_branch
      const base = {
        stage: 1,
        _step: 1,
        _branch: 0,
      };

      // variables init: accept several shapes
      const vars = {};
      const v = chunk?.variables;
      if (Array.isArray(v)){
        for (const item of v){
          if (item?.var != null) vars[item.var] = item.initial ?? item.value ?? 0;
          else if (item?.var_id != null) vars[item.var_id] = item.initial ?? item.value ?? 0;
        }
      } else if (v && typeof v === 'object'){
        // map var->initial
        for (const [k,val] of Object.entries(v)) vars[k] = (val && typeof val === 'object') ? (val.initial ?? val.value ?? 0) : val;
      }

      const state = { ...base, ...vars };

      if (snapshot && typeof snapshot === 'object'){
        // trusted restore
        return { ...state, ...snapshot.state };
      }
      return state;
    },
    snapshot(story, state){
      return {
        story_id: story.story_id,
        saved_at: new Date().toISOString(),
        state: { ...state },
      };
    }
  };
}

