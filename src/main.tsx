import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { RuntimeProvider } from './features/runtime/RuntimeContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RuntimeProvider>
      <App />
    </RuntimeProvider>
  </React.StrictMode>,
);
