// Avatar a initiales, couleur stable derivee du nom.
const PALETTE = [
  { bg: '#E8F0FA', fg: '#0A4DA0' },   // bleu
  { bg: '#E6F4EC', fg: '#157F52' },   // vert
  { bg: '#FBF1DD', fg: '#9A6312' },   // ambre
  { bg: '#F3EAFB', fg: '#6D3A9E' },   // violet
  { bg: '#FDEDE8', fg: '#B4472A' },   // corail
  { bg: '#E5F3F6', fg: '#0E6E80' },   // sarcelle
];

export default function Avatar({ nom = '', prenom = '', size = 40 }) {
  const full = `${nom}${prenom}`;
  let h = 0;
  for (let i = 0; i < full.length; i++) h = (h * 31 + full.charCodeAt(i)) >>> 0;
  const c = PALETTE[h % PALETTE.length];
  const initials = `${(prenom[0] || '').toUpperCase()}${(nom[0] || '').toUpperCase()}` || '?';
  return (
    <span
      className="avatar"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: c.bg, color: c.fg,
      }}
    >
      {initials}
    </span>
  );
}
