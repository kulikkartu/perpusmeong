// Firebase Auth (Google) via CDN modules.
// You MUST fill firebaseConfig with your project credentials.
export function Auth(){
  let app = null;
  let auth = null;
  let provider = null;
  const listeners = new Set();

  async function ensure(){
    if (auth) return;
    // Dynamic import from Firebase CDN (no build step)
    const fbApp = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const fbAuth = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');

    // TODO: Replace with your Firebase config
    const firebaseConfig = window.__FIREBASE_CONFIG__ || {
      apiKey: "REPLACE_ME",
      authDomain: "REPLACE_ME",
      projectId: "REPLACE_ME",
      appId: "REPLACE_ME",
    };

    app = fbApp.initializeApp(firebaseConfig);
    auth = fbAuth.getAuth(app);
    provider = new fbAuth.GoogleAuthProvider();

    fbAuth.onAuthStateChanged(auth, (user) => {
      for (const fn of listeners) fn(user);
    });
  }

  return {
    onAuthStateChanged(fn){
      listeners.add(fn);
      ensure().catch(console.error);
      return () => listeners.delete(fn);
    },
    async signInWithGoogle(){
      await ensure();
      const fbAuth = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
      await fbAuth.signInWithPopup(auth, provider);
    },
    async signOut(){
      await ensure();
      const fbAuth = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
      await fbAuth.signOut(auth);
    }
  };
}
