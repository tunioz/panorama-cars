import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { sendReservationEmail } from './mailer.js';

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 5175;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5174';

// [SECURITY] Require JWT_SECRET in production — refuse to start without it
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY] FATAL: JWT_SECRET env var is not set in production! Exiting.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me_local_only';

// [V3] Startup diagnostics — never log credentials
console.log('[boot] DATABASE_URL =', process.env.DATABASE_URL ? '***configured***' : 'MISSING');
console.log('[boot] PORT =', PORT);
console.log('[boot] CWD =', process.cwd());
console.log('[boot] NODE_ENV =', process.env.NODE_ENV);

// [V9] CORS — restrict in production, permissive in development
const corsOptions = process.env.NODE_ENV === 'production'
  ? { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false, credentials: true }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,  // CSP is set via meta tag in index.html
  hsts: { maxAge: 31536000, includeSubDomains: true } // [V16] HSTS
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// [V10] Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: 'Too many login attempts, please try again later.' } });
const apiWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Too many requests, please slow down.' } });
const newsletterLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: 'Too many subscription attempts.' } });
const publicReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, message: { error: 'Too many requests, please slow down.' } });
// Prevent browser from caching API responses (ensures fresh data after admin edits)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Upload helpers
const uploadRoot = path.join(process.cwd(), 'uploads', 'cars');
fs.mkdirSync(uploadRoot, { recursive: true });
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const carId = req.params.id;
    const dir = path.join(uploadRoot, carId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const base = `img_${Date.now()}_${Math.floor(Math.random()*1e6)}${ext}`;
    cb(null, base);
  }
});
// [V5] File type filter + size limit for car image uploads
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max per file
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|avif|heic|heif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, WebP, AVIF, HEIC) are allowed'));
  }
});

// ─── File persistence: store uploads in PostgreSQL so they survive deploys ───
async function fileSave(relPath, absPath, mime) {
  try {
    const data = fs.readFileSync(absPath);
    await prisma.fileStore.upsert({
      where: { path: relPath },
      create: { path: relPath, data, mimeType: mime || 'image/jpeg' },
      update: { data, mimeType: mime || 'image/jpeg' }
    });
  } catch (e) { console.error('[fileStore] save error:', relPath, e.message); }
}
async function fileDelete(relPath) {
  try { await prisma.fileStore.delete({ where: { path: relPath } }); } catch {}
}
async function fileDeletePrefix(prefix) {
  try { await prisma.fileStore.deleteMany({ where: { path: { startsWith: prefix } } }); } catch {}
}
// Restore all persisted files from DB to filesystem on startup
async function restoreUploads() {
  try {
    const files = await prisma.fileStore.findMany();
    let restored = 0;
    for (const f of files) {
      // Skip bare filenames (legacy root copies) — only restore uploads/ paths
      if (!f.path.startsWith('uploads/')) continue;
      const abs = path.join(process.cwd(), f.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, f.data);
      restored++;
    }
    if (restored > 0) console.log(`[fileStore] Restored ${restored} files from database (DB is source of truth)`);
    else if (files.length > 0) console.log(`[fileStore] No upload files to restore (${files.length} records in DB)`);
  } catch (e) { console.error('[fileStore] restore error:', e.message); }

  // Seed site images: if on disk but not in DB, persist to FileStore
  try {
    const SITE_IMG_KEYS = [
      'hero-bg', 'about-cars', 'cta-bg', 'about-hero-bg',
      'about-video', 'memories-family',
      'face-georgi', 'face-maria', 'face-petar'
    ];
    const siteDir = path.join(process.cwd(), 'uploads', 'site');
    fs.mkdirSync(siteDir, { recursive: true });
    let seeded = 0;
    for (const key of SITE_IMG_KEYS) {
      const relPath = `uploads/site/${key}.jpg`;
      const destFile = path.join(siteDir, `${key}.jpg`);
      // Already in DB (restored above) — skip
      const inDb = await prisma.fileStore.findUnique({ where: { path: relPath } });
      if (inDb) continue;
      // On disk but not in DB — seed into FileStore
      if (fs.existsSync(destFile)) {
        await fileSave(relPath, destFile, 'image/jpeg');
        seeded++;
      }
    }
    if (seeded > 0) console.log(`[fileStore] Seeded ${seeded} site images into database`);
  } catch (e) { console.error('[fileStore] site image seed error:', e.message); }

  // Seed any existing car images on disk that are NOT yet in FileStore
  try {
    const carsDir = path.join(process.cwd(), 'uploads', 'cars');
    if (fs.existsSync(carsDir)) {
      let carSeeded = 0;
      const carFolders = fs.readdirSync(carsDir, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const folder of carFolders) {
        const folderPath = path.join(carsDir, folder.name);
        const imgFiles = fs.readdirSync(folderPath).filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));
        for (const imgFile of imgFiles) {
          const relPath = `uploads/cars/${folder.name}/${imgFile}`;
          const absPath = path.join(folderPath, imgFile);
          const exists = await prisma.fileStore.findUnique({ where: { path: relPath } });
          if (!exists) {
            await fileSave(relPath, absPath, 'image/jpeg');
            carSeeded++;
          }
        }
      }
      if (carSeeded > 0) console.log(`[fileStore] Seeded ${carSeeded} existing car images into database`);
    }
  } catch (e) { console.error('[fileStore] car image seed error:', e.message); }

  // Clean up legacy bare-filename entries (old root copies no longer needed)
  try {
    const legacy = await prisma.fileStore.findMany({ where: { path: { not: { startsWith: 'uploads/' } } } });
    if (legacy.length > 0) {
      await prisma.fileStore.deleteMany({ where: { path: { not: { startsWith: 'uploads/' } } } });
      console.log(`[fileStore] Cleaned up ${legacy.length} legacy root-copy entries`);
    }
  } catch (e) { console.error('[fileStore] cleanup error:', e.message); }
}
// Run restore on startup (non-blocking)
restoreUploads();

