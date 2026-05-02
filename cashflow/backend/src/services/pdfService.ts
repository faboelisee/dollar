import PDFDocument from 'pdfkit';
import type { CashRegister, CashRegisterBalance } from '@prisma/client';

export async function generateClosurePdf(
  cashRegister: CashRegister,
  balance: CashRegisterBalance
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const blue = '#1B4F72';
    const green = '#27AE60';
    const red = '#E74C3C';

    // Header
    doc
      .fillColor(blue)
      .fontSize(22)
      .text('RAPPORT DE CLÔTURE DE CAISSE', { align: 'center' })
      .moveDown(0.5);

    doc
      .fillColor('#7F8C8D')
      .fontSize(10)
      .text(`Généré le ${new Date().toLocaleString('fr-CI')}`, { align: 'center' })
      .moveDown(1.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ECF0F1').stroke().moveDown(1);

    // Caisse info
    doc.fillColor('#2C3E50').fontSize(14).text('Informations de la caisse').moveDown(0.5);

    const infoRows = [
      ['Caisse', cashRegister.name],
      ['Type', cashRegister.type],
      ['Devise', cashRegister.currency],
      ['Date de clôture', balance.date.toLocaleDateString('fr-CI')],
      ['Heure de clôture', balance.closedAt?.toLocaleTimeString('fr-CI') ?? 'N/A'],
    ];

    infoRows.forEach(([label, value]) => {
      doc.fontSize(10);
      doc.fillColor('#7F8C8D').text(label, 50, doc.y, { continued: true });
      doc.fillColor('#2C3E50').text(`: ${value}`, { align: 'left' });
    });

    doc.moveDown(1.5);

    // Balances
    doc.fillColor('#2C3E50').fontSize(14).text('Récapitulatif financier').moveDown(0.5);

    const variance = Number(balance.variance ?? 0);
    const isExcess = variance > 0;

    const financialRows = [
      ['Solde d\'ouverture', Number(balance.openingBalance)],
      ['Total encaissements', Number(balance.totalInflows)],
      ['Total décaissements', Number(balance.totalOutflows)],
      ['Solde théorique', Number(balance.theoreticalBalance)],
      ['Solde physique (comptage)', Number(balance.physicalBalance ?? 0)],
    ];

    financialRows.forEach(([label, value]) => {
      doc.fontSize(11);
      doc.fillColor('#7F8C8D').text(label as string, 50, doc.y, { continued: true });
      doc.fillColor('#2C3E50').text(`: ${(value as number).toLocaleString('fr-CI')} ${cashRegister.currency}`);
    });

    doc.moveDown(0.5);

    // Variance highlight
    const varianceColor = Math.abs(variance) <= 500 ? green : red;
    doc
      .fillColor(varianceColor)
      .fontSize(13)
      .text(
        `Écart de caisse : ${isExcess ? '+' : ''}${variance.toLocaleString('fr-CI')} ${cashRegister.currency}`,
        50,
        doc.y
      )
      .moveDown(2);

    // Signature area
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ECF0F1').stroke().moveDown(1);

    doc.fillColor('#2C3E50').fontSize(12).text('Signatures').moveDown(1);

    doc.fontSize(10);
    const sigY = doc.y;

    doc.text('Caissier :', 50, sigY);
    doc.text('Superviseur :', 300, sigY);

    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(220, doc.y).strokeColor('#2C3E50').stroke();
    doc.moveTo(300, sigY + 30).lineTo(470, sigY + 30).strokeColor('#2C3E50').stroke();

    doc.end();
  });
}

export async function generateOperationPdf(
  companyId: string,
  filters: Record<string, unknown>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fillColor('#1B4F72').fontSize(18).text('JOURNAL DES OPÉRATIONS', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#7F8C8D').text('Document généré par CashFlow CI', { align: 'center' });

    doc.end();
  });
}
