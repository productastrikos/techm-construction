// PDF export (English): jsPDF + autotable. Arabic reports use the print-ready preview (browser shaping handles RTL).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportDoc, Tone } from './model';

const TONE: Record<Tone, [number, number, number]> = { good: [24, 160, 120], warn: [200, 130, 20], bad: [200, 60, 60], info: [40, 120, 190], neutral: [60, 70, 75] };

export function downloadPdf(doc: ReportDoc, project: string) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const M = 40;
  let y = 0;
  // header band
  pdf.setFillColor(8, 32, 40);
  pdf.rect(0, 0, W, 70, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(doc.title, M, 34);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(doc.subtitle, M, 52);
  pdf.setFontSize(9);
  pdf.text(`${doc.id}`, W - M, 34, { align: 'right' });
  pdf.text('Astrikos S!aP Mazzant', W - M, 52, { align: 'right' });
  y = 96;
  const ensure = (h: number) => {
    if (y + h > pdf.internal.pageSize.getHeight() - 50) {
      pdf.addPage();
      y = 50;
    }
  };
  for (const s of doc.sections) {
    ensure(60);
    pdf.setTextColor(10, 40, 50);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(s.title, M, y);
    pdf.setDrawColor(62, 224, 176);
    pdf.setLineWidth(1.2);
    pdf.line(M, y + 4, M + 36, y + 4);
    y += 18;
    pdf.setFont('helvetica', 'normal');
    if (s.kind === 'text') {
      pdf.setFontSize(10.5);
      pdf.setTextColor(40, 50, 55);
      const lines = pdf.splitTextToSize(s.text, W - 2 * M);
      ensure(lines.length * 13);
      pdf.text(lines, M, y);
      y += lines.length * 13 + 10;
    } else if (s.kind === 'bullets') {
      pdf.setFontSize(10);
      for (const it of s.items) {
        const lines = pdf.splitTextToSize(it.text, W - 2 * M - 16);
        ensure(lines.length * 12 + 4);
        const c = TONE[it.tone ?? 'neutral'];
        pdf.setFillColor(c[0], c[1], c[2]);
        pdf.circle(M + 3, y - 3, 2.6, 'F');
        pdf.setTextColor(40, 50, 55);
        pdf.text(lines, M + 14, y);
        y += lines.length * 12 + 4;
      }
      y += 8;
    } else if (s.kind === 'kpis') {
      const n = s.items.length;
      const w = (W - 2 * M - (n - 1) * 8) / n;
      ensure(54);
      s.items.forEach((it, i) => {
        const x = M + i * (w + 8);
        const c = TONE[it.tone ?? 'neutral'];
        pdf.setDrawColor(210, 220, 224);
        pdf.setLineWidth(0.6);
        pdf.roundedRect(x, y - 8, w, 46, 4, 4, 'S');
        pdf.setFontSize(8.5);
        pdf.setTextColor(110, 125, 130);
        pdf.text(it.label, x + 8, y + 5, { maxWidth: w - 12 });
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(c[0], c[1], c[2]);
        pdf.text(it.value, x + 8, y + 26, { maxWidth: w - 12 });
        pdf.setFont('helvetica', 'normal');
      });
      y += 60;
    } else {
      autoTable(pdf, {
        startY: y - 4,
        head: [s.head],
        body: s.rows,
        margin: { left: M, right: M },
        styles: { fontSize: 9, cellPadding: 4, textColor: [40, 50, 55] },
        headStyles: { fillColor: [10, 60, 72], textColor: 255 },
        alternateRowStyles: { fillColor: [244, 248, 249] },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    }
  }
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(130, 140, 145);
    pdf.text(`${project} - ${doc.id} - page ${i} of ${pages} - Quantities, dates and costs are illustrative.`, M, pdf.internal.pageSize.getHeight() - 24);
  }
  pdf.save(`${doc.id}.pdf`);
}
