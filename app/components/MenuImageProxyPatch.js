'use client';
import { useEffect } from 'react';

const LOCAL_BY_NAME = {
  'Wagyu Scotch Fillet': '/menu/original/wagyu-scotch-fillet.jpg',
  'Wagyu Intercostal': '/menu/original/wagyu-intercostal.jpg',
  'Wagyu Inside Skirt': '/menu/original/wagyu-inside-skirt.jpg',
};

function proxySrc(src) {
  try {
    const u = new URL(src, window.location.origin);
    if (u.hostname !== 'hanokbbq.com.au') return null;
    const file = u.pathname.split('/').pop();
    if (!file) return null;
    return `/api/menu-image?file=${encodeURIComponent(file)}`;
  } catch {
    return null;
  }
}

function patchCards(root=document) {
  const cards = root?.querySelectorAll ? root.querySelectorAll('.card') : [];
  cards.forEach(card => {
    const title = card.querySelector('h3')?.textContent?.trim();
    const local = LOCAL_BY_NAME[title];
    const img = card.querySelector('img');
    if (!img) return;
    if (local) {
      img.onerror = null;
      img.src = local;
      if (img.parentElement) img.parentElement.style.display = 'block';
      return;
    }
    const next = proxySrc(img.getAttribute('src') || img.src || '');
    if (next && img.getAttribute('src') !== next) img.setAttribute('src', next);
  });
}

export default function MenuImageProxyPatch() {
  useEffect(() => {
    patchCards(document);
    const timer = setInterval(() => patchCards(document), 500);
    const obs = new MutationObserver(() => patchCards(document));
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { clearInterval(timer); obs.disconnect(); };
  }, []);
  return null;
}
