import { Resolver } from '../engine/resolver.js';
import { Runtime } from '../engine/runtime.js';
import { renderEvent, renderPreview, renderStatus, setTab } from './reader_view.js';

const el = (id) => document.getElementById(id);

export function ReaderController({ loader, store, onExit }){
  const resolver = Resolver();
  const rt = Runtime();

  let ctx = null;
  let selection = new Set(); // option ids
  let activeEventKey = null;

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
      el('comment-box').value = store.loadComment(ctx.story.story_id, activeEventKey);
    };
    el('btn-close-comments').onclick = () => {
      el('comments').classList.add('hidden');
    };
    el('btn-save-comment').onclick = () => {
      store.saveComment(ctx.story.story_id, activeEventKey, el('comment-box').value);
      el('comments').classList.add('hidden');
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
      activeEventKey = nextKey;
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
    if (mode === 'sa'){
      selection.clear();
      selection.add(String(optId));
    } else if (mode === 'ma'){
      const k = String(optId);
      if (selection.has(k)) selection.delete(k);
      else selection.add(k);
    }
    // preview update
    renderPreview([optObj]);
    el('btn-next').disabled = (mode === 'sa' && selection.size !== 1);
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