// Helpers
function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function auth(requiredRole) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (requiredRole && decoded.role !== requiredRole) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
async function logAction(userId, action, meta) {
  try { await prisma.log.create({ data: { userId, action, meta } }); } catch (e) { /* ignore */ }
}
const ALLOWED_RES_STATUS = ['REQUESTED','APPROVED','DECLINED','CANCELLED','PAID','COMPLETED'];
// Valid status transitions (state machine)
const STATUS_TRANSITIONS = {
  'REQUESTED': ['APPROVED', 'DECLINED', 'CANCELLED'],
  'APPROVED':  ['PAID', 'DECLINED', 'CANCELLED'],
  'DECLINED':  [],  // terminal
  'CANCELLED': [],  // terminal
  'PAID':      ['COMPLETED'],
  'COMPLETED': []   // terminal
};
function normalizeStatusValue(v) {
  if (!v) return null;
  const up = v.toString().toUpperCase();
  return ALLOWED_RES_STATUS.includes(up) ? up : null;
}
async function normalizeReservationExpiry(resList) {
  const now = new Date();
  for (const r of resList) {
    const st = normalizeStatusValue(r.status);
    const toDate = new Date(r.to);
    if (st !== 'DECLINED' && st !== 'COMPLETED' && toDate < now) {
      await prisma.reservation.update({ where: { id: r.id }, data: { status: 'COMPLETED' } });
      r.status = 'COMPLETED';
    }
  }
}
/* Strip legacy parenthetical date/qty suffixes from stored descriptions */
function cleanDesc(d) {
  if (!d) return d;
  d = d.replace(/\s*\(\d{2}[\.\-]\d{2}[\.\-]\d{4}\s*г?\.?\s*→\s*\d{2}[\.\-]\d{2}[\.\-]\d{4}\s*г?\.?\s*\)$/, '');
  d = d.replace(/\s*\(\d+\s*дни?\s*(?:[×x]\s*€?\d+[\.,]?\d*\/ден)?\)$/, '');
  return d.trim();
}

// Round to 2 decimal places (safe for financial calculations with Float)
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// Sanitize HTML — strip dangerous tags/attributes, keep safe formatting
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return html;
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove event handlers (onclick, onerror, onload, etc.)
  html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: protocol in href/src
  html = html.replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');
  // Remove iframe, object, embed, form tags
  html = html.replace(/<\/?(iframe|object|embed|form|input|textarea|button)\b[^>]*>/gi, '');
  return html;
}

function normalizeItems(items) {
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) return [];
  return items.map(it => {
    const qty = Number(it.qty ?? it.quantity ?? 1);
    const unitPrice = round2(Number(it.unitPrice ?? it.price ?? 0)); // цена С ДДС
    const vatRate = Number(it.vatRate ?? 20);
    const totalGross = round2(qty * unitPrice); // обща сума С ДДС
    const totalNet = round2(totalGross / (1 + vatRate / 100)); // обща сума БЕЗ ДДС
    const totalVat = round2(totalGross - totalNet); // сума на ДДС
    return {
      description: cleanDesc(it.description) || 'Услуга',
      qty,
      unitPrice,
      vatRate,
      totalNet,
      totalVat,
      totalGross
    };
  });
}
function calcTotals(items) {
  const subtotal = round2(items.reduce((s, it) => s + (it.totalNet || 0), 0));
  const vatAmount = round2(items.reduce((s, it) => s + (it.totalVat || 0), 0));
  const total = round2(items.reduce((s, it) => s + (it.totalGross || 0), 0));
  return { subtotal, vatAmount, total };
}
function fmtDateBg(d) {
  try { return new Date(d).toLocaleDateString('bg-BG'); } catch { return ''; }
}
async function ensureInvoiceNumber(number, type = 'PROFORMA') {
  if (!number) return;
  const re = type === 'INVOICE'
    ? /^\d{10}$/ // 10 дигити за фактура
    : /^(PF-\d{4,}|\d{4,})$/; // по-гъвкаво за проформа
  if (!re.test(number)) throw new Error('Invalid invoice number format');
  const exists = await prisma.invoice.findUnique({ where: { number } });
  if (exists) {
    throw new Error('Invoice number already exists');
  }
}
async function generateInvoiceNumber(type = 'PROFORMA', issueDate = new Date(), starts = {}, tx = null) {
  const db = tx || prisma;
  if (type === 'INVOICE') {
    const invStart = starts.invStart || 1;
    const list = await db.invoice.findMany({ where: { type: 'INVOICE' }, select: { number: true } });
    let maxNum = invStart - 1;
    list.forEach(n => {
      const m = n.number?.match(/^(\d{10})$/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    });
    const next = maxNum + 1;
    const candidate = String(next).padStart(10, '0');
    await ensureInvoiceNumber(candidate, 'INVOICE');
    return candidate;
  } else {
    const proStart = starts.proStart || 1;
    const list = await db.invoice.findMany({ where: { type: 'PROFORMA' }, select: { number: true } });
    let maxNum = proStart - 1;
    list.forEach(n => {
      const m = n.number?.match(/(?:PF-)?(\d{4,})$/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    });
    const candidate = `PF-${String(maxNum + 1).padStart(4, '0')}`;
    await ensureInvoiceNumber(candidate, 'PROFORMA');
    return candidate;
  }
}
async function ensureInvoicesForPaidReservations(companyCache) {
  const company = companyCache || await prisma.companyInfo.findFirst();
  const paid = await prisma.reservation.findMany({
    where: {
      status: 'PAID',
      invoices: { none: { type: 'INVOICE' } }
    },
    include: { car: true, invoices: true }
  });
  for (const r of paid) {
    try { await createInvoiceForReservation(r, 'INVOICE', company); } catch (e) { /* ignore */ }
  }
}
async function createInvoiceForReservation(reservation, type = 'PROFORMA', companyCache) {
  if (!reservation) return null;
  // Use a serializable transaction to prevent invoice number race conditions
  return await prisma.$transaction(async (tx) => {
    return await _createInvoiceInTx(tx, reservation, type, companyCache);
  }, { isolationLevel: 'Serializable' });
}
async function _createInvoiceInTx(tx, reservation, type, companyCache) {
  const company = companyCache || await tx.companyInfo.findFirst();
  const car = reservation.car || (reservation.carId ? await tx.car.findUnique({ where: { id: reservation.carId } }) : null);
  const issueDate = new Date();
  const number = await generateInvoiceNumber(type, issueDate, { proStart: company?.proStart, invStart: company?.invStart }, tx);
  const days = Math.max(1, Math.ceil((new Date(reservation.to) - new Date(reservation.from)) / 86400000));
  const extraDriverRate = Number(company?.extraDriverPrice || 10);
  const insuranceRate = Number(company?.insurancePrice || 15);
  // For existing invoices, recalculate rate from total minus extras
  let baseTotal = Number(reservation.total || 0);
  if (reservation.extraDriver) baseTotal -= extraDriverRate * days;
  if (reservation.insurance) baseTotal -= insuranceRate * days;
  const rate = reservation.ratePerDay || (baseTotal && days ? baseTotal / days : Number(car?.pricePerDay || 0));
  const rawItems = [{
    description: `Наем на автомобил ${car?.brand||reservation.car?.brand||''} ${car?.model||reservation.car?.model||''}`.trim(),
    qty: days,
    unitPrice: rate,
    vatRate: 20
  }];
  if (reservation.extraDriver) {
    rawItems.push({
      description: 'Допълнителен шофьор',
      qty: days,
      unitPrice: extraDriverRate,
      vatRate: 20
    });
  }
  if (reservation.insurance) {
    rawItems.push({
      description: 'Пълно каско (Full Coverage)',
      qty: days,
      unitPrice: insuranceRate,
      vatRate: 20
    });
  }
  const items = normalizeItems(rawItems);
  const { subtotal, vatAmount, total } = calcTotals(items);
  await ensureInvoiceNumber(number, type);
  return await tx.invoice.create({
    data: {
      reservationId: reservation.id,
      type,
      number,
      issueDate,
      currency: 'EUR',
      status: 'ISSUED',
      supplierName: company?.name || '',
      supplierEik: company?.eik || '',
      supplierVat: company?.vat || null,
      supplierAddr: company?.address || '',
      supplierMol: company?.mol || null,
      supplierEmail: company?.email || null,
      supplierPhone: company?.phone || null,
      supplierBank: company?.bank || null,
      supplierIban: company?.iban || null,
      supplierBic: company?.bic || null,
      buyerType: reservation.invoiceType || 'individual',
      buyerName: reservation.invoiceName || reservation.driverName || '',
      buyerEik: reservation.invoiceNum || null,
      buyerVat: reservation.invoiceVat || null,
      buyerEgn: reservation.invoiceEgn || null,
      buyerMol: reservation.invoiceMol || null,
      buyerAddr: reservation.invoiceAddr || null,
      buyerEmail: reservation.invoiceEmail || null,
      buyerBank: reservation.invoiceBank || null,
      buyerIban: reservation.invoiceIban || null,
      buyerBic: reservation.invoiceBic || null,
      items: JSON.stringify(items),
      subtotal,
      vatAmount,
      total
    }
  });
}

// ─── Prevent server crashes from unhandled async errors (Express 4) ───
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err?.message || err);
});

