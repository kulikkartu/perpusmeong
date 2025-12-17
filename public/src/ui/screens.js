const el = (id) => document.getElementById(id);

function ensureErrorCard(){
  const host = el('view-story');
  if (!host) return null;
  let card = document.getElementById('load-error-card');
  if (card) return card;

  card = document.createElement('article');
  card.id = 'load-error-card';
  // Reuse "letter" styling (already exists in app.css for the landing letter).
  card.className = 'letter';
  card.style.marginTop = '16px';
  card.innerHTML = `
    <header class="letter__header">
      <h2 class="letter__code" style="font-size: 20px;">Gagal memuat</h2>
    </header>
    <div class="letter__body">
      <p id="load-error-msg"></p>
      <p class="hint" id="load-error-detail"></p>
    </div>
    <footer class="letter__footer" style="display:flex; gap:10px;">
      <button id="btn-load-error-back" class="btn btn--primary" type="button">Kembali</button>
    </footer>
  `;
  host.prepend(card);
  return card;
}

export function showLanding(){ /* DOM already present */ }
export function showLibrary(){ /* DOM already present */ }
export function showReader(){ /* DOM already present */ }

export function hideLoadError(){
  const card = document.getElementById('load-error-card');
  if (card) card.remove();
}

export function showLoadError({ message, detail, onBack }){
  const card = ensureErrorCard();
  if (!card) return;

  const msg = document.getElementById('load-error-msg');
  const det = document.getElementById('load-error-detail');
  if (msg) msg.textContent = message || 'Terjadi kesalahan saat memuat konten.';
  if (det) det.textContent = detail || '';

  const backBtn = document.getElementById('btn-load-error-back');
  if (backBtn){
    backBtn.onclick = () => {
      try { onBack && onBack(); } finally { hideLoadError(); }
    };
  }

  // Hide normal reader sections to avoid blank/confusing state.
  const hideIds = ['options-section','selected-preview','comments'];
  for (const id of hideIds){
    const node = el(id);
    if (node) node.classList.add('hidden');
  }
  const nextBtn = el('btn-next');
  if (nextBtn) nextBtn.disabled = true;
}
