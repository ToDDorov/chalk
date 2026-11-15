import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { readDate, writeDate } from './lib/backup';
import { todayISO } from './lib/dates';
import { registerSW } from 'virtual:pwa-register';

// The backup reminder counts from the first time the app was opened.
if (!readDate('firstUse')) writeDate('firstUse', todayISO());

// Caches the app so it opens with no connection.
registerSW({ immediate: true });

// Ask the browser not to evict the only copy of the training log.
void navigator.storage?.persist?.();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