// Health
app.get('/health', async (req, res) => {
  try {
    const carCount = await prisma.car.count();
    const userCount = await prisma.user.count();
    res.json({ ok: true, time: new Date().toISOString(), cars: carCount, users: userCount, db: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// [V1] Auto-ensure admin user exists (from env vars or defaults for dev only)
(async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || (process.env.NODE_ENV !== 'production' ? 'admin' : null);
    const adminPass = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'admin' : null);
    if (!adminEmail || !adminPass) return; // In production, require ADMIN_EMAIL + ADMIN_PASSWORD env vars
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const hash = await bcrypt.hash(adminPass, 12);
      await prisma.user.create({ data: { email: adminEmail, passwordHash: hash, role: 'ADMIN' } });
      console.log(`[boot] Admin user "${adminEmail}" created`);
    }
  } catch (e) { /* ignore — table might not exist yet */ }
})();

// Auth
app.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signJwt({ id: user.id, email: user.email, role: user.role });
  await logAction(user.id, 'auth.login', { email });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// Cars
app.get('/api/cars', publicReadLimiter, async (req, res) => {
  try {
    const list = await prisma.car.findMany({ orderBy: { createdAt: 'desc' } });
    const normalized = list.map(c => ({ ...c, images: safeParse(c.images) }));
    res.json(normalized);
  } catch (e) {
    console.error('[GET /api/cars]', e?.message);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/api/cars/:id', publicReadLimiter, async (req, res) => {
  try {
    const c = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json({ ...c, images: safeParse(c.images) });
  } catch (e) {
    console.error('[GET /api/cars/:id]', e?.message);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/cars', auth('ADMIN'), async (req, res) => {
  const b = req.body || {};
  const data = {
    brand: b.brand,
    model: b.model,
    trim: b.trim || null,
    pricePerHour: b.pricePerHour ?? 0,
    pricePerDay: b.pricePerDay ?? null,
    bodyStyle: b.bodyStyle || null,
    transmission: b.transmission || null,
    fuel: b.fuel || null,
    seats: b.seats ?? null,
    type: b.type || null,
    status: b.status || 'AVAILABLE',
    images: Array.isArray(b.images) ? JSON.stringify(b.images) : (typeof b.images === 'string' ? b.images : null)
  };
  const created = await prisma.car.create({ data });
  await logAction(null, 'car.create', { id: created.id });
  res.status(201).json(created);
});
app.put('/api/cars/:id', auth('ADMIN'), async (req, res) => {
  try {
    const b = req.body || {};
    const existing = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Car not found' });
    const data = {
      brand: b.brand,
      model: b.model,
      trim: b.trim || null,
      pricePerHour: b.pricePerHour ?? 0,
      pricePerDay: b.pricePerDay ?? null,
      bodyStyle: b.bodyStyle || null,
      transmission: b.transmission || null,
      fuel: b.fuel || null,
      seats: b.seats ?? null,
      type: b.type || null,
      status: b.status || 'AVAILABLE',
      images: Array.isArray(b.images) ? JSON.stringify(b.images) : (typeof b.images === 'string' ? b.images : null)
    };
    const updated = await prisma.car.update({ where: { id: req.params.id }, data });
    await logAction(null, 'car.update', { id: updated.id });
    res.json(updated);
  } catch (e) {
    console.error('[PUT /api/cars/:id]', e?.message || e);
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Server error' });
  }
});
app.delete('/api/cars/:id', auth('ADMIN'), async (req, res) => {
  try {
    const existing = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Car not found' });
    await prisma.car.delete({ where: { id: req.params.id } });
    // Remove persisted images from DB
    await fileDeletePrefix(`uploads/cars/${req.params.id}/`);
    await logAction(null, 'car.delete', { id: req.params.id });
    res.status(204).end();
  } catch (e) {
    console.error('[DELETE /api/cars/:id]', e?.message || e);
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Car images upload
function safeParse(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}
async function makeThumb(srcPath, destPath) {
  await sharp(srcPath)
    .flatten({ background: '#ffffff' })   // transparent → white
    .resize(320, 200, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(destPath);
}
app.post('/api/cars/:id/images', auth('ADMIN'), upload.array('images', 10), async (req, res) => {
  const carId = req.params.id;
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  const existing = safeParse(car.images);
  const dirRel = `/uploads/cars/${carId}`;
  for (const file of req.files || []) {
    const dirAbs = path.dirname(file.path);
    const base = path.basename(file.path);
    const thumbName = `thumb_${base.replace(path.extname(base), '.jpg')}`;
    const thumbAbs = path.join(dirAbs, thumbName);
    try {
      await makeThumb(file.path, thumbAbs);
      existing.push({ large: `${dirRel}/${base}`, thumb: `${dirRel}/${thumbName}` });
      // Persist both files to DB
      await fileSave(`uploads/cars/${carId}/${base}`, file.path, file.mimetype);
      await fileSave(`uploads/cars/${carId}/${thumbName}`, thumbAbs, 'image/jpeg');
    } catch (e) {
      // If thumbnail generation fails (e.g., unsupported HEIC), fall back to using the original as thumb
      console.error('Thumbnail generation failed, falling back to original:', e?.message || e);
      existing.push({ large: `${dirRel}/${base}`, thumb: `${dirRel}/${base}` });
      await fileSave(`uploads/cars/${carId}/${base}`, file.path, file.mimetype);
    }
  }
  const updated = await prisma.car.update({ where: { id: carId }, data: { images: JSON.stringify(existing) } });
  res.json({ images: existing });
});
app.delete('/api/cars/:id/images', auth('ADMIN'), async (req, res) => {
  const carId = req.params.id;
  const name = req.query.name;
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  const list = safeParse(car.images);
  const next = list.filter(img => img.large !== name && img.thumb !== name);
  // Try removing files from disk + DB (with path traversal protection)
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const toRemove = list.filter(img => img.large === name || img.thumb === name);
  for (const img of toRemove) {
    for (const p of [img.large, img.thumb]) {
      if (!p) continue;
      const rel = p.replace(/^\//, '');
      const abs = path.resolve(process.cwd(), rel);
      // Prevent path traversal — only delete files under uploads/
      if (!abs.startsWith(uploadsRoot)) {
        console.error('[SECURITY] Path traversal blocked:', rel);
        continue;
      }
      fs.existsSync(abs) && fs.unlinkSync(abs);
      await fileDelete(rel);
    }
  }
  await prisma.car.update({ where: { id: carId }, data: { images: JSON.stringify(next) } });
  res.status(204).end();
});

// Parameters
app.get('/api/params', publicReadLimiter, async (req, res) => {
  const q = req.query.q;
  const where = q ? { name: { contains: String(q) } } : {};
  const list = await prisma.carParamDef.findMany({ where, orderBy: { name: 'asc' } });
  // Normalize options: parse JSON string to array when type is ENUM
  const normalized = list.map(p => ({
    ...p,
    options: p.type === 'ENUM' ? (typeof p.options === 'string' ? JSON.parse(p.options || '[]') : (p.options || [])) : null
  }));
  res.json(normalized);
});
app.post('/api/params', auth('ADMIN'), async (req, res) => {
  const body = req.body || {};
  const data = {
    name: body.name,
    type: body.type,
    unit: body.type === 'NUMBER' ? (body.unit || null) : null,
    options: body.type === 'ENUM' ? JSON.stringify(body.options || []) : null
  };
  const created = await prisma.carParamDef.create({ data });
  await logAction(null, 'param.create', { id: created.id });
  res.status(201).json(created);
});
app.put('/api/params/:id', auth('ADMIN'), async (req, res) => {
  const body = req.body || {};
  const data = {
    name: body.name,
    type: body.type,
    unit: body.type === 'NUMBER' ? (body.unit || null) : null,
    options: body.type === 'ENUM' ? JSON.stringify(body.options || []) : null
  };
  const updated = await prisma.carParamDef.update({ where: { id: req.params.id }, data });
  await logAction(null, 'param.update', { id: updated.id });
  res.json(updated);
});
app.delete('/api/params/:id', auth('ADMIN'), async (req, res) => {
  try {
    const existing = await prisma.carParamDef.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Param not found' });
    await prisma.carParamDef.delete({ where: { id: req.params.id } });
    await logAction(null, 'param.delete', { id: req.params.id });
    res.status(204).end();
  } catch (e) {
    console.error('[DELETE /api/params/:id]', e?.message || e);
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Car parameter values
app.get('/api/cars/:id/params', async (req, res) => {
  const defs = await prisma.carParamDef.findMany({ orderBy: { name: 'asc' } });
  const values = await prisma.carParamValue.findMany({ where: { carId: req.params.id } });
  const byId = Object.fromEntries(values.map(v => [v.paramId, v]));
  const result = defs.map(d => ({
    id: d.id,
    name: d.name,
    type: d.type,
    options: d.type === 'ENUM' ? (typeof d.options === 'string' ? JSON.parse(d.options || '[]') : (d.options || [])) : null,
    unit: d.unit || null,
    value: byId[d.id]?.valueEnum || byId[d.id]?.valueNum || byId[d.id]?.valueText || null
  }));
  res.json(result);
});
app.put('/api/cars/:id/params', auth('ADMIN'), async (req, res) => {
  const items = req.body?.items || [];
  for (const it of items) {
    const data = { carId: req.params.id, paramId: it.paramId, valueText: null, valueNum: null, valueEnum: null };
    if (it.type === 'ENUM') data.valueEnum = it.value || null;
    else if (it.type === 'NUMBER') data.valueNum = it.value !== '' && it.value !== null ? Number(it.value) : null;
    else data.valueText = it.value || null;
    const existing = await prisma.carParamValue.findFirst({ where: { carId: req.params.id, paramId: it.paramId } });
    if (existing) await prisma.carParamValue.update({ where: { id: existing.id }, data });
    else await prisma.carParamValue.create({ data });
  }
  await logAction(null, 'car.params.update', { id: req.params.id, count: items.length });
  res.json({ ok: true });
});

// Reservations
app.get('/api/reservations', auth('ADMIN'), async (req, res) => {
  const list = await prisma.reservation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { car: true, invoices: true }
  });
  await normalizeReservationExpiry(list);
  await ensureInvoicesForPaidReservations();
  // auto-issue invoice for paid reservations lacking invoice
  const company = await prisma.companyInfo.findFirst();
  for (const r of list) {
    if ((r.status || '').toUpperCase() === 'PAID') {
      const hasInvoice = (r.invoices || []).some(inv => (inv.type || '').toUpperCase() === 'INVOICE');
      if (!hasInvoice) {
        try {
          const inv = await createInvoiceForReservation(r, 'INVOICE', company);
          if (inv) r.invoices = [...(r.invoices||[]), inv];
        } catch (e) { /* ignore */ }
      }
    }
  }
  res.json(list);
});
app.post('/api/reservations', apiWriteLimiter, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid request body' });

  // Server-side validation
  const errors = [];
  if (!data.carId || typeof data.carId !== 'string') errors.push('carId is required');
  if (!data.from || !data.to) errors.push('from and to dates are required');
  if (!data.driver?.name || data.driver.name.trim().split(/\s+/).length < 2) errors.push('Driver full name (first + last) is required');
  if (!data.driver?.phone || !/\d{7,}/.test(data.driver.phone.replace(/\D/g, ''))) errors.push('Valid phone number is required');
  if (!data.driver?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.driver.email)) errors.push('Valid email is required');
  if (!data.driver?.license || data.driver.license.trim().length < 5) errors.push('Driver license number is required (min 5 chars)');
  // Validate invoice data if provided
  if (data.invoice?.type === 'company') {
    if (!data.invoice.name || data.invoice.name.trim().length < 2) errors.push('Company name is required');
    if (!data.invoice.num || !/^\d{9}(\d{4})?$/.test(data.invoice.num)) errors.push('Valid EIK (9 or 13 digits) is required');
  }
  if (data.invoice?.type === 'individual') {
    if (data.invoice.egn && !/^\d{10}$/.test(data.invoice.egn)) errors.push('EGN must be exactly 10 digits');
  }
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  // simple seq: max+1
  const maxSeq = await prisma.reservation.aggregate({ _max: { seq: true } });
  const nextSeq = (maxSeq._max.seq || 0) + 1;
  const car = await prisma.car.findUnique({ where: { id: data.carId } });
  if (!car) return res.status(400).json({ error: 'Car not found' });
  const rate = Number(car?.pricePerDay || 0);
  const fromDt = new Date(data.from);
  const toDt = new Date(data.to);
  // [V7] Date overlap check — prevent double booking on the server
  if (isNaN(fromDt) || isNaN(toDt) || fromDt >= toDt) {
    return res.status(400).json({ error: 'Invalid date range' });
  }
  const overlap = await prisma.reservation.findFirst({
    where: {
      carId: data.carId,
      status: { notIn: ['DECLINED', 'CANCELLED'] },
      from: { lt: toDt },
      to: { gt: fromDt }
    }
  });
  if (overlap) return res.status(409).json({ error: 'This car is already booked for the selected dates' });
  const days = Math.max(1, Math.ceil((toDt - fromDt) / 86400000));
  // Extras: extra driver per day + insurance flat
  const company = await prisma.companyInfo.findFirst();
  const wantsExtraDriver = !!data.extraDriver;
  const wantsInsurance = !!data.insurance;
  const extraDriverRate = Number(company?.extraDriverPrice || 10);
  const insuranceRate = Number(company?.insurancePrice || 15);
  let total = round2(rate * days);
  if (wantsExtraDriver) total = round2(total + extraDriverRate * days);
  if (wantsInsurance) total = round2(total + insuranceRate * days);
  const created = await prisma.reservation.create({ data: {
    seq: nextSeq,
    carId: data.carId,
    from: fromDt,
    to: toDt,
    pickPlace: data.pickPlace || null,
    dropPlace: data.dropPlace || null,
    driverName: data.driver?.name || null,
    driverPhone: data.driver?.phone || null,
    driverEmail: data.driver?.email || null,
    driverLicense: data.driver?.license || null,
    driverBirth: data.driver?.birth ? new Date(data.driver.birth) : null,
    driverAddress: data.driver?.addr || null,
    invoiceType: data.invoice?.type || null,
    invoiceName: data.invoice?.name || null,
    invoiceNum: data.invoice?.num || null,
    invoiceEgn: data.invoice?.egn || null,
    invoiceVat: data.invoice?.vat || null,
    invoiceMol: data.invoice?.mol || null,
    invoiceBank: data.invoice?.bank || null,
    invoiceIban: data.invoice?.iban || null,
    invoiceBic: data.invoice?.bic || null,
    invoiceAddr: data.invoice?.addr || null,
    invoiceEmail: data.invoice?.email || null,
    extraDriver: wantsExtraDriver,
    insurance: wantsInsurance,
    total,
    ratePerDay: rate,
    currency: data.currency || 'EUR',
    status: 'REQUESTED'
  }});
  // Auto-create proforma invoice (uses serializable transaction to prevent number collisions)
  try {
    const fullCreated = { ...created, car };
    await createInvoiceForReservation(fullCreated, 'PROFORMA', company);
  } catch (e) {
    console.error('[reservation] Proforma auto-create error (non-blocking):', e?.message);
  }
  await logAction(null, 'reservation.create', { id: created.id, seq: nextSeq });

  // ─── Send confirmation email (async, non-blocking) ───
  (async () => {
    try {
      const fullRes = await prisma.reservation.findUnique({ where: { id: created.id }, include: { car: true, invoices: true } });
      const invoice = (fullRes?.invoices || []).find(i => i.type === 'PROFORMA') || null;
      const policySlugs = ['terms', 'cancellation', 'insurance'];
      const pols = await prisma.policy.findMany({ where: { slug: { in: policySlugs } } });
      await sendReservationEmail({ reservation: fullRes, invoice, company, policies: pols });
    } catch (err) {
      console.error('[reservation] Email send error (non-blocking):', err.message);
    }
  })();

  res.status(201).json(created);
});

app.get('/api/reservations/:id', auth('ADMIN'), async (req, res) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: req.params.id },
    include: { car: true, invoices: true }
  });
  if (!reservation) return res.status(404).json({ error: 'Not found' });
  await normalizeReservationExpiry([reservation]);
  await ensureInvoicesForPaidReservations();
  if ((reservation.status || '').toUpperCase() === 'PAID') {
    const hasInvoice = (reservation.invoices || []).some(inv => (inv.type || '').toUpperCase() === 'INVOICE');
    if (!hasInvoice) {
      try {
        const company = await prisma.companyInfo.findFirst();
        const inv = await createInvoiceForReservation(reservation, 'INVOICE', company);
        if (inv) reservation.invoices = [...(reservation.invoices||[]), inv];
      } catch (e) { /* ignore */ }
    }
  }
  res.json(reservation);
});

// Download proforma PDF for a reservation
app.get('/api/reservations/:id/pdf', auth('ADMIN'), async (req, res) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: req.params.id },
    include: { car: true, invoices: true }
  });
  if (!reservation) return res.status(404).json({ error: 'Not found' });
  const company = await prisma.companyInfo.findFirst();
  const invoice = (reservation.invoices || []).find(i => i.type === 'PROFORMA') || (reservation.invoices || [])[0] || null;
  const policySlugs = ['terms', 'cancellation', 'insurance'];
  const policies = await prisma.policy.findMany({ where: { slug: { in: policySlugs } } });
  try {
    const { generateProformaPdf } = await import('./mailer.js');
    const pdfBuffer = await generateProformaPdf({ reservation, invoice, company, policies });
    const filename = invoice?.number ? `${invoice.number}.pdf` : `proforma-${reservation.seq || reservation.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[pdf] Generation error:', err.message);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

app.patch('/api/reservations/:id/status', auth('ADMIN'), async (req, res) => {
  const { status } = req.body;
  const normalized = normalizeStatusValue(status);
  if (!normalized) return res.status(400).json({ error: 'Invalid status' });
  // Validate status transition
  const current = await prisma.reservation.findUnique({ where: { id: req.params.id }, select: { status: true } });
  if (!current) return res.status(404).json({ error: 'Reservation not found' });
  const allowed = STATUS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(normalized)) {
    return res.status(400).json({ error: `Cannot transition from ${current.status} to ${normalized}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}` });
  }
  const updated = await prisma.reservation.update({ where: { id: req.params.id }, data: { status: normalized } });
  // Ако стане PAID -> издаваме фактура (ако няма)
  if (normalized === 'PAID') {
    try {
      const reservation = await prisma.reservation.findUnique({ where: { id: req.params.id }, include: { car: true, invoices: true } });
      const hasInvoice = (reservation?.invoices || []).some(inv => (inv.type || '').toUpperCase() === 'INVOICE');
      if (!hasInvoice && reservation) {
        await createInvoiceForReservation(reservation, 'INVOICE');
      }
    } catch (e) {
      // Do not block status change on invoice creation error
    }
  }
  await logAction(null, 'reservation.status', { id: updated.id, status });
  res.json(updated);
});

// Invoices
app.get('/api/invoices', auth('ADMIN'), async (req, res) => {
  // Уверяваме се, че платените резервации имат фактура
  await ensureInvoicesForPaidReservations();
  const reservationId = req.query.reservationId;
  const where = reservationId ? { reservationId: String(reservationId) } : {};
  const list = await prisma.invoice.findMany({
    where,
    orderBy: { issueDate: 'desc' },
    include: { reservation: { include: { car: true } } }
  });
  const mapped = list.map(inv => ({ ...inv, items: safeParse(inv.items) }));
  res.json(mapped);
});
app.get('/api/invoices/:id', auth('ADMIN'), async (req, res) => {
  const inv = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { reservation: { include: { car: true } } }
  });
  if (!inv) return res.status(404).json({ error: 'Not found' });
  res.json({ ...inv, items: safeParse(inv.items) });
});
app.post('/api/invoices', auth('ADMIN'), async (req, res) => {
  const body = req.body || {};
  const reservationId = body.reservationId;
  if (!reservationId) return res.status(400).json({ error: 'reservationId is required' });
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { car: true } });
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  const company = await prisma.companyInfo.findFirst();
  const type = body.type || 'PROFORMA';
  const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  let items = normalizeItems(body.items);
  if (!items.length) {
    const days = Math.max(1, Math.ceil((new Date(reservation.to) - new Date(reservation.from)) / 86400000));
    const unitPrice = reservation.total && days ? reservation.total / days : reservation.car?.pricePerDay || 0;
    items = normalizeItems([{
      description: `Наем на автомобил ${reservation.car?.brand || ''} ${reservation.car?.model || ''}`.trim(),
      qty: days,
      unitPrice,
      vatRate: 20
    }]);
  }
  const { subtotal, vatAmount, total } = calcTotals(items);
  const number = body.number || await generateInvoiceNumber(type, issueDate, { proStart: company?.proStart, invStart: company?.invStart });
  if (body.number) await ensureInvoiceNumber(body.number, type);
  const data = {
    reservationId,
    type,
    number,
    issueDate,
    dueDate,
    currency: body.currency || 'EUR',
    paymentMethod: body.paymentMethod || body.payment || null,
    paymentTerms: body.paymentTerms || body.terms || null,
    status: body.status || 'DRAFT',
    notes: body.notes || null,
    supplierName: company?.name || 'Фирма',
    supplierEik: company?.eik || '',
    supplierVat: company?.vat || null,
    supplierAddr: company?.address || '',
    supplierMol: company?.mol || null,
    supplierEmail: company?.email || null,
    supplierPhone: company?.phone || null,
    supplierBank: company?.bank || null,
    supplierIban: company?.iban || null,
    supplierBic: company?.bic || null,
    buyerType: body.buyerType || reservation.invoiceType || 'individual',
    buyerName: body.buyerName || reservation.invoiceName || reservation.driverName || '',
    buyerEik: body.buyerEik || reservation.invoiceNum || null,
    buyerVat: body.buyerVat || reservation.invoiceVat || null,
    buyerEgn: body.buyerEgn || reservation.invoiceEgn || null,
    buyerMol: body.buyerMol || reservation.invoiceMol || null,
    buyerAddr: body.buyerAddr || reservation.invoiceAddr || null,
    buyerEmail: body.buyerEmail || reservation.invoiceEmail || null,
    buyerBank: body.buyerBank || reservation.invoiceBank || null,
    buyerIban: body.buyerIban || reservation.invoiceIban || null,
    buyerBic: body.buyerBic || reservation.invoiceBic || null,
    items: JSON.stringify(items),
    subtotal,
    vatAmount,
    total
  };
  const created = await prisma.invoice.create({ data });
  if (data.status === 'PAID') {
    await prisma.reservation.update({ where: { id: reservationId }, data: { status: 'PAID' } });
  }
  await logAction(null, 'invoice.create', { id: created.id, reservationId });
  res.status(201).json(created);
});
app.put('/api/invoices/:id', auth('ADMIN'), async (req, res) => {
  const body = req.body || {};
  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const company = await prisma.companyInfo.findFirst();
  const type = body.type || inv.type || 'PROFORMA';
  const issueDate = body.issueDate ? new Date(body.issueDate) : inv.issueDate;
  const dueDate = body.dueDate ? new Date(body.dueDate) : inv.dueDate;
  let items = normalizeItems(body.items ?? inv.items);
  const { subtotal, vatAmount, total } = calcTotals(items);
  const number = body.number || inv.number || await generateInvoiceNumber(type, issueDate, { proStart: company?.proStart, invStart: company?.invStart });
  if (body.number && body.number !== inv.number) await ensureInvoiceNumber(body.number, type);
  const data = {
    type,
    number,
    issueDate,
    dueDate,
    currency: body.currency || inv.currency || 'EUR',
    paymentMethod: body.paymentMethod ?? inv.paymentMethod,
    paymentTerms: body.paymentTerms ?? inv.paymentTerms,
    status: body.status || inv.status || 'DRAFT',
    notes: body.notes ?? inv.notes,
    supplierName: body.supplierName || inv.supplierName,
    supplierEik: body.supplierEik || inv.supplierEik,
    supplierVat: body.supplierVat ?? inv.supplierVat,
    supplierAddr: body.supplierAddr || inv.supplierAddr,
    supplierMol: body.supplierMol ?? inv.supplierMol,
    supplierEmail: body.supplierEmail ?? inv.supplierEmail,
    supplierPhone: body.supplierPhone ?? inv.supplierPhone,
    supplierBank: body.supplierBank ?? inv.supplierBank,
    supplierIban: body.supplierIban ?? inv.supplierIban,
    supplierBic: body.supplierBic ?? inv.supplierBic,
    buyerType: body.buyerType ?? inv.buyerType,
    buyerName: body.buyerName ?? inv.buyerName,
    buyerEik: body.buyerEik ?? inv.buyerEik,
    buyerVat: body.buyerVat ?? inv.buyerVat,
    buyerEgn: body.buyerEgn ?? inv.buyerEgn,
    buyerMol: body.buyerMol ?? inv.buyerMol,
    buyerAddr: body.buyerAddr ?? inv.buyerAddr,
    buyerEmail: body.buyerEmail ?? inv.buyerEmail,
    buyerBank: body.buyerBank ?? inv.buyerBank,
    buyerIban: body.buyerIban ?? inv.buyerIban,
    buyerBic: body.buyerBic ?? inv.buyerBic,
    items: JSON.stringify(items),
    subtotal,
    vatAmount,
    total
  };
  const updated = await prisma.invoice.update({ where: { id: req.params.id }, data });
  if (data.status === 'PAID') {
    await prisma.reservation.update({ where: { id: inv.reservationId }, data: { status: 'PAID' } });
  }
  await logAction(null, 'invoice.update', { id: updated.id, reservationId: inv.reservationId });
  res.json(updated);
});

// Dashboard
app.get('/api/dashboard/metrics', auth('ADMIN'), async (req, res) => {
  try {
    const totalCars = await prisma.car.count();
    const totalReservations = await prisma.reservation.count();
    const totalTurnover = await prisma.invoice.aggregate({ _sum: { total: true } });
    res.json({
      totalCars,
      totalReservations,
      turnover: round2(totalTurnover._sum.total || 0)
    });
  } catch (e) {
    console.error('[GET /api/dashboard/metrics]', e?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Locations (site settings)
app.get('/api/locations', publicReadLimiter, async (req, res) => {
  const q = req.query.q;
  const where = q ? { label: { contains: String(q) } } : {};
  const list = await prisma.location.findMany({ where, orderBy: { label: 'asc' } });
  res.json(list);
});
app.post('/api/locations', auth('ADMIN'), async (req, res) => {
  const label = (req.body?.label || '').trim();
  if (!label) return res.status(400).json({ error: 'Label is required' });
  const created = await prisma.location.create({ data: { label } });
  await logAction(null, 'location.create', { id: created.id, label });
  res.status(201).json(created);
});
app.delete('/api/locations/:id', auth('ADMIN'), async (req, res) => {
  try {
    const existing = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Location not found' });
    await prisma.location.delete({ where: { id: req.params.id } });
    await logAction(null, 'location.delete', { id: req.params.id });
    res.status(204).end();
  } catch (e) {
    console.error('[DELETE /api/locations/:id]', e?.message || e);
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Company info
app.get('/api/company', publicReadLimiter, async (req, res) => {
  const info = await prisma.companyInfo.findFirst();
  if (info) {
    // [V4] Never expose SMTP settings or internals to public frontend
    info.smtpPass = info.smtpPass ? '••••••••' : null;
    info.smtpHost = undefined;
    info.smtpPort = undefined;
    info.smtpUser = undefined;
    info.smtpFrom = undefined;
  }
  res.json(info || null);
});
app.put('/api/company', auth('ADMIN'), async (req, res) => {
  const body = req.body || {};
  const exists = await prisma.companyInfo.findFirst();
  const data = {
    name: body.name, eik: body.eik, vat: body.vat || null,
    address: body.address, city: body.city, country: body.country || 'България',
    mol: body.mol || null, email: body.email || null, phone: body.phone || null,
    bank: body.bank || null, iban: body.iban || null, bic: body.bic || null,
    proStart: body.proStart ? Number(body.proStart) : 1,
    invStart: body.invStart ? Number(body.invStart) : 1,
    extraDriverPrice: body.extraDriverPrice !== undefined ? Number(body.extraDriverPrice) : undefined,
    insurancePrice: body.insurancePrice !== undefined ? Number(body.insurancePrice) : undefined,
    smtpHost: body.smtpHost !== undefined ? (body.smtpHost || null) : undefined,
    smtpPort: body.smtpPort !== undefined ? (Number(body.smtpPort) || 587) : undefined,
    smtpUser: body.smtpUser !== undefined ? (body.smtpUser || null) : undefined,
    smtpPass: (body.smtpPass !== undefined && body.smtpPass !== '••••••••') ? (body.smtpPass || null) : undefined,
    smtpFrom: body.smtpFrom !== undefined ? (body.smtpFrom || null) : undefined
  };
  let saved;
  if (exists) saved = await prisma.companyInfo.update({ where: { id: exists.id }, data });
  else saved = await prisma.companyInfo.create({ data });
  await logAction(null, 'company.update', { id: saved.id });
  res.json(saved);
});

// Test SMTP connection
app.post('/api/test-smtp', auth('ADMIN'), async (req, res) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = req.body || {};
  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(400).json({ error: 'Моля попълнете хост, потребител и парола' });
  }
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: Number(smtpPort) === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });
    await transporter.verify();
    // Send test email to the SMTP user
    await transporter.sendMail({
      from: `"Тест" <${smtpFrom || smtpUser}>`,
      to: smtpUser,
      subject: 'Тестов имейл от системата',
      text: 'SMTP настройките работят коректно!',
      html: '<p style="font-family:sans-serif;">✅ SMTP настройките работят коректно!</p>'
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[test-smtp]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Policies
app.get('/api/policies', publicReadLimiter, async (req, res) => {
  const list = await prisma.policy.findMany({ orderBy: { slug: 'asc' } });
  res.json(list);
});
app.get('/api/policies/:slug', publicReadLimiter, async (req, res) => {
  const policy = await prisma.policy.findUnique({ where: { slug: req.params.slug } });
  res.json(policy || { slug: req.params.slug, title: '', content: '' });
});
app.put('/api/policies/:slug', auth('ADMIN'), async (req, res) => {
  const { title, content } = req.body || {};
  const slug = req.params.slug;
  // Validate slug against known policy types
  const validSlugs = ['privacy', 'terms', 'cancellation', 'insurance', 'cookies'];
  if (!validSlugs.includes(slug)) return res.status(400).json({ error: 'Invalid policy slug' });
  // Sanitize HTML content to prevent XSS
  const safeContent = content !== undefined ? sanitizeHtml(content) : undefined;
  const exists = await prisma.policy.findUnique({ where: { slug } });
  let saved;
  if (exists) {
    saved = await prisma.policy.update({ where: { slug }, data: { title: title || exists.title, content: safeContent ?? exists.content } });
  } else {
    saved = await prisma.policy.create({ data: { slug, title: title || slug, content: safeContent || '' } });
  }
  await logAction(null, 'policy.update', { slug });
  res.json(saved);
});

// ─── Site Images (backgrounds, avatars, etc.) ──────────────────────
const siteImgRoot = path.join(process.cwd(), 'uploads', 'site');
fs.mkdirSync(siteImgRoot, { recursive: true });

const siteImgUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, siteImgRoot),
    filename: (req, file, cb) => {
      // Save with original extension temporarily; will be converted to .jpg after upload
      const key = req.params.key || 'unknown';
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `_tmp_${key}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP and AVIF are allowed'));
  }
});

