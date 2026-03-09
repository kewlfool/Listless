import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/app.css';

const isCordovaRuntime =
  typeof window !== 'undefined' &&
  typeof (window as Window & { cordova?: unknown }).cordova !== 'undefined';

if (!isCordovaRuntime) {
  registerSW({
    immediate: true
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
