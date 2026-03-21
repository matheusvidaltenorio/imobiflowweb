import { jsPDF } from 'jspdf';

/** jsPDF com fonte padrão Helvetica aceita basicamente Latin-1; caracteres como "—" e aspas tipográficas quebram o render. */
export function sanitizeTextForPdf(text: string): string {
  if (!text) return '';
  return (
    text
      .replace(/\u00A0/g, ' ')
      // travessão / hífen longo
      .replace(/[\u2013\u2014\u2015]/g, '-')
      .replace(/×/g, 'x')
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2026]/g, '...')
      .replace(/[\u2022\u00B7]/g, '-')
      // remove tudo que não cabe em Latin-1 (mantém ç ã õ é í etc.)
      .replace(/[^\u0000-\u00FF]/g, ' ')
      // colapsa espaços múltiplos (exceto quebras de linha)
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
      .join('\n')
  );
}

export type ContractPdfInput = {
  contractText: string;
  clientName: string;
  clientEmail?: string;
  clientCpf?: string | null;
  propertyTitle?: string | null;
  bankName: string;
  totalValue: number;
  downPayment: number;
  financedAmount: number;
  installmentValue: number;
  months: number;
  brokerName: string;
  contractDateLabel: string;
  statusLabel: string;
};

function formatBrl(n: number) {
  const s = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(n) ? n : 0,
  );
  return sanitizeTextForPdf(s);
}

/**
 * Gera PDF no navegador com jsPDF (sem @react-pdf) — evita chunks 404 / HMR quebrado no Next 14 dev.
 */
export function buildContractPdfBlob(input: ContractPdfInput): Blob {
  const safe = {
    ...input,
    clientName: sanitizeTextForPdf(input.clientName),
    clientEmail: input.clientEmail ? sanitizeTextForPdf(input.clientEmail) : undefined,
    clientCpf: input.clientCpf ? sanitizeTextForPdf(input.clientCpf) : null,
    propertyTitle: input.propertyTitle ? sanitizeTextForPdf(input.propertyTitle) : null,
    bankName: sanitizeTextForPdf(input.bankName),
    brokerName: sanitizeTextForPdf(input.brokerName),
    contractDateLabel: sanitizeTextForPdf(input.contractDateLabel),
    statusLabel: sanitizeTextForPdf(input.statusLabel),
    contractText: sanitizeTextForPdf(input.contractText),
  };

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const textBlock = (lines: string[], fontSize = 10, style: 'normal' | 'bold' = 'normal', lineFactor = 1.35) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    for (const raw of lines) {
      const t = sanitizeTextForPdf(raw) || ' ';
      const wrappedRaw = doc.splitTextToSize(t, maxW);
      const wrapped = Array.isArray(wrappedRaw) ? wrappedRaw : [String(wrappedRaw)];
      for (const line of wrapped) {
        const h = fontSize * lineFactor;
        ensureSpace(h);
        doc.text(line, margin, y);
        y += h;
      }
    }
  };

  // Cabeçalho
  doc.setFillColor(15, 42, 68);
  doc.rect(0, 0, pageW, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ImobiFlow', margin, 42);
  doc.setFontSize(9);
  doc.setTextColor(229, 231, 235);
  doc.text('Minuta de contrato comercial', margin, 58);
  doc.setTextColor(17, 24, 39);
  y = 88;

  textBlock(['Resumo'], 13, 'bold');
  textBlock(
    [
      `Status: ${safe.statusLabel}`,
      `Cliente: ${safe.clientName}`,
      ...(safe.clientEmail ? [`E-mail: ${safe.clientEmail}`] : []),
      ...(safe.clientCpf ? [`CPF: ${safe.clientCpf}`] : []),
      ...(safe.propertyTitle ? [`Imovel: ${safe.propertyTitle}`] : []),
      `Corretor: ${safe.brokerName}`,
      `Data: ${safe.contractDateLabel}`,
    ],
    10,
    'normal',
  );

  y += 8;
  textBlock(['Condições financeiras'], 11, 'bold');
  textBlock(
    [
      `Valor total: ${formatBrl(input.totalValue)}`,
      `Entrada: ${formatBrl(input.downPayment)}`,
      `Financiado: ${formatBrl(input.financedAmount)}`,
      `Banco: ${safe.bankName}`,
      `Parcela / prazo: ${formatBrl(input.installmentValue)} x ${input.months} meses`,
    ],
    10,
    'normal',
  );

  y += 8;
  textBlock(['Texto da minuta'], 11, 'bold');
  const bodyLines = safe.contractText.split('\n');
  textBlock(bodyLines.length ? bodyLines : ['(sem texto)'], 9, 'normal', 1.4);

  // Rodapé em todas as páginas (somente Latin-1 / ASCII)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    const foot =
      'Documento gerado pelo ImobiFlow - nao substitui assinatura em cartorio nem contrato bancario definitivo.';
    const footLines = doc.splitTextToSize(foot, maxW);
    let fy = pageH - margin;
    for (let j = footLines.length - 1; j >= 0; j--) {
      doc.text(String(footLines[j]), margin, fy);
      fy -= 10;
    }
  }

  try {
    const out = doc.output('blob');
    if (out instanceof Blob) return out;
  } catch {
    /* continua com arraybuffer */
  }
  const buf = doc.output('arraybuffer');
  return new Blob([buf], { type: 'application/pdf' });
}
