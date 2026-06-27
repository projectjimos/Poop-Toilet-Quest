import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './utils/cowguyBalanceOverrides.ts';
import App from './App.tsx';
import AppSafetyBoundary from './components/AppSafetyBoundary.tsx';
import GameQualityGuard from './components/GameQualityGuard.tsx';
import MobileControlsFixGate from './components/MobileControlsFixGate.tsx';
import MobileExperienceGate from './components/MobileExperienceGate.tsx';
import PlayButtonFixGate from './components/PlayButtonFixGate.tsx';
import SimpleRegistryGate from './components/SimpleRegistryGate.tsx';
import './index.css';
import './mobile.css';

const consentExpiry = new Date();
consentExpiry.setFullYear(consentExpiry.getFullYear() + 1);
document.cookie = `poop_quest_cookie_consent=true; expires=${consentExpiry.toUTCString()}; path=/; SameSite=None; Secure`;
localStorage.setItem('poop_quest_fast_arcade_mode', 'true');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppSafetyBoundary>
      <MobileExperienceGate>
        <SimpleRegistryGate>
          <GameQualityGuard>
            <MobileControlsFixGate>
              <PlayButtonFixGate>
                <App />
              </PlayButtonFixGate>
            </MobileControlsFixGate>
          </GameQualityGuard>
        </SimpleRegistryGate>
      </MobileExperienceGate>
    </AppSafetyBoundary>
  </StrictMode>,
);
