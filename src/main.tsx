import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './utils/cowguyBalanceOverrides.ts';
import App from './App.tsx';
import CowbandSoundtrackGate from './components/CowbandSoundtrackGate.tsx';
import CowguyRewardAccess from './components/CowguyRewardAccess.tsx';
import FirstRunTutorialGate from './components/FirstRunTutorialGate.tsx';
import GameQualityGuard from './components/GameQualityGuard.tsx';
import IntroCinematic from './components/IntroCinematic.tsx';
import JuiceLayerGate from './components/JuiceLayerGate.tsx';
import SimpleRegistryGate from './components/SimpleRegistryGate.tsx';
import WaterSystemGate from './components/WaterSystemGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CowguyRewardAccess>
      <IntroCinematic>
        <SimpleRegistryGate>
          <WaterSystemGate>
            <FirstRunTutorialGate>
              <GameQualityGuard>
                <JuiceLayerGate>
                  <App />
                </JuiceLayerGate>
              </GameQualityGuard>
            </FirstRunTutorialGate>
          </WaterSystemGate>
        </SimpleRegistryGate>
      </IntroCinematic>
    </CowguyRewardAccess>
    <CowbandSoundtrackGate>{null}</CowbandSoundtrackGate>
  </StrictMode>,
);
