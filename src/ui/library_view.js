const el = (id) => document.getElementById(id);

export function renderStoryList(stories, onPick){
  const list = el('story-list');
  list.innerHTML = '';
  for (const s of stories){
    const card = document.createElement('article');
    card.className = 'story-card';
    card.tabIndex = 0;
    card.innerHTML = `
      <h3 class="story-card__title">${escapeHtml(s.title || `Story ${s.story_id}`)}</h3>
      <p class="story-card__desc">${escapeHtml(s.description || '')}</p>
    `;
    card.addEventListener('click', () => onPick(s));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') onPick(s); });
    list.appendChild(card);
  }
}

export function openStorySheet(story, { hasBookmark }, { onStart, onContinue }){
  el('sheet-title').textContent = story.title || `Story ${story.story_id}`;
  el('sheet-desc').textContent = story.description || '';
  el('btn-continue').disabled = !hasBookmark;

  el('btn-start').onclick = onStart;
  el('btn-continue').onclick = onContinue;

  el('sheet-backdrop').classList.remove('hidden');
  el('story-sheet').classList.remove('hidden');

  el('sheet-backdrop').onclick = closeStorySheet;
}

export function closeStorySheet(){
  el('sheet-backdrop').classList.add('hidden');
  el('story-sheet').classList.add('hidden');
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