// Site images meta: defines every manageable image slot
const SITE_IMAGE_SLOTS = [
  { key: 'hero-bg',        label: 'Начална страница — Хиро (фон)',       hint: '1920×800 px, 16:7',    usage: 'css-bg' },
  { key: 'about-cars',     label: 'Начална страница — За нас (снимка)',   hint: '800×600 px, 4:3',      usage: 'img-tag' },
  { key: 'cta-bg',         label: 'Начална страница — Бюлетин (фон)',     hint: '1920×600 px, 16:5',    usage: 'css-bg' },
  { key: 'about-hero-bg',  label: 'За нас — Хиро (фон)',                  hint: '1920×500 px, ~4:1',    usage: 'css-bg' },
  { key: 'about-video',    label: 'За нас — Видео секция (снимка)',        hint: '1200×525 px, 16:7',    usage: 'img-tag' },
  { key: 'memories-family', label: 'За нас — Спомени (снимка)',            hint: '800×600 px, 4:3',      usage: 'img-tag' },
  { key: 'face-georgi',    label: 'Ревю — Георги Димитров (аватар)',       hint: '96×96 px, 1:1',        usage: 'img-tag' },
  { key: 'face-maria',     label: 'Ревю — Мария Иванова (аватар)',         hint: '96×96 px, 1:1',        usage: 'img-tag' },
  { key: 'face-petar',     label: 'Ревю — Петър Стоянов (аватар)',         hint: '96×96 px, 1:1',        usage: 'img-tag' },
];

