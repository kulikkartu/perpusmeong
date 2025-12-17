import { Resolver } from '../engine/resolver.js';
import { Runtime } from '../engine/runtime.js';
import { renderEvent, renderPreview, renderStatus, setTab } from './reader_view.js';

const el = (id) => document.getElementById(id);

export function ReaderController({ loader, store, onExit }){
  const resolver = Resolver();
  const rt = Runtime();

  let ctx = null;
  let selection = new Set(); // option ids
  let selectionOrder = [];   // preserve click order (MA) and last chosen (SA)
  let activeEventKey = null;
  let activeEventId = null;

  function commentCtx(){
    const version = ctx.story.version_or_hash || 'v1';
    const eventId = activeEventId || activeEventKey || 'unknown';
    return { storyId: ctx.story.story_id, version, eventId };
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function uid(){
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  }

  function renderComments(){
    const list = el('comments-list');
    if (!list) return;
    const { storyId, version, eventId } = commentCtx();
    const thread = store.loadCommentThread({ storyId, version, eventId });
    const comments = thread.comments || [];

    list.innerHTML = '';
    for (const c of comments){
      const card = document.createElement('div');
      card.className = 'comment';
      card.dataset.cid = c.id;

      const when = c.created_at ? new Date(c.created_at).toLocaleString() : '';
      const likes = Number(c.likes || 0);
      card.innerHTML = `
        <div class="comment__meta">
          <span class="comment__author">${escapeHtml(c.author || 'Anon')}</span>
          <span class="comment__time">${escapeHtml(when)}</span>
        </div>
        <p class="comment__body">${escapeHtml(c.body || '')}</p>
        <div class="comment__actions">
          <button class="comment__btn" data-act="like" type="button">Like (${likes})</button>
          <button class="comment__btn" data-act="reply" type="button">Reply</button>
        </div>
        <div class="comment__replies" aria-label="Balasan"></div>
      `;

      const repliesHost = card.querySelector('.comment__replies');
      const replies = Array.isArray(c.replies) ? c.replies : [];
      for (const r of replies){
        const rEl = document.createElement('div');
        rEl.className = 'reply';
        const rWhen = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        rEl.innerHTML = `
          <div class="comment__meta">
            <span class="comment__author">${escapeHtml(r.author || 'Anon')}</span>
            <span class="comment__time">${escapeHtml(rWhen)}</span>
          </div>
          <p class="comment__body">${escapeHtml(r.body || '')}</p>
        `;
        repliesHost.appendChild(rEl);
      }

      // actions
      card.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const act = t.dataset.act;
        if (!act) return;
        e.preventDefault();

        if (act === 'like'){
          c.likes = Number(c.likes || 0) + 1;
          store.saveCommentThread({ storyId, version, eventId }, { comments });
          renderComments();
        }

        if (act === 'reply'){
          // one-level reply composer
          const existing = card.querySelector('[data-reply-composer="1"]');
          if (existing) return;

          const wrap = document.createElement('div');
          wrap.dataset.replyComposer = '1';
          wrap.style.marginTop = '8px';
          wrap.innerHTML = `
            <input class="comments__author" type="text" placeholder="Nama (opsional)" />
            <textarea class="comments__box" rows="3" placeholder="Tulis balasan..."></textarea>
            <div class="comments__actions">
              <button class="btn btn--secondary" type="button" data-act="send-reply">Kirim</button>
            </div>
          `;
          repliesHost.prepend(wrap);

          const sendBtn = wrap.querySelector('[data-act="send-reply"]');
          sendBtn?.addEventListener('click', () => {
            const a = wrap.querySelector('input');
            const b = wrap.querySelector('textarea');
            const author = (a && a.value || '').trim() || 'Anon';
            const body = (b && b.value || '').trim();
            if (!body) return;
            const reply = { id: uid(), author, body, created_at: nowIso() };
            if (!Array.isArray(c.replies)) c.replies = [];
            c.replies.push(reply);
            store.saveCommentThread({ storyId, version, eventId }, { comments });
            renderComments();
          });
        }
      });

      list.appendChild(card);
    }
  }

  function makeEventKey(event){
    return `${ctx.state.stage}:${event?._step ?? ''}:${event?._branch ?? ''}:${event?.id ?? event?.title ?? ''}`;
  }

  function ensureProgress(prev){
    const prevStage = Number(prev.stage);
    const prevStep = Number(prev.step);
    const curStage = Number(ctx.state.stage);
    const curStep = Number(ctx.state._step);

    // Only auto-advance within the same stage, and only when step remains unchanged.
    // Respect explicit flow control (stage change, _step=0, or any effect that alters _step).
    if (prevStage === curStage && prevStep > 0 && curStep === prevStep){
      ctx.state._step = prevStep + 1;
    }
  }

  function wireUi(){
    el('btn-back').onclick = () => onExit?.();

    el('tab-story').onclick = () => { setTab('story'); refresh(); };
    el('tab-status').onclick = () => { setTab('status'); refreshStatus(); };

    el('btn-bookmark').onclick = () => {
      const snap = store.snapshot(ctx.story, ctx.state);
      store.saveBookmark(ctx.story.story_id, snap);
      // no toast UI; keep silent/minimal
    };

    el('btn-comment').onclick = () => {
      el('comments').classList.remove('hidden');
      // load thread for current event (public discussion)
      renderComments();
    };
    el('btn-close-comments').onclick = () => {
      el('comments').classList.add('hidden');
    };

    el('btn-post-comment').onclick = () => {
      const { storyId, version, eventId } = commentCtx();
      const thread = store.loadCommentThread({ storyId, version, eventId });
      const comments = thread.comments || [];
      const author = (el('comment-author')?.value || '').trim() || 'Anon';
      const body = (el('comment-body')?.value || '').trim();
      if (!body) return;
      comments.push({ id: uid(), author, body, created_at: nowIso(), likes: 0, replies: [] });
      store.saveCommentThread({ storyId, version, eventId }, { comments });
      if (el('comment-body')) el('comment-body').value = '';
      renderComments();
    };

    el('btn-next').onclick = () => advance();
  }

  async function mount({ story, manifest, chunk, state }){
    ctx = { story, manifest, chunk, state };
    document.getElementById('reader-story-title').textContent = story.title || `Story ${story.story_id}`;
    wireUi();
    refresh();
  }

  function current(){
    const st = resolver.getStage(ctx.chunk, ctx.state.stage);
    if (!st) return { stage: null, event: null, options: [] };
    const ev = resolver.pickEvent(st, ctx.state);
    if (!ev) return { stage: st, event: null, options: [] };
    const opts = resolver.getAvailableOptions(ev, ctx.state);
    return { stage: st, event: ev, options: opts };
  }

  function refresh(){
    const { event, options } = current();

    if (!event){
      // No event found => end
      renderEvent({ title: 'Selesai', description: 'Tidak ada event yang valid.' }, [], { mode:'sa', selected: new Set() });
      el('btn-next').disabled = true;
      return;
    }

    const mode = resolver.getAnswerMode(event);
    const nextKey = makeEventKey(event);
    if (nextKey !== activeEventKey){
      selection = new Set(); // reset only when event changes
      selectionOrder = [];
      activeEventKey = nextKey;
      activeEventId = String(event.id ?? event.title ?? nextKey);
      // keep comment panel in sync if open
      if (!el('comments').classList.contains('hidden')) renderComments();
    }

    // Hidden mode: do not render event; execute automatically and move forward until non-hidden or stop.
    if (mode === 'hidden'){
      processAutoEvent(event, options);
      // loop: after effects may change stage/_step; keep resolving until not hidden
      return refresh();
    }

    renderEvent(event, options, { mode, selected: selection });

    // Auto mode: no input; execute all available options, show as "selected", Next advances immediately on click Next.
    if (mode === 'auto'){
      selection = new Set(options.map(o => o.option ?? o.id ?? o.option_id).filter(v => v!=null).map(v=>String(v)));
      // Auto preview: show all executed options in their defined order.
      renderPreview(options.filter(o => selection.has(String(o.option ?? o.id ?? o.option_id))));
      el('btn-next').disabled = false;
    } else {
      renderPreview([]);
      // SA requires exactly 1 selected to enable next
      el('btn-next').disabled = (mode === 'sa' && options.length > 0);
    }

    refreshStatus(); // keep status in sync
  }

  function refreshStatus(){
    renderStatus(ctx.chunk?.status, ctx.state, rt);
  }

  function onToggleOption(optId, optObj, mode){
    const k = String(optId);
    if (mode === 'sa'){
      selection.clear();
      selection.add(k);
      selectionOrder = [k];
    } else if (mode === 'ma'){
      if (selection.has(k)){
        selection.delete(k);
        selectionOrder = selectionOrder.filter(x => x !== k);
      } else {
        selection.add(k);
        selectionOrder.push(k);
      }
    }

    // Re-render options so SA unselects others and marker icons stay consistent.
    const { event, options } = current();
    if (event){
      renderEvent(event, options, { mode, selected: selection });
      // Preview order rules:
      // - SA: max 1 (selected)
      // - MA: order follows click order (selectionOrder)
      // Only include currently valid options.
      const byId = new Map(options.map(o => [String(o.option ?? o.id ?? o.option_id), o]));
      const ordered = (mode === 'ma')
        ? selectionOrder.map(id => byId.get(id)).filter(Boolean)
        : options.filter(o => selection.has(String(o.option ?? o.id ?? o.option_id))).slice(0, 1);
      renderPreview(ordered);
      // SA must have exactly 1 if options exist. MA can be empty / 1+.
      el('btn-next').disabled = (mode === 'sa' && options.length > 0 && selection.size !== 1);
    }
  }

  function advance(){
    const { event, options } = current();
    if (!event) return;

    const mode = resolver.getAnswerMode(event);

    if (mode === 'auto'){
      processAutoEvent(event, options);
      return refresh();
    }

    if (mode === 'sa' && options.length > 0 && selection.size !== 1) return;

    const prev = { stage: ctx.state.stage, step: ctx.state._step };

    // apply event-level effects first
    rt.applyEffects(event.effect_ir || [], ctx.state);

    // apply selected option effects
    const selectedOpts = options.filter(o => selection.has(String(o.option ?? o.id ?? o.option_id)));
    for (const o of selectedOpts){
      rt.applyEffects(o.effect_ir || [], ctx.state);
    }

    // step progression: if effects didn't change _step, advance by 1 to avoid getting stuck.
    ensureProgress(prev);

    refresh();
  }

  function processAutoEvent(event, options){
    const prev = { stage: ctx.state.stage, step: ctx.state._step };
    // event-level effects
    rt.applyEffects(event.effect_ir || [], ctx.state);
    // execute all available options
    for (const o of options){
      rt.applyEffects(o.effect_ir || [], ctx.state);
    }
    // If effects didn't change _step, advance by 1 to avoid infinite loop
    ensureProgress(prev);
  }

  // expose hook for view to call onToggleOption
  window.__PM_ON_TOGGLE_OPTION__ = onToggleOption;

  return { mount };
}

function escapeHtml(str){
  return String(str).replace(/[&<>'"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
