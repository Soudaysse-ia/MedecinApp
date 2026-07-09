// Jeu d'icones SVG maison (traits arrondis, sans dependance).
// Usage : <Icon name="patients" size={18} />
const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  patients: <><circle cx="9" cy="8" r="3.5" /><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.5c2.5.2 4.5 2 4.5 4.5" /></>,
  agenda: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8 14.5h3M8 17.5h5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  pill: <><rect x="2.5" y="9" width="19" height="6.5" rx="3.25" transform="rotate(-35 12 12.25)" /><path d="M8.5 8.2l7 4.9" /></>,
  template: <><path d="M6 3.5h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1v-16a1 1 0 011-1z" /><path d="M14.5 3.5V8H19M9 12.5h6M9 16h4" /></>,
  shield: <><path d="M12 3l7.5 3v6c0 4.5-3.2 7.7-7.5 9-4.3-1.3-7.5-4.5-7.5-9V6L12 3z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  folder: <><path d="M3.5 6.5a2 2 0 012-2h4l2 2.5h7a2 2 0 012 2v9a2 2 0 01-2 2h-13a2 2 0 01-2-2v-11.5z" /></>,
  heart: <><path d="M12 20.5s-7.5-4.7-9.3-9.6C1.4 7.4 3.7 4.5 6.8 4.5c2 0 3.7 1.1 5.2 3 1.5-1.9 3.2-3 5.2-3 3.1 0 5.4 2.9 4.1 6.4-1.8 4.9-9.3 9.6-9.3 9.6z" /></>,
  stetho: <><path d="M5 3.5v5a5 5 0 0010 0v-5" /><path d="M10 17.5a4.5 4.5 0 009 0v-3" /><circle cx="19" cy="12" r="2.2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></>,
  alert: <><path d="M12 3.5L21.5 20h-19L12 3.5z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  doc: <><path d="M7 3.5h7l4.5 4.5v11.5a1 1 0 01-1 1H7a1 1 0 01-1-1v-15a1 1 0 011-1z" /><path d="M14 3.5V8h4.5" /></>,
};

export default function Icon({ name, size = 18, strokeWidth = 1.75, style }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} aria-hidden="true"
    >
      {PATHS[name] || null}
    </svg>
  );
}
