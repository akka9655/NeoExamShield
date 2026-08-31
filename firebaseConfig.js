// Firebase Configuration for NeoExamShield
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM",
  authDomain: "neoshield.firebaseapp.com",
  projectId: "neoshield",
  storageBucket: "neoshield.firebasestorage.app",
  messagingSenderId: "915254763807",
  appId: "1:915254763807:web:4a29c05127252586e1d02a"
};

// Expose globally for browser and extension
if (typeof window !== 'undefined') {
  window.FIREBASE_CONFIG = FIREBASE_CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FIREBASE_CONFIG;
}
