import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import FirstRunTutorialGate from './components/FirstRunTutorialGate.tsx';
import IntroCinematic from './components/IntroCinematic.tsx';
import JuiceLayerGate from './components/JuiceLayerGate.tsx';
import SimpleRegistryGate from './components/SimpleRegistryGate.tsx';
import WaterSystemGate from './components/WaterSystemGate.tsx';
import './components/CowbandSoundtrackGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IntroCinematic>
      <SimpleRegistryGate>
        <WaterSystemGate>
          <FirstRunTutorialGate>
            <JuiceLayerGate>
              <App />
            </JuiceLayerGate>
          </FirstRunTutorialGate>
        </WaterSystemGate>
      </SimpleRegistryGate>
    </IntroCinematic>
  </StrictMode>,
);
