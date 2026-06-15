import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import FirstRunTutorialGate from './components/FirstRunTutorialGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FirstRunTutorialGate>
      <App />
    </FirstRunTutorialGate>
  </StrictMode>,
);