// List all site image slots + current file info
app.get('/api/site-images', publicReadLimiter, (req, res) => {
  const result = SITE_IMAGE_SLOTS.map(slot => {
    // Find existing file for this key (any extension)
    const files = fs.readdirSync(siteImgRoot).filter(f => f.startsWith(slot.key + '.'));
    const file = files[0] || null;
    return {
      ...slot,
      currentUrl: file ? `/uploads/site/${file}` : null,
      hasImage: !!file
    };
  });
  res.json(result);
});

// Upload a site image for a specific key — always converts to JPEG
app.post('/api/site-images/:key', auth('ADMIN'), siteImgUpload.single('image'), async (req, res) => {
  const key = req.params.key;
  const slot = SITE_IMAGE_SLOTS.find(s => s.key === key);
  if (!slot) return res.status(400).json({ error: 'Invalid image key' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const finalName = `${key}.jpg`;
  const finalPath = path.join(siteImgRoot, finalName);

  try {
    // Convert any format (PNG, WebP, AVIF, JPEG) to JPEG with white background for transparency
    await sharp(req.file.path)
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toFile(finalPath);

    // Remove the temporary upload file
    fs.unlinkSync(req.file.path);
  } catch (e) {
    // If conversion fails, just rename the temp file
    console.error('Sharp conversion failed, using original:', e.message);
    if (fs.existsSync(req.file.path)) {
      fs.renameSync(req.file.path, finalPath);
    }
  }

  // Remove old files for this key with other extensions (png, webp, etc.)
  const oldFiles = fs.readdirSync(siteImgRoot).filter(f => f.startsWith(key + '.') && f !== finalName);
  for (const old of oldFiles) {
    try { fs.unlinkSync(path.join(siteImgRoot, old)); } catch {}
  }

  // Persist to DB so it survives deploys (DB is the single source of truth)
  await fileSave(`uploads/site/${finalName}`, finalPath, 'image/jpeg');

  await logAction(null, 'site-image.upload', { key });
  res.json({ key, url: `/uploads/site/${finalName}` });
});

// ─── Newsletter ────────────────────────────────────────────────────
app.post('/api/newsletter', newsletterLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Моля, въведете имейл адрес.' });
  }
  const trimmed = email.trim().toLowerCase();
  // Basic email regex
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return res.status(400).json({ error: 'Моля, въведете валиден имейл адрес.' });
  }
  // Check uniqueness
  const existing = await prisma.newsletter.findUnique({ where: { email: trimmed } });
  if (existing) {
    return res.status(409).json({ error: 'Този имейл вече е абониран.' });
  }
  const record = await prisma.newsletter.create({ data: { email: trimmed } });
  await logAction(null, 'newsletter.subscribe', { email: trimmed });
  res.status(201).json({ ok: true, id: record.id });
});

