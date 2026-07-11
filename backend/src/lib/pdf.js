import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Genere une facture d'abonnement PDF (A4).
// invoice: { numero, date_emission, periode_debut, periode_fin, montant, devise, statut, date_paiement }
// doctor:  { nom, email, cabinet_nom, cabinet_adresse }
export async function buildInvoicePdf({ invoice, doctor }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const M = 50, W = 595 - M * 2;
  const ink = rgb(0.09, 0.15, 0.23), blue = rgb(0.04, 0.30, 0.63), grey = rgb(0.42, 0.49, 0.56);
  const t = (s, x, y, { size = 11, f = font, color = ink } = {}) =>
    page.drawText(String(s ?? ''), { x, y, size, font: f, color });

  // En-tete fournisseur (proprietaire de la plateforme)
  t('Twabibu', M, 792, { size: 20, f: bold, color: blue });
  t('Plateforme de gestion de dossiers medicaux', M, 774, { size: 9, color: grey });
  t('soudaysse.said@gmail.com', M, 762, { size: 9, color: grey });

  // Bloc facture (a droite)
  t('FACTURE', M + W - 160, 792, { size: 18, f: bold });
  t('N° ' + invoice.numero, M + W - 160, 772, { size: 10, color: grey });
  t('Emise le ' + fmtFr(invoice.date_emission), M + W - 160, 759, { size: 10, color: grey });

  page.drawLine({ start: { x: M, y: 740 }, end: { x: M + W, y: 740 }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });

  // Destinataire
  t('Facture a', M, 716, { size: 9, f: bold, color: grey });
  t(doctor?.nom || 'Medecin', M, 700, { size: 12, f: bold });
  if (doctor?.cabinet_nom) t(doctor.cabinet_nom, M, 685, { size: 10, color: grey });
  if (doctor?.cabinet_adresse) t(doctor.cabinet_adresse, M, 672, { size: 10, color: grey });
  if (doctor?.email) t(doctor.email, M, 659, { size: 10, color: grey });

  // Tableau lignes
  let y = 620;
  page.drawRectangle({ x: M, y: y - 4, width: W, height: 22, color: rgb(0.95, 0.97, 0.99) });
  t('DESCRIPTION', M + 8, y + 2, { size: 9, f: bold, color: grey });
  t('MONTANT', M + W - 90, y + 2, { size: 9, f: bold, color: grey });
  y -= 30;

  const periode = invoice.periode_debut && invoice.periode_fin
    ? `Periode du ${fmtFr(invoice.periode_debut)} au ${fmtFr(invoice.periode_fin)}` : '';
  t('Abonnement Twabibu', M + 8, y, { size: 11, f: bold });
  if (periode) { y -= 14; t(periode, M + 8, y, { size: 9, color: grey }); }
  t(money(invoice.montant, invoice.devise), M + W - 90, y + (periode ? 14 : 0), { size: 11 });

  y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: rgb(0.85, 0.88, 0.92) });
  y -= 24;
  t('Total', M + W - 200, y, { size: 12, f: bold });
  t(money(invoice.montant, invoice.devise), M + W - 90, y, { size: 12, f: bold, color: blue });

  // Statut
  y -= 36;
  if (invoice.statut === 'payee') {
    t('PAYEE', M, y, { size: 12, f: bold, color: rgb(0.08, 0.5, 0.32) });
    t('Reglee le ' + fmtFr(invoice.date_paiement), M + 70, y, { size: 10, color: grey });
  } else {
    t('A REGLER', M, y, { size: 12, f: bold, color: rgb(0.76, 0.17, 0.15) });
    t('Echeance : ' + fmtFr(invoice.date_emission), M + 90, y, { size: 10, color: grey });
  }

  t('Facture generee par Twabibu - soudaysse.said@gmail.com', M, 60, { size: 8, color: rgb(0.6, 0.6, 0.6) });
  return await doc.save();
}

function money(v, devise = 'EUR') {
  const sym = devise === 'EUR' ? ' EUR' : ' ' + devise;
  return (Number(v) || 0).toFixed(2).replace('.', ',') + sym;
}
function fmtFr(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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
  text('Document genere par Twabibu.', M, 50, { size: 8, color: rgb(0.6, 0.6, 0.6) });

  return await doc.save();
}

