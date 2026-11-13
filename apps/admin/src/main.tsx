import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error("No s'ha trobat l'arrel de la web d'administració");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