app.get('/api/newsletter', auth('ADMIN'), async (req, res) => {
  const list = await prisma.newsletter.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(list);
});

app.delete('/api/newsletter/:id', auth('ADMIN'), async (req, res) => {
  const existing = await prisma.newsletter.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await prisma.newsletter.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ─── Serve static frontend in production ───────────────────────────
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..', '..');  // repo root

// [V21] Serve ONLY frontend static files — block access to sensitive files/directories
app.use((req, res, next) => {
  // Block access to sensitive paths that exist in the repo root
  const blocked = /^\/(server|\.env|\.git|node_modules|prisma|package\.json|package-lock\.json|\.gitignore|\.cursorignore|\.cursor)/i;
  if (blocked.test(req.path)) return res.status(404).send('Not found');
  next();
}, express.static(FRONTEND_DIR, { index: false, dotfiles: 'deny' }));

// SPA catch-all: only serve index.html for navigation requests (not file requests)
app.get('*', (req, res) => {
  // If it looks like a file request (has extension), return 404 instead of index.html
  if (/\.\w+$/.test(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ─── Global Express error handler ───
app.use((err, req, res, next) => {
  console.error('[EXPRESS_ERROR]', err?.message || err);
  if (!res.headersSent) {
    // Never leak internal error details in production
    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error');
    res.status(err.status || 500).json({ error: message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});


