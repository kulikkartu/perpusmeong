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
      apiKey: "AIzaSyDdI92XPHbXHWs0aSODXWkmwQ8KvLK9sQo",
      authDomain: "perpusmeong-4e27a.firebaseapp.com",
      projectId: "perpusmeong-4e27a",
      storageBucket: "perpusmeong-4e27a.firebasestorage.app",
      messagingSenderId: "619308159928",
      appId: "1:619308159928:web:34742472ea6ab96dfbf54d"
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
