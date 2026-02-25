import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createStore } from 'jotai';
import { Provider } from 'jotai/react';

import './index.css'
import App from './App.tsx'

export const store = createStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
