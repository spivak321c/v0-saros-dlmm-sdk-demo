import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import App from './src/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
