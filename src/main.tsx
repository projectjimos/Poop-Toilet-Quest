import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './utils/cowguyBalanceOverrides.ts';
import App from './App.tsx';
import BossEncounterGate from './components/BossEncounterGate.tsx';
import CowbandSoundtrackGate from './components/CowbandSoundtrackGate.tsx';
import CowguyRewardAccess from './components/CowguyRewardAccess.tsx';
import FirstRunTutorialGate from './components/FirstRunTutorialGate.tsx';
import GameQualityGuard from './components/GameQualityGuard.tsx';
import IntroCinematic from './components/IntroCinematic.tsx';
import JuiceLayerGate from './components/JuiceLayerGate.tsx';
import MobileExperienceGate from './components/MobileExperienceGate.tsx';
import SimpleRegistryGate from './components/SimpleRegistryGate.tsx';
import WaterSystemGate from './components/WaterSystemGate.tsx';
import WaveBossDirectorGate from './components/WaveBossDirectorGate.tsx';
import './index.css';
import './mobile.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileExperienceGate>
      <CowguyRewardAccess>
        <IntroCinematic>
          <SimpleRegistryGate>
            <WaterSystemGate>
              <FirstRunTutorialGate>
                <GameQualityGuard>
                  <BossEncounterGate>
                    <WaveBossDirectorGate>
                      <JuiceLayerGate>
                        <App />
                      </JuiceLayerGate>
                    </WaveBossDirectorGate>
                  </BossEncounterGate>
                </GameQualityGuard>
              </FirstRunTutorialGate>
            </WaterSystemGate>
          </SimpleRegistryGate>
        </IntroCinematic>
      </CowguyRewardAccess>
    </MobileExperienceGate>
    <CowbandSoundtrackGate>{null}</CowbandSoundtrackGate>
  </StrictMode>,
);
