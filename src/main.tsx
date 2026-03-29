import { createRoot } from 'react-dom/client';
import { createStore } from 'jotai';
import { Provider } from 'jotai/react';

import './index.css';
import App from './components/App.tsx';
import { StrictMode } from 'react';
import { AudioController } from './audio-controller.ts';
import { audioFileAtom, loopAtom, volumeAtom } from './atoms.ts';

function cancelDefaultDragBehavior(e: DragEvent) {
  if (e.dataTransfer && [...e.dataTransfer.items].some(item => item.kind === 'file'))
    e.preventDefault();
}

window.addEventListener('drop', cancelDefaultDragBehavior);
window.addEventListener('dragover', cancelDefaultDragBehavior);

const store = createStore();
const audioController = new AudioController(document.body);
audioController.volume = store.get(volumeAtom);
audioController.loop = store.get(loopAtom);
store.sub(audioFileAtom, () => {
  const file = store.get(audioFileAtom);
  if (!file) return;
  audioController.load(file);
});
store.sub(volumeAtom, () => {
  audioController.volume = store.get(volumeAtom);
});
store.sub(loopAtom, () => {
  audioController.loop = store.get(loopAtom);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App audioController={audioController} />
    </Provider>
  </StrictMode>
)
