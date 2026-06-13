export function calcAge(dateNaissance) {
  if (!dateNaissance) return null;
  const d = new Date(dateNaissance);
  if (isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Transforme un champ texte multi-lignes en liste de lignes non vides
export function lines(text) {
  if (!text) return [];
  return text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}
