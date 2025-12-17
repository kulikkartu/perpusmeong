import { showLanding, showLibrary, showReader, showLoadError, hideLoadError } from './ui/screens.js';
import { Auth } from './engine/auth.js';
import { ContentLoader } from './engine/loader.js';
import { Store } from './engine/state.js';
import { ReaderController } from './ui/reader.js';
import { LibraryController } from './ui/library.js';

const el = (id) => document.getElementById(id);

const ui = {
  screens: {
    landing: el('screen-landing'),
    library: el('screen-library'),
    reader: el('screen-reader'),
  },
  loginBtn: el('btn-login'),
  logoutBtn: el('btn-logout'),
  userLine: el('user-line'),
  loginHint: el('login-hint'),
};

function setScreen(name){
  for (const [k, node] of Object.entries(ui.screens)){
    node.classList.toggle('screen--active', k === name);
  }
}

const app = {
  auth: Auth(),
  loader: ContentLoader({ baseUrl: './content' }),
  store: Store(),
  currentStory: null,
  controllers: {},
};

async function boot(){
  setScreen('landing');
  showLanding();

  // Auth events
  ui.loginBtn.addEventListener('click', async () => {
    ui.loginHint.textContent = '';
    try {
      await app.auth.signInWithGoogle();
    } catch (e){
      ui.loginHint.textContent = String(e?.message || e);
    }
  });
  ui.logoutBtn.addEventListener('click', async () => {
    await app.auth.signOut();
  });

  app.auth.onAuthStateChanged(async (user) => {
    if (!user){
      app.currentStory = null;
      setScreen('landing');
      return;
    }
    ui.userLine.textContent = user.displayName ? `Masuk sebagai ${user.displayName}` : `Masuk`;
    setScreen('library');

    // Library controller (loads index.json and opens story sheet)
    if (!app.controllers.library){
      app.controllers.library = LibraryController({
        loader: app.loader,
        store: app.store,
        onOpenStory: async (story) => {
          app.currentStory = story;
        },
        onStart: async (story) => {
          await startStory(story, { mode: 'new' });
        },
        onContinue: async (story) => {
          await startStory(story, { mode: 'continue' });
        },
      });
    }
    await app.controllers.library.mount();
  });
}

async function startStory(story, { mode }){
  try {
    hideLoadError();

    // Load content pack (manifest + chunk_000) into memory
    const manifest = await app.loader.loadManifest(story);
    const chunk = await app.loader.loadChunk(story, manifest, 'chunk_000');

    // Init state
    const snapshot = (mode === 'continue') ? app.store.loadBookmark(story.story_id) : null;
    const state = app.store.initState({ story, chunk, snapshot });

    // Reader controller
    if (!app.controllers.reader){
      app.controllers.reader = ReaderController({
        loader: app.loader,
        store: app.store,
        onExit: () => {
          setScreen('library');
        }
      });
    }
    setScreen('reader');
    showReader();
    await app.controllers.reader.mount({ story, manifest, chunk, state });
  } catch (e){
    // Ensure UI never blank/freeze on missing manifest/chunk or bad schema.
    console.error('[App] startStory failed', e);
    setScreen('reader');
    showReader();
    showLoadError({
      message: 'Gagal memuat',
      detail: (e?.url ? `${e.url}` : '') || String(e?.message || e),
      onBack: () => setScreen('library'),
    });
  }
}

boot();
