import { formatDate } from '../utils.js';

// Mini graphique d'evolution (SVG, sans dependance externe).
// points: [{ date, value }] deja filtres (value non nul).
export default function VitalsChart({ points, unit = '', color = '#1d6fb8' }) {
  const valid = points.filter((p) => p.value != null && !isNaN(p.value));
  if (valid.length === 0) return <p className="muted" style={{ fontSize: '.85rem' }}>Aucune donnée pour ce paramètre.</p>;

  const W = 520, H = 180, pad = { l: 40, r: 12, t: 14, b: 26 };
  const xs = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, valid.length - 1);
  const vals = valid.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const p0 = min - (max - min) * 0.1, p1 = max + (max - min) * 0.1;
  const ys = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - p0) / (p1 - p0));

  const path = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(p.value).toFixed(1)}`).join(' ');
  const ticks = [p1, (p0 + p1) / 2, p0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }} role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={ys(t)} y2={ys(t)} stroke="#e8edf3" />
          <text x={4} y={ys(t) + 4} fontSize="10" fill="#94a3b8">{t.toFixed(1)}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {valid.map((p, i) => (
        <g key={i}>
          <circle cx={xs(i)} cy={ys(p.value)} r="3.5" fill={color} />
          {(i === 0 || i === valid.length - 1 || valid.length <= 6) && (
            <text x={xs(i)} y={H - 8} fontSize="9" fill="#94a3b8" textAnchor="middle">{formatDate(p.date).slice(0, 6)}</text>
          )}
        </g>
      ))}
      <text x={W - pad.r} y={pad.t} fontSize="10" fill="#64748b" textAnchor="end">{unit}</text>
    </svg>
  );
}
