/* Line icons, 1.8px stroke, matching the E1 tab bar. */
const s = (d, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icons = {
  search: s(`<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>`, 22),
  home: s(`<path d="M4 10.5 12 4l8 6.5V20h-5v-5.5H9V20H4z" fill="currentColor" stroke="none"/>`),
  reflect: s(`<path d="M6.5 4h11v16l-5.5-4-5.5 4z"/>`),
  courses: s(`<path d="M4 5h6v14H4zM14 5h6v14h-6z"/>`),
  me: s(`<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>`),
  back: s(`<path d="M15 5l-7 7 7 7"/>`),
  send: s(`<path d="M12 19V5M6 11l6-6 6 6"/>`, 20),
};
