import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './utils/cowguyBalanceOverrides.ts';
import App from './App.tsx';
import BossEncounterGate from './components/BossEncounterGate.tsx';
import CoinLifetimeGate from './components/CoinLifetimeGate.tsx';
import CowbandSoundtrackGate from './components/CowbandSoundtrackGate.tsx';
import CowguyRewardAccess from './components/CowguyRewardAccess.tsx';
import FirstRunTutorialGate from './components/FirstRunTutorialGate.tsx';
import GameQualityGuard from './components/GameQualityGuard.tsx';
import IntroCinematic from './components/IntroCinematic.tsx';
import JuiceLayerGate from './components/JuiceLayerGate.tsx';
import MobileExperienceGate from './components/MobileExperienceGate.tsx';
import SimpleRegistryGate from './components/SimpleRegistryGate.tsx';
import UtilityPanelVisibilityGate from './components/UtilityPanelVisibilityGate.tsx';
import WaterSystemGate from './components/WaterSystemGate.tsx';
import WaveBossDirectorGate from './components/WaveBossDirectorGate.tsx';
import WaveClearDirectorGate from './components/WaveClearDirectorGate.tsx';
import './index.css';
import './mobile.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileExperienceGate>
      <CowguyRewardAccess>
        <IntroCinematic>
          <SimpleRegistryGate>
            <UtilityPanelVisibilityGate>
              <WaterSystemGate>
                <FirstRunTutorialGate>
                  <GameQualityGuard>
                    <CoinLifetimeGate>
                      <WaveClearDirectorGate>
                        <BossEncounterGate>
                          <WaveBossDirectorGate>
                            <JuiceLayerGate>
                              <App />
                            </JuiceLayerGate>
                          </WaveBossDirectorGate>
                        </BossEncounterGate>
                      </WaveClearDirectorGate>
                    </CoinLifetimeGate>
                  </GameQualityGuard>
                </FirstRunTutorialGate>
              </WaterSystemGate>
            </UtilityPanelVisibilityGate>
          </SimpleRegistryGate>
        </IntroCinematic>
      </CowguyRewardAccess>
    </MobileExperienceGate>
    <CowbandSoundtrackGate>{null}</CowbandSoundtrackGate>
  </StrictMode>,
);
