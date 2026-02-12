/**
 * Email + PDF module for reservation confirmations.
 * Uses nodemailer (SMTP) and PDFKit with NotoSans (Cyrillic-supporting fonts).
 */
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = path.join(__dirname, '..', 'fonts', 'NotoSans-Regular.ttf');
const FONT_BOLD    = path.join(__dirname, '..', 'fonts', 'NotoSans-Bold.ttf');

// ─── Helpers ───
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
}
function fmtMoney(v) { return `€${Number(v || 0).toFixed(2)}`; }

/* Strip legacy parenthetical date/qty suffixes from stored descriptions */
function cleanDesc(d) {
  if (!d) return d;
  d = d.replace(/\s*\(\d{2}[\.\-]\d{2}[\.\-]\d{4}\s*г?\.?\s*→\s*\d{2}[\.\-]\d{2}[\.\-]\d{4}\s*г?\.?\s*\)$/, '');
  d = d.replace(/\s*\(\d+\s*дни?\s*(?:[×x]\s*€?\d+[\.,]?\d*\/ден)?\)$/, '');
  return d.trim();
}

function normalizeItems(raw) {
  return (raw || []).map(it => {
    const qty = Number(it.qty || 1);
    const unitPrice = Number(it.unitPrice || 0);
    const vatRate = Number(it.vatRate || 20);
    const totalGross = qty * unitPrice;
    const totalNet = totalGross / (1 + vatRate / 100);
    const totalVat = totalGross - totalNet;
    return { description: cleanDesc(it.description) || '', qty, unitPrice, vatRate, totalNet, totalVat, totalGross };
  });
}
function calcTotals(items) {
  let subtotal = 0, vatAmount = 0, total = 0;
  for (const it of items) {
    subtotal += it.totalNet;
    vatAmount += it.totalVat;
    total += it.totalGross;
  }
  return { subtotal, vatAmount, total };
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Draw a table row (helper) ───
function drawTableRow(doc, y, cols, options = {}) {
  const { bold, bg, textColor, fontSize = 8.5, height = 22 } = options;
  if (bg) {
    doc.save().rect(40, y, 515, height).fill(bg).restore();
  }
  let x = 40;
  for (const col of cols) {
    const w = col.width || 80;
    const align = col.align || 'left';
    doc.font(bold ? 'NotoSans-Bold' : 'NotoSans').fontSize(fontSize);
    const color = col.color || textColor || '#333333';
    doc.fillColor(color);
    const pad = 5;
    let textX = x + pad;
    const textOpts = { width: w - pad * 2, align, lineBreak: false };
    doc.text(col.text || '', textX, y + 6, textOpts);
    x += w;
  }
  // Bottom border
  doc.save().moveTo(40, y + height).lineTo(555, y + height).lineWidth(0.5).strokeColor('#E5E7EB').stroke().restore();
  return y + height;
}

// ─── Generate Proforma PDF buffer ───
// Design matches the admin invoice viewer: blue (#1E3A8A) header, party cards, styled table, totals box, policy pages
async function generateProformaPdf({ reservation, invoice, company, policies }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const chunks = [];
  doc.on('data', c => chunks.push(c));

  // Register Cyrillic-supporting fonts
  doc.registerFont('NotoSans', FONT_REGULAR);
  doc.registerFont('NotoSans-Bold', FONT_BOLD);

  const days = Math.max(1, Math.ceil((new Date(reservation.to) - new Date(reservation.from)) / 86400000));
  const car = reservation.car || {};
  const rate = reservation.ratePerDay || Number(car.pricePerDay || 0);
  const extraDriverRate = Number(company?.extraDriverPrice || 10);
  const insuranceRate = Number(company?.insurancePrice || 15);

  // Build items
  let rawItems = [];
  if (invoice && invoice.items) {
    try { rawItems = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items; } catch { rawItems = []; }
  }
  if (!rawItems.length) {
    rawItems = [{
      description: `Наем на автомобил ${car.brand || ''} ${car.model || ''}`.trim(),
      qty: days, unitPrice: rate, vatRate: 20
    }];
    if (reservation.extraDriver) {
      rawItems.push({ description: 'Допълнителен шофьор', qty: days, unitPrice: extraDriverRate, vatRate: 20 });
    }
    if (reservation.insurance) {
      rawItems.push({ description: 'Пълно каско (Full Coverage)', qty: days, unitPrice: insuranceRate, vatRate: 20 });
    }
  }
  const items = normalizeItems(rawItems);
  const totals = calcTotals(items);

  const sup = {
    name: invoice?.supplierName || company?.name || '',
    eik: invoice?.supplierEik || company?.eik || '',
    vat: invoice?.supplierVat || company?.vat || '',
    mol: invoice?.supplierMol || company?.mol || '',
    addr: invoice?.supplierAddr || company?.address || '',
    email: invoice?.supplierEmail || company?.email || '',
    phone: invoice?.supplierPhone || company?.phone || '',
    bank: invoice?.supplierBank || company?.bank || '',
    iban: invoice?.supplierIban || company?.iban || '',
    bic: invoice?.supplierBic || company?.bic || ''
  };

  const buyerType = invoice?.buyerType || reservation.invoiceType || 'individual';
  const buyer = {
    name: invoice?.buyerName || reservation.invoiceName || reservation.driverName || '',
    eik: invoice?.buyerEik || reservation.invoiceNum || '',
    vat: invoice?.buyerVat || reservation.invoiceVat || '',
    egn: invoice?.buyerEgn || reservation.invoiceEgn || '',
    mol: invoice?.buyerMol || reservation.invoiceMol || '',
    addr: invoice?.buyerAddr || reservation.invoiceAddr || '',
    email: invoice?.buyerEmail || reservation.invoiceEmail || ''
  };

  const invType = invoice?.type === 'INVOICE' ? 'ФАКТУРА' : 'ПРОФОРМА';
  const invNumber = invoice?.number || '(чернова)';
  const invDate = fmtDate(invoice?.issueDate || new Date());
  const invCurrency = invoice?.currency || 'EUR';

  // ═════════════════════════════════════════════
  // PAGE 1: INVOICE/PROFORMA  (matches admin design)
  // ═════════════════════════════════════════════

  // ── Header row: Logo/Company | Title | Meta box ──
  let y = 40;

  // Company name (left)
  doc.font('NotoSans-Bold').fontSize(14).fillColor('#111827')
    .text(sup.name || 'Company', 40, y, { width: 200 });
  y += 22;

  // Title (center - large)
  doc.font('NotoSans-Bold').fontSize(22).fillColor('#1E3A8A')
    .text(invType, 200, 38, { width: 160, align: 'center' });

  // Meta box (right) - border box
  const metaX = 380, metaY = 36, metaW = 175, metaH = 80;
  doc.save()
    .roundedRect(metaX, metaY, metaW, metaH, 6)
    .lineWidth(1.5).strokeColor('#2563EB').stroke()
    .restore();
  doc.save()
    .roundedRect(metaX, metaY, metaW, metaH, 6)
    .fill('#F3F4F6')
    .restore();
  doc.save()
    .roundedRect(metaX, metaY, metaW, metaH, 6)
    .lineWidth(1.5).strokeColor('#2563EB').stroke()
    .restore();

  let metaContentY = metaY + 8;
  doc.font('NotoSans').fontSize(8).fillColor('#6B7280').text('Номер', metaX + 10, metaContentY);
  doc.font('NotoSans-Bold').fontSize(10).fillColor('#111827').text(invNumber, metaX + 10, metaContentY + 10);
  metaContentY += 26;
  doc.font('NotoSans').fontSize(8).fillColor('#6B7280').text('Дата', metaX + 10, metaContentY);
  doc.font('NotoSans-Bold').fontSize(10).fillColor('#111827').text(invDate, metaX + 10, metaContentY + 10);
  metaContentY += 26;
  doc.font('NotoSans').fontSize(8).fillColor('#6B7280').text('Валута', metaX + 100, metaY + 8);
  doc.font('NotoSans-Bold').fontSize(10).fillColor('#111827').text(invCurrency, metaX + 100, metaY + 18);

  // ── Parties section ──
  y = metaY + metaH + 16;

  // Supplier card
  const cardW = 250;
  doc.save().roundedRect(40, y, cardW, 110, 6).lineWidth(0.5).strokeColor('#E5E7EB').fillAndStroke('#FAFAFA', '#E5E7EB').restore();
  // Card header
  doc.font('NotoSans-Bold').fontSize(9).fillColor('#6B7280').text('ДОСТАВЧИК', 52, y + 8, { width: cardW - 24 });
  doc.save().moveTo(52, y + 20).lineTo(52 + cardW - 24, y + 20).lineWidth(1.5).strokeColor('#2563EB').stroke().restore();
  doc.font('NotoSans-Bold').fontSize(11).fillColor('#111827').text(sup.name, 52, y + 26, { width: cardW - 24 });
  doc.font('NotoSans').fontSize(8).fillColor('#111827');
  let sy = y + 40;
  doc.text(`ЕИК: ${sup.eik || '—'}${sup.vat ? '  |  ДДС №: ' + sup.vat : ''}`, 52, sy, { width: cardW - 24 }); sy += 12;
  doc.text(`МОЛ: ${sup.mol || '—'}`, 52, sy, { width: cardW - 24 }); sy += 12;
  doc.text(sup.addr || '—', 52, sy, { width: cardW - 24 }); sy += 12;
  doc.text(`${sup.email || '—'}  |  ${sup.phone || '—'}`, 52, sy, { width: cardW - 24 }); sy += 12;
  doc.text(`Банка: ${sup.bank || '—'}`, 52, sy, { width: cardW - 24 }); sy += 12;
  doc.text(`IBAN: ${sup.iban || '—'}  |  BIC: ${sup.bic || '—'}`, 52, sy, { width: cardW - 24 });

  // Buyer card
  const buyerX = 40 + cardW + 15;
  doc.save().roundedRect(buyerX, y, cardW, 110, 6).lineWidth(0.5).strokeColor('#E5E7EB').fillAndStroke('#FAFAFA', '#E5E7EB').restore();
  doc.font('NotoSans-Bold').fontSize(9).fillColor('#6B7280').text('ПОЛУЧАТЕЛ', buyerX + 12, y + 8, { width: cardW - 24 });
  doc.save().moveTo(buyerX + 12, y + 20).lineTo(buyerX + 12 + cardW - 24, y + 20).lineWidth(1.5).strokeColor('#2563EB').stroke().restore();
  doc.font('NotoSans-Bold').fontSize(11).fillColor('#111827').text(buyer.name || '—', buyerX + 12, y + 26, { width: cardW - 24 });
  doc.font('NotoSans').fontSize(8).fillColor('#111827');
  let by = y + 40;
  if (buyerType === 'company') {
    doc.text(`ЕИК: ${buyer.eik || '—'}${buyer.vat ? '  |  ДДС №: ' + buyer.vat : ''}`, buyerX + 12, by, { width: cardW - 24 }); by += 12;
  } else {
    doc.text(`ЕГН: ${buyer.egn || '—'}`, buyerX + 12, by, { width: cardW - 24 }); by += 12;
  }
  if (buyer.mol) { doc.text(`МОЛ: ${buyer.mol}`, buyerX + 12, by, { width: cardW - 24 }); by += 12; }
  doc.text(buyer.addr || '—', buyerX + 12, by, { width: cardW - 24 }); by += 12;
  doc.text(buyer.email || '—', buyerX + 12, by, { width: cardW - 24 });

  // ── Items Table ──
  y += 120;
  const colW = [185, 40, 65, 40, 65, 55, 65];

  // Header row with blue bg
  doc.save().rect(40, y, 515, 24).fill('#1E3A8A').restore();
  let hx = 40;
  const headers = ['Описание', 'Кол-во', 'Ед. цена (с ДДС)', 'ДДС %', 'Сума без ДДС', 'ДДС', 'Общо с ДДС'];
  const hAligns = ['left', 'center', 'right', 'center', 'right', 'right', 'right'];
  for (let i = 0; i < headers.length; i++) {
    doc.font('NotoSans-Bold').fontSize(7.5).fillColor('#FFFFFF');
    doc.text(headers[i], hx + 5, y + 7, { width: colW[i] - 10, align: hAligns[i], lineBreak: false });
    hx += colW[i];
  }
  y += 24;

  // Data rows
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const rowBg = idx % 2 === 1 ? '#F9FAFB' : null;
    if (rowBg) doc.save().rect(40, y, 515, 22).fill(rowBg).restore();
    let rx = 40;
    const vals = [it.description, String(it.qty), fmtMoney(it.unitPrice), `${it.vatRate}%`, fmtMoney(it.totalNet), fmtMoney(it.totalVat), fmtMoney(it.totalGross)];
    const bolds = [true, false, false, false, false, false, true];
    const colors = ['#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#1E3A8A'];
    for (let i = 0; i < vals.length; i++) {
      doc.font(bolds[i] ? 'NotoSans-Bold' : 'NotoSans').fontSize(8).fillColor(colors[i]);
      doc.text(vals[i], rx + 5, y + 6, { width: colW[i] - 10, align: hAligns[i], lineBreak: false });
      rx += colW[i];
    }
    // Row date meta (below description)
    // Bottom border
    doc.save().moveTo(40, y + 22).lineTo(555, y + 22).lineWidth(0.3).strokeColor('#E5E7EB').stroke().restore();
    y += 22;
  }

  // ── Totals Box ──
  y += 16;
  const totBoxX = 300, totBoxW = 255;
  doc.save().roundedRect(totBoxX, y, totBoxW, 80, 6).lineWidth(1).strokeColor('#E5E7EB').stroke().restore();

  // Subtotal
  doc.font('NotoSans').fontSize(9).fillColor('#374151')
    .text('Данъчна основа (без ДДС)', totBoxX + 12, y + 10, { width: 140 });
  doc.font('NotoSans').fontSize(9).fillColor('#374151')
    .text(fmtMoney(totals.subtotal), totBoxX + 155, y + 10, { width: 90, align: 'right' });

  // VAT
  doc.text('ДДС (20%)', totBoxX + 12, y + 26, { width: 140 });
  doc.text(fmtMoney(totals.vatAmount), totBoxX + 155, y + 26, { width: 90, align: 'right' });

  // Separator
  doc.save().moveTo(totBoxX + 12, y + 42).lineTo(totBoxX + totBoxW - 12, y + 42).lineWidth(0.5).strokeColor('#D1D5DB').stroke().restore();

  // Grand total (blue box)
  doc.save().roundedRect(totBoxX + 6, y + 48, totBoxW - 12, 26, 5).fill('#1E3A8A').restore();
  doc.font('NotoSans-Bold').fontSize(12).fillColor('#FFFFFF')
    .text('Общо (с ДДС)', totBoxX + 14, y + 53, { width: 120 });
  doc.font('NotoSans-Bold').fontSize(14).fillColor('#FFFFFF')
    .text(fmtMoney(totals.total), totBoxX + 140, y + 52, { width: 105, align: 'right' });

  // ── Footer ──
  y += 100;
  doc.save().moveTo(40, y).lineTo(555, y).lineWidth(1).strokeColor('#E5E7EB').stroke().restore();
  y += 8;
  doc.font('NotoSans').fontSize(8).fillColor('#9CA3AF')
    .text(`Генерирана от системата на ${fmtDate(new Date())}`, 40, y, { width: 250 });
  if (invoice?.paymentMethod) {
    doc.text(`Начин на плащане: ${invoice.paymentMethod}`, 300, y, { width: 255, align: 'right' });
  }

  // ═════════════════════════════════════════════
  // POLICY PAGES
  // ═════════════════════════════════════════════
  if (policies && policies.length) {
    const companyName = company?.name || '';
    const companyEik = company?.eik || '';
    const companyAddr = company?.address || '';
    const companyEmail = company?.email || '';
    const companyPhone = company?.phone || '';
    const edPrice = Number(company?.extraDriverPrice ?? 10).toFixed(2);
    const insPrice = Number(company?.insurancePrice ?? 15).toFixed(2);

    for (const pol of policies) {
      doc.addPage();
      let text = stripHtml(pol.content || '');
      text = text.replace(/\{\{company_name\}\}/g, companyName)
        .replace(/\{\{company_eik\}\}/g, companyEik)
        .replace(/\{\{company_address\}\}/g, companyAddr)
        .replace(/\{\{company_email\}\}/g, companyEmail)
        .replace(/\{\{company_phone\}\}/g, companyPhone)
        .replace(/\{\{company_phone_clean\}\}/g, (companyPhone || '').replace(/\s/g, ''))
        .replace(/\{\{extra_driver_price\}\}/g, edPrice)
        .replace(/\{\{insurance_price\}\}/g, insPrice);

      // Policy title (blue header bar)
      doc.save().roundedRect(40, 40, 515, 30, 4).fill('#1E3A8A').restore();
      doc.font('NotoSans-Bold').fontSize(13).fillColor('#FFFFFF')
        .text(pol.title || '', 50, 47, { width: 495, align: 'center' });

      // Policy body text
      doc.font('NotoSans').fontSize(8.5).fillColor('#374151');
      doc.text(text, 40, 85, { width: 515, lineGap: 3 });
    }
  }

  doc.end();
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

// ─── Send confirmation email ───
async function sendReservationEmail({ reservation, invoice, company, policies }) {
  const smtp = {
    host: company?.smtpHost,
    port: company?.smtpPort || 587,
    user: company?.smtpUser,
    pass: company?.smtpPass,
    from: company?.smtpFrom || company?.email
  };

  if (!smtp.host || !smtp.user || !smtp.pass) {
    console.log('[mailer] SMTP not configured — skipping email');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const driverEmail = reservation.driverEmail;
  if (!driverEmail) {
    console.log('[mailer] No driver email — skipping email');
    return { sent: false, reason: 'No recipient email' };
  }

  const car = reservation.car || {};
  const days = Math.max(1, Math.ceil((new Date(reservation.to) - new Date(reservation.from)) / 86400000));
  const companyName = company?.name || 'Meniar.com';

  // Generate PDF
  let pdfBuffer;
  try {
    pdfBuffer = await generateProformaPdf({ reservation, invoice, company, policies });
  } catch (err) {
    console.error('[mailer] PDF generation failed:', err.message);
    return { sent: false, reason: 'PDF generation failed: ' + err.message };
  }

  // Compose email
  const subject = `Потвърждение на резервация #${reservation.seq || '—'} | ${companyName}`;
  const htmlBody = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: #1E3A8A; color: #fff; padding: 24px 28px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">${companyName}</h1>
        <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Потвърждение на резервация</p>
      </div>
      <div style="background: #fff; padding: 28px; border: 1px solid #E5E7EB; border-top: none;">
        <p>Здравейте, <strong>${reservation.driverName || 'клиент'}</strong>!</p>
        <p>Вашата резервация е получена успешно. Ето детайлите:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 10px 12px; color: #6B7280; width: 40%;">Резервация №</td>
            <td style="padding: 10px 12px; font-weight: 600;">${reservation.seq || '—'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">
            <td style="padding: 10px 12px; color: #6B7280;">Автомобил</td>
            <td style="padding: 10px 12px; font-weight: 600;">${car.brand || ''} ${car.model || ''} ${car.year ? '(' + car.year + ')' : ''}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 10px 12px; color: #6B7280;">Период</td>
            <td style="padding: 10px 12px;">${fmtDate(reservation.from)} — ${fmtDate(reservation.to)} <span style="color:#6B7280;">(${days} ${days === 1 ? 'ден' : 'дни'})</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB; background: #F9FAFB;">
            <td style="padding: 10px 12px; color: #6B7280;">Вземане от</td>
            <td style="padding: 10px 12px;">${reservation.pickPlace || '—'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 10px 12px; color: #6B7280;">Връщане в</td>
            <td style="padding: 10px 12px;">${reservation.dropPlace || '—'}</td>
          </tr>
          ${reservation.extraDriver ? '<tr style="border-bottom: 1px solid #E5E7EB; background: #F9FAFB;"><td style="padding: 10px 12px; color: #6B7280;">Допълнителен шофьор</td><td style="padding: 10px 12px; color: #059669; font-weight: 600;">&#10003; Включен</td></tr>' : ''}
          ${reservation.insurance ? '<tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 12px; color: #6B7280;">Пълно каско</td><td style="padding: 10px 12px; color: #059669; font-weight: 600;">&#10003; Включено</td></tr>' : ''}
          <tr style="background: #EEF2FF;">
            <td style="padding: 12px; color: #1E3A8A; font-weight: 700; font-size: 15px;">Обща сума</td>
            <td style="padding: 12px; color: #1E3A8A; font-weight: 700; font-size: 18px;">&euro;${Number(reservation.total || 0).toFixed(2)}</td>
          </tr>
        </table>

        <p style="margin: 20px 0 8px; font-size: 13px; color: #6B7280;">&#128206; Приложена е проформа фактура с детайли и условия (PDF).</p>
        
        <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-weight: 600;">Какво следва?</p>
          <p style="margin: 0; font-size: 13px; color: #6B7280;">Нашият екип ще прегледа резервацията и ще се свърже с вас за потвърждение и инструкции за плащане.</p>
        </div>
      </div>
      <div style="padding: 16px 28px; background: #F3F4F6; border-radius: 0 0 12px 12px; text-align: center; font-size: 12px; color: #9CA3AF;">
        <p style="margin: 0;">${companyName} | ${company?.phone || ''} | ${company?.email || ''}</p>
      </div>
    </div>
  `;

  // Send
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    tls: { rejectUnauthorized: false }
  });

  const invNumber = invoice?.number || 'proforma';
  try {
    const info = await transporter.sendMail({
      from: `"${companyName}" <${smtp.from}>`,
      to: driverEmail,
      subject,
      html: htmlBody,
      attachments: [{
        filename: `${invNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });
    console.log(`[mailer] Email sent to ${driverEmail}, messageId=${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] Send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

export { sendReservationEmail, generateProformaPdf };
