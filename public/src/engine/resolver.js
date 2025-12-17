import { Runtime } from './runtime.js';

function normalizeMode(type){
  const t = (type || '').toString().trim().toLowerCase();
  if (t === 'ma' || t === 'multiple') return 'ma';
  if (t === 'auto' || t === 'automatic') return 'auto';
  if (t === 'hidden') return 'hidden';
  return 'sa';
}

function byStepThenBranch(a, b){
  const sa = Number(a._step ?? 0);
  const sb = Number(b._step ?? 0);
  if (sa !== sb) return sa - sb;
  const ba = Number(a._branch ?? 0);
  const bb = Number(b._branch ?? 0);
  return ba - bb;
}

export function Resolver(){
  const rt = Runtime();

  function getStages(chunk){
    // chunk.stages may be array or map
    const s = chunk?.stages;
    if (Array.isArray(s)) return s;
    if (s && typeof s === 'object'){
      return Object.values(s);
    }
    return [];
  }

  function getStage(chunk, stageNum){
    const stages = getStages(chunk);
    return stages.find(st => Number(st.stage) === Number(stageNum)) || null;
  }

  function pickEvent(stageObj, state){
    const events = (stageObj?.events || []).slice().sort(byStepThenBranch);
    // 1) Prefer exact match on current _step/_branch when event defines them.
    for (const ev of events){
      if (ev.condition_ir && !rt.evalCondition(ev.condition_ir, state)) continue;

      const evStep = ev._step != null ? Number(ev._step) : null;
      const evBranch = ev._branch != null ? Number(ev._branch) : null;

      // If state defines step/branch, prefer matching when event defines it.
      const stepOk = (evStep === null) ? true : (Number(state._step) === evStep);
      const branchOk = (evBranch === null || Number.isNaN(evBranch)) ? true : (Number(state._branch || 0) === evBranch);
      if (stepOk && branchOk) return ev;
    }

    // 2) If no exact match, pick the first condition-true event at or after current step.
    const curStep = Number(state._step ?? 0);
    for (const ev of events){
      if (ev.condition_ir && !rt.evalCondition(ev.condition_ir, state)) continue;
      const evStep = ev._step != null ? Number(ev._step) : null;
      if (curStep > 0 && evStep !== null && evStep < curStep) continue;
      return ev;
    }

    // 3) Final fallback: first condition-true (even if step is behind)
    for (const ev of events){
      if (!ev.condition_ir || rt.evalCondition(ev.condition_ir, state)) return ev;
    }
    return null;
  }

  function getAvailableOptions(eventObj, state){
    const opts = (eventObj?.options || []).slice();
    return opts.filter(o => !o.condition_ir || rt.evalCondition(o.condition_ir, state));
  }

  function getAnswerMode(eventObj){
    return normalizeMode(eventObj?.type || eventObj?.answer_mode);
  }

  return { getStage, pickEvent, getAvailableOptions, getAnswerMode };
}
