import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// No StrictMode: the game engine owns a requestAnimationFrame loop and a single
// mutable headless simulation; double-invoked effects would needlessly build
// two engines. Lifecycle is instead verified explicitly in the e2e suite.
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container missing in index.html');
}

createRoot(container).render(<App />);
