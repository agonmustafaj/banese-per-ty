import { formatContractNumber, getPaymentDisplayName } from './data.js';

const PRIMARY = [56, 189, 248];
const DARK = [17, 24, 39];
const MUTED = [107, 114, 128];
const BORDER = [229, 231, 235];
const LIGHT = [255, 237, 213];

let logoDataUrlCache = null;

async function loadLogoDataUrl() {
  if (logoDataUrlCache) return logoDataUrlCache;
  try {
    const base = window.location.pathname.replace(/\/[^/]*$/, '/');
    const res = await fetch(`${base}assets/logo.svg`);
    if (!res.ok) return null;
    const svgText = await res.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 80, 80);
    URL.revokeObjectURL(url);
    logoDataUrlCache = canvas.toDataURL('image/png');
    return logoDataUrlCache;
  } catch (_) {
    return null;
  }
}

function drawSignatureBlock(doc, signature, x, y, width) {
  if (signature?.dataUrl) {
    try {
      doc.addImage(signature.dataUrl, 'PNG', x, y, Math.min(width, 55), 18);
    } catch (_) {}
  } else if (signature?.typedName) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(14);
    doc.setTextColor(...PRIMARY);
    doc.text(signature.typedName, x, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
  }
  doc.setDrawColor(...BORDER);
  doc.line(x, y + 18, x + width, y + 18);
}

async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
  return window.jspdf.jsPDF;
}

async function loadAutoTable() {
  if (window.jspdf?.jsPDF?.API?.autoTable) return;
  await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function drawHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadLogoDataUrl();
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 30, 'F');
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 12, 5, 20, 20);
    } catch (_) {}
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Banesë për ty', logo ? 36 : 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Platforma për Menaxhimin e Qerasë — Kosovë', logo ? 36 : 14, 21);
  doc.setFontSize(11);
  doc.text(title, pageWidth - 14, 14, { align: 'right' });
  if (subtitle) {
    doc.setFontSize(9);
    doc.text(subtitle, pageWidth - 14, 21, { align: 'right' });
  }
  doc.setTextColor(...DARK);
  return 40;
}

function drawFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Banesë për ty — Dokument i gjeneruar automatikisht', 14, pageHeight - 10);
    doc.text(`Faqja ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    doc.setTextColor(...DARK);
  }
}

function sectionTitle(doc, text, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...PRIMARY);
  doc.text(text, x, y);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(x, y + 1.5, x + doc.getTextWidth(text), y + 1.5);
  doc.setLineWidth(0.2);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
}

function field(doc, label, value, x, y, width = 85) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x, y);
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  const wrapped = doc.splitTextToSize(String(value ?? '-'), width);
  doc.text(wrapped, x, y + 5.2);
  doc.setFont('helvetica', 'normal');
  return y + 5.2 + wrapped.length * 5;
}

export async function downloadContractPdf(filename, contract, property, landlord, tenant) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const colWidth = (pageWidth - margin * 2 - 8) / 2;

  const contractNr = formatContractNumber(contract) || '—';
  let y = await drawHeader(doc, 'KONTRATË QERAJE', `Nr. ${contractNr}`);
  y += 4;

  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Kjo kontratë krijohet mes qeradhënësit dhe qeramarrësit të specifikuar më poshtë, sipas kushteve të përcaktuara.`,
    margin, y, { maxWidth: pageWidth - margin * 2 }
  );
  doc.setTextColor(...DARK);
  y += 10;

  sectionTitle(doc, 'PALËT KONTRAKTUESE', margin, y);
  y += 7;
  const boxTop = y - 4;
  const fieldsWidth = colWidth - 6;

  const measureBlockHeight = (values) => {
    let h = 6;
    values.forEach((v, i) => {
      const wrapped = doc.splitTextToSize(String(v ?? '-'), fieldsWidth);
      h += 5.2 + wrapped.length * 5;
      if (i < values.length - 1) h += 2;
    });
    return h;
  };
  const boxHeight = Math.max(
    measureBlockHeight([landlord?.fullName, landlord?.email, landlord?.phone || '-']),
    measureBlockHeight([tenant?.fullName, tenant?.email, tenant?.phone || '-'])
  ) + 4;

  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, boxTop, colWidth, boxHeight, 2, 2, 'F');
  doc.roundedRect(margin + colWidth + 8, boxTop, colWidth, boxHeight, 2, 2, 'F');

  let yl = field(doc, 'Qeradhënësi (Pala e Parë)', landlord?.fullName, margin + 3, y + 2, fieldsWidth);
  yl = field(doc, 'Email', landlord?.email, margin + 3, yl + 2, fieldsWidth);
  field(doc, 'Telefon', landlord?.phone || '-', margin + 3, yl + 2, fieldsWidth);

  let yt = field(doc, 'Qeramarrësi (Pala e Dytë)', tenant?.fullName, margin + colWidth + 11, y + 2, fieldsWidth);
  yt = field(doc, 'Email', tenant?.email, margin + colWidth + 11, yt + 2, fieldsWidth);
  field(doc, 'Telefon', tenant?.phone || '-', margin + colWidth + 11, yt + 2, fieldsWidth);

  y = boxTop + boxHeight + 8;

  sectionTitle(doc, 'DETAJET E PRONËS', margin, y);
  y += 8;
  y = field(doc, 'Objekti', property?.title, margin, y, colWidth);
  y = field(doc, 'Adresa', property?.address, margin, y + 3, pageWidth - margin * 2);
  y += 3;

  const specsY = y;
  field(doc, 'Qera Mujore', `${property?.rentPrice || 0}€`, margin, specsY, colWidth / 2);
  field(doc, 'Depozita', `${property?.deposit || 0}€`, margin + colWidth / 2, specsY, colWidth / 2);
  field(doc, 'Fillimi', contract.startDate, margin + colWidth + 8, specsY, colWidth / 2);
  field(doc, 'Mbarimi', contract.endDate, margin + colWidth + 8 + colWidth / 2, specsY, colWidth / 2);
  y = specsY + 14;

  sectionTitle(doc, 'KUSHTET LIGJORE', margin, y);
  y += 7;
  doc.setFontSize(9.5);
  const clause = 'Palët pranojnë kushtet e qerasë sipas legjislacionit në fuqi në Republikën e Kosovës. Qeramarrësi është i detyruar të paguajë qeranë mujore brenda afatit të përcaktuar. Qeradhënësi garanton se prona është e lirë nga barrë të tjera kontraktuale. Çdo mosmarrëveshje zgjidhet me marrëveshje të ndërsjellë ose sipas ligjit.';
  const wrappedClause = doc.splitTextToSize(clause, pageWidth - margin * 2);
  doc.text(wrappedClause, margin, y);
  y += wrappedClause.length * 5 + 4;

  sectionTitle(doc, 'STATUSI I KONTRATËS', margin, y);
  y += 7;
  y = field(doc, 'Statusi Aktual', statusLabel(contract.status), margin, y, colWidth);

  y += 14;
  sectionTitle(doc, 'NËNSHKRIMI ELEKTRONIK', margin, y);
  y += 8;

  drawSignatureBlock(doc, contract.landlordSignature, margin, y, colWidth);
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('Qeradhënësi (Nënshkrim Elektronik)', margin, y + 22);
  doc.text(landlord?.fullName || '-', margin, y + 26);
  if (contract.landlordSignature?.signedAt) {
    doc.text(
      `Nënshkruar: ${new Date(contract.landlordSignature.signedAt).toLocaleString('sq-AL')}`,
      margin,
      y + 30
    );
  }

  drawSignatureBlock(doc, contract.signature, margin + colWidth + 8, y, colWidth);
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('Qeramarrësi (Nënshkrim Elektronik)', margin + colWidth + 8, y + 22);
  doc.text(tenant?.fullName || '-', margin + colWidth + 8, y + 26);
  if (contract.signedAt) {
    doc.text(`Nënshkruar: ${new Date(contract.signedAt).toLocaleString('sq-AL')}`, margin + colWidth + 8, y + 30);
  }
  doc.setTextColor(...DARK);

  drawFooter(doc);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

