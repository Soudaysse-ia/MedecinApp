import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Genere une ordonnance PDF (A4) pour un patient et une liste de prescriptions.
// doctor: { nom, specialite, cabinet_nom, cabinet_adresse, cabinet_tel }
export async function buildOrdonnancePdf({ doctor, patient, prescriptions, date }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 en points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const M = 50;               // marge
  const W = 595 - M * 2;      // largeur utile
  let y = 800;
  const ink = rgb(0.12, 0.16, 0.22);
  const blue = rgb(0.11, 0.43, 0.72);
  const grey = rgb(0.4, 0.45, 0.5);

  const text = (s, x, yy, { size = 11, f = font, color = ink } = {}) =>
    page.drawText(String(s ?? ''), { x, y: yy, size, font: f, color });

  // --- En-tete cabinet ---
  text(doctor?.nom || 'Medecin', M, y, { size: 16, f: bold, color: blue });
  y -= 18;
  if (doctor?.specialite) { text(doctor.specialite, M, y, { size: 11, color: grey }); y -= 14; }
  if (doctor?.cabinet_nom) { text(doctor.cabinet_nom, M, y, { size: 10, color: grey }); y -= 13; }
  if (doctor?.cabinet_adresse) { text(doctor.cabinet_adresse, M, y, { size: 10, color: grey }); y -= 13; }
  if (doctor?.cabinet_tel) { text('Tel : ' + doctor.cabinet_tel, M, y, { size: 10, color: grey }); y -= 13; }

  // Date alignee a droite
  text('Le ' + formatFr(date), M + W - 120, 800, { size: 11, color: grey });

  // Filet de separation
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });
  y -= 28;

  // --- Patient ---
  text('ORDONNANCE', M, y, { size: 13, f: bold });
  y -= 22;
  text('Patient : ', M, y, { f: bold });
  text(`${patient.nom} ${patient.prenom}`, M + 55, y);
  y -= 15;
  if (patient.date_naissance) { text('Ne(e) le : ' + formatFr(patient.date_naissance), M, y, { size: 10, color: grey }); y -= 15; }

  // Allergies en evidence
  if (patient.allergies) {
    y -= 4;
    text('Allergies connues : ' + patient.allergies.replace(/\n/g, ', '), M, y, { size: 10, color: rgb(0.8, 0.15, 0.15), f: bold });
    y -= 18;
  }

  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: rgb(0.85, 0.88, 0.92) });
  y -= 24;

  // --- Liste des prescriptions ---
  prescriptions.forEach((p, i) => {
    if (y < 120) return; // garde-fou : tient sur une page pour ce prototype
    text(`${i + 1}.`, M, y, { f: bold });
    text(p.medication_nom, M + 18, y, { f: bold, size: 12 });
    y -= 16;
    const details = [];
    if (p.posologie_specifique) details.push('Posologie : ' + p.posologie_specifique);
    if (p.duree) details.push('Duree : ' + p.duree);
    for (const d of details) { text(d, M + 18, y, { size: 10, color: grey }); y -= 13; }
    if (p.instructions) { text('Instructions : ' + p.instructions, M + 18, y, { size: 10, color: grey }); y -= 13; }
    y -= 10;
  });

  // --- Pied de page ---
  text('Signature et cachet du medecin', M + W - 200, 90, { size: 10, color: grey });
  page.drawLine({ start: { x: M + W - 200, y: 85 }, end: { x: M + W, y: 85 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  text('Document genere par un prototype - donnees fictives, sans valeur medicale.', M, 50, { size: 8, color: rgb(0.6, 0.6, 0.6) });

  return await doc.save();
}

function formatFr(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
