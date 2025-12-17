const el = (id) => document.getElementById(id);

export function setTab(name){
  const story = el('view-story');
  const status = el('view-status');
  const tStory = el('tab-story');
  const tStatus = el('tab-status');
  const isStory = name === 'story';

  story.classList.toggle('view--active', isStory);
  status.classList.toggle('view--active', !isStory);

  tStory.classList.toggle('tab--active', isStory);
  tStatus.classList.toggle('tab--active', !isStory);
  tStory.setAttribute('aria-selected', String(isStory));
  tStatus.setAttribute('aria-selected', String(!isStory));
}

export function renderEvent(event, options, { mode, selected }){
  el('event-title').textContent = event.title || '';
  el('event-description').innerHTML = renderParagraphs(event.description || '');

  // options label
  const label = mode === 'ma' ? 'Pilih beberapa' :
                mode === 'auto' ? 'Otomatis' :
                mode === 'hidden' ? '' : 'Pilih satu';
  el('options-label').textContent = label;

  const list = el('options');
  list.innerHTML = '';

  // hide options section for hidden
  el('options-section').classList.toggle('hidden', mode === 'hidden');

  const isInteractive = (mode === 'sa' || mode === 'ma');

  for (const o of options){
    const optId = (o.option ?? o.id ?? o.option_id);
    const k = String(optId);
    const pill = document.createElement('div');
    pill.className = 'option-pill' + (selected.has(k) ? ' option-pill--selected' : '');
    pill.dataset.optId = k;

    const isSel = selected.has(k);
    const markChar = (mode === 'ma') ? (isSel ? '☑' : '☐') : (isSel ? '●' : '○');
    const markCls = 'option-pill__mark' + (mode === 'ma' ? ' option-pill__mark--box' : '');

    pill.innerHTML = `
      <div class="${markCls}" aria-hidden="true">${markChar}</div>
      <div class="option-pill__text">
        <div class="option-pill__title">${escapeHtml(o.title || `Option ${k}`)}</div>
        <p class="option-pill__desc">${escapeHtml(o.description || '')}</p>
      </div>
    `;

    if (isInteractive){
      pill.addEventListener('click', () => {
        window.__PM_ON_TOGGLE_OPTION__?.(optId, o, mode);
      });
    } else {
      // auto mode: show as non-interactive; selection rendered elsewhere
      pill.style.cursor = 'default';
      pill.style.opacity = (mode === 'auto') ? '1' : '0.95';
    }

    list.appendChild(pill);
  }
}

export function renderPreview(selectedOptions){
  const box = el('selected-preview');
  const list = el('preview-list');
  list.innerHTML = '';

  if (!selectedOptions || selectedOptions.length === 0){
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');

  for (const o of selectedOptions){
    const title = (o?.title ?? '').toString();
    const desc = (o?.description ?? '').toString();

    // PDF micro-rules:
    // - "Title — Desc" only if both exist
    // - If only one exists, do not render separator
    const hasTitle = title.trim().length > 0;
    const hasDesc = desc.trim().length > 0;
    if (!hasTitle && !hasDesc) continue;

    const item = document.createElement('div');
    item.className = 'preview__item';

    if (hasTitle && hasDesc){
      item.innerHTML = `<b>${escapeHtml(title)}</b> — ${escapeHtml(desc)}`;
    } else if (hasTitle){
      item.innerHTML = `<b>${escapeHtml(title)}</b>`;
    } else {
      item.innerHTML = `${escapeHtml(desc)}`;
    }
    list.appendChild(item);
  }
}

export function renderStatus(statusData, state, runtime){
  const host = el('status-cards');
  host.innerHTML = '';

  if (!statusData){
    host.innerHTML = `<div class="card"><h3 class="card__title">Status</h3><p class="card__body">Tidak ada data status.</p></div>`;
    return;
  }

  const cards = Array.isArray(statusData) ? statusData : (statusData.cards || statusData.status || []);
  for (const c of cards){
    // show/hide by condition if present
    const cond = c.condition_ir || c.condition || null;
    if (cond && !runtime.evalCondition(cond, state)) continue;

    const title = c.title || c.name || 'Status';
    const desc = c.description || '';
    const varName = c.var || c.var_id || c.value_var || null;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3 class="card__title">${escapeHtml(title)}</h3>
      <p class="card__body">${escapeHtml(desc)}</p>
    `;

    if (varName){
      const val = Number(state[varName] ?? 0);
      const meter = document.createElement('div');
      meter.className = 'card__meter';
      const fill = document.createElement('div');
      const pct = Math.max(0, Math.min(100, (val/10)*100)); // clamp display only
      fill.style.width = pct + '%';
      meter.appendChild(fill);
      card.appendChild(meter);
    }

    host.appendChild(card);
  }
}

function renderParagraphs(text){
  const safe = escapeHtml(String(text)).replace(/\n\n+/g, '\n\n');
  return safe.split(/\n\n/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