function statusLabel(status) {
  const map = {
    draft: 'Draft',
    generated_pdf: 'PDF i gjeneruar',
    pending_signature: 'Në pritje të nënshkrimit',
    signed: 'Nënshkruar',
    active: 'Aktive',
    cancelled: 'Anuluar',
    expired: 'Skaduar',
    terminated: 'Përfunduar parakohshëm',
    archived: 'Arkivuar',
  };
  return map[status] || status;
}

export async function downloadPaymentsPdf(filename, payments, periodLabel, userName) {
  const jsPDF = await loadJsPDF();
  await loadAutoTable();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = await drawHeader(doc, 'RAPORT FINANCIAR', periodLabel || 'Të gjitha periudhat');
  y += 4;
  if (userName) {
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(`Përdoruesi: ${userName}`, margin, y);
    doc.setTextColor(...DARK);
    y += 7;
  }

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const paid = payments.filter((p) => p.status === 'paguar').reduce((s, p) => s + p.amount, 0);
  const overdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);

  const summaryBoxes = [
    { label: 'TOTALI', value: `${total}€`, color: PRIMARY },
    { label: 'PAGUAR', value: `${paid}€`, color: [22, 163, 74] },
    { label: 'E VONUAR', value: `${overdue}€`, color: [220, 38, 38] },
  ];
  const boxWidth = (pageWidth - margin * 2 - 12) / 3;
  summaryBoxes.forEach((box, i) => {
    const bx = margin + i * (boxWidth + 6);
    doc.setFillColor(...box.color);
    doc.roundedRect(bx, y, boxWidth, 18, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(box.label, bx + 4, y + 6);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(box.value, bx + 4, y + 13.5);
    doc.setFont('helvetica', 'normal');
  });
  doc.setTextColor(...DARK);
  y += 26;

  const statusLabels = {
    pending: 'Në pritje', paguar: 'Paguar', overdue: 'E vonuar',
    disputed: 'Mosmarrëveshje', nën_shqyrtim: 'Në shqyrtim', created: 'Krijuar', archived: 'Arkivuar',
  };

  const rows = payments.map((p) => [
    new Date(p.dueDate).toLocaleDateString('sq-AL'),
    getPaymentDisplayName(p),
    `${p.amount}€`,
    statusLabels[p.status] || p.status,
    p.proof ? 'Po' : '—',
  ]);

  if (doc.autoTable) {
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Data', 'Pagesa', 'Shuma', 'Statusi', 'Dëshmi']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 248] },
      styles: { fontSize: 9.5, cellPadding: 3 },
    });
  }

  drawFooter(doc);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function generateSignaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  let drawing = false;
  let hasDrawn = false;

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e) {
    drawing = true;
    hasDrawn = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
  }
  function move(e) {
    if (!drawing) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  }
  function end() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  return {
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
    },
    isEmpty() { return !hasDrawn; },
    toDataUrl() { return canvas.toDataURL('image/png'); },
  };
}
