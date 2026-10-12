import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dynamic PWA PNG Icon Generator
function generatePwaLogo(size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const scale = size / 512;
  // Background Squircle (Green)
  ctx.save();
  ctx.fillStyle = '#0FA968';
  
  const r = 112 * scale;
  const x = 32 * scale;
  const y = 32 * scale;
  const w = 448 * scale;
  const h = 448 * scale;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw Stacked isometric rhombuses in white
  ctx.fillStyle = '#FFFFFF';

  // 1. Top Layer
  ctx.beginPath();
  ctx.moveTo(256 * scale, 150 * scale);
  ctx.lineTo(370 * scale, 207 * scale);
  ctx.lineTo(256 * scale, 264 * scale);
  ctx.lineTo(142 * scale, 207 * scale);
  ctx.closePath();
  ctx.fill();

  // 2. Middle Layer
  ctx.beginPath();
  ctx.moveTo(142 * scale, 245 * scale);
  ctx.lineTo(256 * scale, 302 * scale);
  ctx.lineTo(370 * scale, 245 * scale);
  ctx.lineTo(370 * scale, 265 * scale);
  ctx.lineTo(256 * scale, 322 * scale);
  ctx.lineTo(142 * scale, 265 * scale);
  ctx.closePath();
  ctx.fill();

  // 3. Bottom Layer
  ctx.beginPath();
  ctx.moveTo(142 * scale, 305 * scale);
  ctx.lineTo(256 * scale, 362 * scale);
  ctx.lineTo(370 * scale, 305 * scale);
  ctx.lineTo(370 * scale, 325 * scale);
  ctx.lineTo(256 * scale, 382 * scale);
  ctx.lineTo(142 * scale, 325 * scale);
  ctx.closePath();
  ctx.fill();

  return canvas.toDataURL('image/png');
}

// Service Worker & Icon Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('OrderPoint Pro SW Registered successfully!');
        
        const sendIcons = () => {
          if (reg.active) {
            try {
              const icon192 = generatePwaLogo(192);
              const icon512 = generatePwaLogo(512);
              reg.active.postMessage({
                type: 'SET_ICONS',
                icon192,
                icon512
              });
            } catch (err) {
              console.error('Failed to post dynamic PWA icons to SW:', err);
            }
          }
        };

        if (reg.installing) {
          reg.installing.addEventListener('statechange', (e: any) => {
            if (e.target && e.target.state === 'activated') sendIcons();
          });
        } else {
          sendIcons();
        }
      })
      .catch(err => console.error('OrderPoint Pro SW Registration failed: ', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
