/* Inline SVG icons (stroke-based, inherit currentColor). Icons with the `dir-icon` class are mirrored in RTL. */
const wrap = (body: string, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  back: wrap('<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>', 'dir-icon'),
  forward: wrap('<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>', 'dir-icon'),
  sun: wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: wrap('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  soundOn: wrap('<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
  soundOff: wrap('<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/>'),
  globe: wrap('<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z"/>'),
  hint: wrap('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>'),
  skip: wrap('<path d="M5 4l10 8-10 8V4z"/><path d="M19 5v14"/>', 'dir-icon'),
  fire: wrap('<path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 11 11c0-4 1-9 1-9z"/>'),
  clock: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  star: wrap('<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
  target: wrap('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  check: wrap('<path d="M20 6L9 17l-5-5"/>'),
  cross: wrap('<path d="M18 6L6 18M6 6l12 12"/>'),
  retry: wrap('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  home: wrap('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  keyboard: wrap('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
  list: wrap('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  city: wrap('<path d="M3 21h18"/><path d="M5 21V9l5-3v15"/><path d="M14 21V4l5 3v14"/>'),
  pointer: wrap('<path d="M9 3l10 10-4.5 1 2.5 5-2.5 1-2.5-5L9 18z"/>'),
} as const;
