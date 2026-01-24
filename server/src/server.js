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
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 5175;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5174';

// Be permissive during development to avoid CORS issues from the embedded browser
app.use(cors({ origin: true, credentials: true }));
app.options('*', cors({ origin: true, credentials: true }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
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
const upload = multer({ storage });

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
const ALLOWED_RES_STATUS = ['REQUESTED','APPROVED','DECLINED','PAID','COMPLETED'];
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
function normalizeItems(items) {
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) return [];
  return items.map(it => {
    const qty = Number(it.qty ?? it.quantity ?? 1);
    const unitPrice = Number(it.unitPrice ?? it.price ?? 0);
    const vatRate = Number(it.vatRate ?? 20);
    const totalNet = qty * unitPrice;
    const totalVat = totalNet * (vatRate / 100);
    const totalGross = totalNet + totalVat;
    return {
      description: it.description || 'Услуга',
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
  const subtotal = items.reduce((s, it) => s + (it.totalNet || 0), 0);
  const vatAmount = items.reduce((s, it) => s + (it.totalVat || 0), 0);
  const total = items.reduce((s, it) => s + (it.totalGross || 0), 0);
  return { subtotal, vatAmount, total };
}
function fmtDateBg(d) {
  try { return new Date(d).toLocaleDateString('bg-BG'); } catch { return ''; }
}
async function generateInvoiceNumber(type = 'PROFORMA', issueDate = new Date(), starts = {}) {
  const year = new Date(issueDate).getFullYear();
  const prefix = `${type === 'INVOICE' ? 'INV' : 'PRO'}-${year}-`;
  const last = await prisma.invoice.findFirst({
    where: { type, number: { startsWith: prefix } },
    orderBy: { number: 'desc' }
  });
  let next = type === 'INVOICE' ? (starts.invStart || 1) : (starts.proStart || 1);
  if (last?.number) {
    const m = last.number.match(/-(\d+)$/);
    if (m) next = Math.max(next, Number(m[1]) + 1);
  }
  return `${prefix}${String(next).padStart(5, '0')}`;
}

// Health
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth
app.post('/auth/login', async (req, res) => {
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
app.get('/api/cars', async (req, res) => {
  const list = await prisma.car.findMany({ orderBy: { createdAt: 'desc' } });
  const normalized = list.map(c => ({ ...c, images: safeParse(c.images) }));
  res.json(normalized);
});
app.get('/api/cars/:id', async (req, res) => {
  const c = await prisma.car.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({ ...c, images: safeParse(c.images) });
});
app.post('/api/cars', async (req, res) => {
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
app.put('/api/cars/:id', async (req, res) => {
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
  const updated = await prisma.car.update({ where: { id: req.params.id }, data });
  await logAction(null, 'car.update', { id: updated.id });
  res.json(updated);
});
app.delete('/api/cars/:id', async (req, res) => {
  await prisma.car.delete({ where: { id: req.params.id } });
  await logAction(null, 'car.delete', { id: req.params.id });
  res.status(204).end();
});

// Car images upload
function safeParse(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}
async function makeThumb(srcPath, destPath) {
  await sharp(srcPath).resize(320, 200, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(destPath);
}
app.post('/api/cars/:id/images', upload.array('images', 10), async (req, res) => {
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
    } catch (e) {
      // If thumbnail generation fails (e.g., unsupported HEIC), fall back to using the original as thumb
      console.error('Thumbnail generation failed, falling back to original:', e?.message || e);
      existing.push({ large: `${dirRel}/${base}`, thumb: `${dirRel}/${base}` });
    }
  }
  const updated = await prisma.car.update({ where: { id: carId }, data: { images: JSON.stringify(existing) } });
  res.json({ images: existing });
});
app.delete('/api/cars/:id/images', async (req, res) => {
  const carId = req.params.id;
  const name = req.query.name;
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  const list = safeParse(car.images);
  const next = list.filter(img => img.large !== name && img.thumb !== name);
  // Try removing files
  const toRemove = list.filter(img => img.large === name || img.thumb === name);
  for (const img of toRemove) {
    for (const p of [img.large, img.thumb]) {
      if (!p) continue;
      const abs = path.join(process.cwd(), p.replace(/^\//,''));
      fs.existsSync(abs) && fs.unlinkSync(abs);
    }
  }
  await prisma.car.update({ where: { id: carId }, data: { images: JSON.stringify(next) } });
  res.status(204).end();
});

// Parameters
app.get('/api/params', async (req, res) => {
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
app.post('/api/params', async (req, res) => {
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
app.put('/api/params/:id', async (req, res) => {
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
app.delete('/api/params/:id', async (req, res) => {
  await prisma.carParamDef.delete({ where: { id: req.params.id } });
  await logAction(null, 'param.delete', { id: req.params.id });
  res.status(204).end();
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
app.put('/api/cars/:id/params', async (req, res) => {
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
app.get('/api/reservations', async (req, res) => {
  const list = await prisma.reservation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { car: true, invoices: true }
  });
  await normalizeReservationExpiry(list);
  res.json(list);
});
app.post('/api/reservations', async (req, res) => {
  const data = req.body;
  // simple seq: max+1
  const maxSeq = await prisma.reservation.aggregate({ _max: { seq: true } });
  const nextSeq = (maxSeq._max.seq || 0) + 1;
  const created = await prisma.reservation.create({ data: {
    seq: nextSeq,
    carId: data.carId,
    from: new Date(data.from),
    to: new Date(data.to),
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
    total: data.total || 0,
    status: 'REQUESTED'
  }});
  await logAction(null, 'reservation.create', { id: created.id, seq: nextSeq });
  res.status(201).json(created);
});

app.get('/api/reservations/:id', async (req, res) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: req.params.id },
    include: { car: true, invoices: true }
  });
  if (!reservation) return res.status(404).json({ error: 'Not found' });
  await normalizeReservationExpiry([reservation]);
  res.json(reservation);
});
app.patch('/api/reservations/:id/status', async (req, res) => {
  const { status } = req.body;
  const normalized = normalizeStatusValue(status);
  if (!normalized) return res.status(400).json({ error: 'Invalid status' });
  const updated = await prisma.reservation.update({ where: { id: req.params.id }, data: { status: normalized } });
  await logAction(null, 'reservation.status', { id: updated.id, status });
  res.json(updated);
});

// Invoices
app.get('/api/invoices', async (req, res) => {
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
app.get('/api/invoices/:id', async (req, res) => {
  const inv = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { reservation: { include: { car: true } } }
  });
  if (!inv) return res.status(404).json({ error: 'Not found' });
  res.json({ ...inv, items: safeParse(inv.items) });
});
app.post('/api/invoices', async (req, res) => {
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
      description: `Наем на автомобил ${reservation.car?.brand || ''} ${reservation.car?.model || ''} (${fmtDateBg(reservation.from)} → ${fmtDateBg(reservation.to)})`,
      qty: days,
      unitPrice,
      vatRate: 20
    }]);
  }
  const { subtotal, vatAmount, total } = calcTotals(items);
  const number = body.number || await generateInvoiceNumber(type, issueDate, { proStart: company?.proStart, invStart: company?.invStart });
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
    await prisma.reservation.update({ where: { id: reservationId }, data: { status: 'paid' } });
  } else if (type === 'INVOICE') {
    await prisma.reservation.update({ where: { id: reservationId }, data: { status: 'invoiced' } });
  }
  await logAction(null, 'invoice.create', { id: created.id, reservationId });
  res.status(201).json(created);
});
app.put('/api/invoices/:id', async (req, res) => {
  const body = req.body || {};
  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const type = body.type || inv.type || 'PROFORMA';
  const issueDate = body.issueDate ? new Date(body.issueDate) : inv.issueDate;
  const dueDate = body.dueDate ? new Date(body.dueDate) : inv.dueDate;
  let items = normalizeItems(body.items ?? inv.items);
  const { subtotal, vatAmount, total } = calcTotals(items);
  const number = body.number || inv.number || await generateInvoiceNumber(type, issueDate, { proStart: inv.type==='PROFORMA' ? company?.proStart : company?.invStart, invStart: company?.invStart });
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
    await prisma.reservation.update({ where: { id: inv.reservationId }, data: { status: 'paid' } });
  }
  await logAction(null, 'invoice.update', { id: updated.id, reservationId: inv.reservationId });
  res.json(updated);
});

// Dashboard
app.get('/api/dashboard/metrics', async (req, res) => {
  const totalCars = await prisma.car.count();
  const totalReservations = await prisma.reservation.count();
  const totalTurnover = await prisma.invoice.aggregate({ _sum: { total: true } });
  res.json({
    totalCars,
    totalReservations,
    turnover: totalTurnover._sum.total || 0
  });
});

// Locations (site settings)
app.get('/api/locations', async (req, res) => {
  const q = req.query.q;
  const where = q ? { label: { contains: String(q) } } : {};
  const list = await prisma.location.findMany({ where, orderBy: { label: 'asc' } });
  res.json(list);
});
app.post('/api/locations', async (req, res) => {
  const label = (req.body?.label || '').trim();
  if (!label) return res.status(400).json({ error: 'Label is required' });
  const created = await prisma.location.create({ data: { label } });
  await logAction(null, 'location.create', { id: created.id, label });
  res.status(201).json(created);
});
app.delete('/api/locations/:id', async (req, res) => {
  await prisma.location.delete({ where: { id: req.params.id } });
  await logAction(null, 'location.delete', { id: req.params.id });
  res.status(204).end();
});

// Company info
app.get('/api/company', async (req, res) => {
  const info = await prisma.companyInfo.findFirst();
  res.json(info || null);
});
app.put('/api/company', async (req, res) => {
  const body = req.body || {};
  const exists = await prisma.companyInfo.findFirst();
  const data = {
    name: body.name, eik: body.eik, vat: body.vat || null,
    address: body.address, city: body.city, country: body.country || 'България',
    mol: body.mol || null, email: body.email || null, phone: body.phone || null,
    bank: body.bank || null, iban: body.iban || null, bic: body.bic || null,
    proStart: body.proStart ? Number(body.proStart) : 1,
    invStart: body.invStart ? Number(body.invStart) : 1
  };
  let saved;
  if (exists) saved = await prisma.companyInfo.update({ where: { id: exists.id }, data });
  else saved = await prisma.companyInfo.create({ data });
  await logAction(null, 'company.update', { id: saved.id });
  res.json(saved);
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});