function formatFr(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Export complet du dossier d'un patient (multi-pages, avec saut de page auto).
export async function buildDossierPdf({ doctor, patient, consultations, prescriptions, vitals, vaccinations, documents }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 50, W = 595 - M * 2, TOP = 800, BOTTOM = 60;
  const ink = rgb(0.12, 0.16, 0.22), blue = rgb(0.11, 0.43, 0.72), grey = rgb(0.4, 0.45, 0.5);

  let page = doc.addPage([595, 842]);
  let y = TOP;
  const ensure = (need = 16) => { if (y - need < BOTTOM) { page = doc.addPage([595, 842]); y = TOP; } };
  const line = (s, { size = 10, f = font, color = ink, indent = 0, gap = 14 } = {}) => {
    ensure(gap);
    page.drawText(clip(String(s ?? ''), size, f, W - indent), { x: M + indent, y, size, font: f, color });
    y -= gap;
  };
  const heading = (s) => {
    ensure(26); y -= 6;
    page.drawText(s, { x: M, y, size: 12, font: bold, color: blue });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: rgb(0.85, 0.88, 0.92) });
    y -= 16;
  };

  // Titre
  line('DOSSIER MEDICAL', { size: 16, f: bold, color: blue, gap: 22 });
  line(`${patient.nom} ${patient.prenom}`, { size: 13, f: bold, gap: 16 });
  line(`Edite le ${formatFr(new Date().toISOString())} par ${doctor?.nom || ''}`, { color: grey, gap: 18 });

  heading('Identite');
  line(`Ne(e) le : ${formatFr(patient.date_naissance)}    Sexe : ${patient.sexe || '-'}`);
  line(`N° identite : ${patient.numero_identite || '-'}    Tel : ${patient.telephone || '-'}`);
  line(`Email : ${patient.email || '-'}`);
  line(`Adresse : ${patient.adresse || '-'}`);
  line(`Contact d'urgence : ${patient.contact_urgence || '-'}`);

  heading('Alertes & antecedents');
  line('Allergies : ' + (patient.allergies ? patient.allergies.replace(/\n/g, ', ') : 'aucune'),
    { f: bold, color: patient.allergies ? rgb(0.8, 0.15, 0.15) : ink });
  line('Maladies chroniques : ' + (patient.maladies_chroniques ? patient.maladies_chroniques.replace(/\n/g, ', ') : 'aucune'));

  heading(`Consultations (${consultations.length})`);
  if (!consultations.length) line('Aucune.', { color: grey });
  for (const c of consultations) {
    line(`${formatFr(c.date)} - ${c.motif || 'motif n.p.'}`, { f: bold });
    if (c.diagnostic) line('Diagnostic : ' + c.diagnostic, { indent: 12, color: grey });
    if (c.notes) line('Notes : ' + c.notes, { indent: 12, color: grey });
  }

  heading(`Prescriptions (${prescriptions.length})`);
  if (!prescriptions.length) line('Aucune.', { color: grey });
  for (const p of prescriptions) {
    line(`${formatFr(p.date)} - ${p.medication_nom} [${p.statut === 'en_cours' ? 'en cours' : 'terminee'}]`, { f: bold });
    const det = [p.posologie_specifique, p.duree, p.instructions].filter(Boolean).join(' | ');
    if (det) line(det, { indent: 12, color: grey });
  }

  heading(`Constantes (${vitals.length})`);
  if (!vitals.length) line('Aucune.', { color: grey });
  for (const v of vitals) {
    const parts = [];
    if (v.poids != null) parts.push(`poids ${v.poids}kg`);
    if (v.tension) parts.push(`TA ${v.tension}`);
    if (v.temperature != null) parts.push(`${v.temperature}C`);
    if (v.glycemie != null) parts.push(`glyc ${v.glycemie}g/L`);
    line(`${formatFr(v.date)} : ${parts.join(', ') || '-'} (${v.saisi_par || '-'})`);
  }

  heading(`Vaccinations (${vaccinations.length})`);
  if (!vaccinations.length) line('Aucune.', { color: grey });
  for (const v of vaccinations) line(`${v.vaccin} - fait le ${formatFr(v.date)}${v.rappel_prevu ? `, rappel ${formatFr(v.rappel_prevu)}` : ''}`);

  heading(`Documents joints (${documents.length})`);
  if (!documents.length) line('Aucun.', { color: grey });
  for (const d of documents) line(`${formatFr(d.date)} - [${d.type || 'autre'}] ${d.filename}`);

  ensure(30); y -= 10;
  line('Document genere par Twabibu.', { size: 8, color: rgb(0.6, 0.6, 0.6) });
  return await doc.save();
}

// Tronque un texte pour qu'il tienne dans la largeur disponible.
function clip(s, size, font, maxWidth) {
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && font.widthOfTextAtSize(out + '...', size) > maxWidth) out = out.slice(0, -1);
  return out + '...';
}
