import 'react-native-url-polyfill/auto';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBryXnIcHNzNVLXyGgZ4XxBODsedhBEGVQ',
  authDomain: 'buedemestres.firebaseapp.com',
  projectId: 'buedemestres',
  storageBucket: 'buedemestres.firebasestorage.app',
  messagingSenderId: '357221464697',
  appId: '1:357221464697:web:cf8019dd07df981218b2a8',
  measurementId: 'G-8H4ZXMCGQX',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
