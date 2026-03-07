import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createStore } from 'jotai';
import { Provider } from 'jotai/react';

import './index.css'
import App from './App.tsx'

function cancelDefaultDragBehavior(e: DragEvent) {
  if (e.dataTransfer && [...e.dataTransfer.items].some(item => item.kind === "file"))
    e.preventDefault();
}

window.addEventListener('drop', cancelDefaultDragBehavior);
window.addEventListener('dragover', cancelDefaultDragBehavior);

export const store = createStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)