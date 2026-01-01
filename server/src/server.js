import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 5175;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5174';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

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
  res.json(list);
});
app.get('/api/cars/:id', async (req, res) => {
  const c = await prisma.car.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});
app.post('/api/cars', async (req, res) => {
  const created = await prisma.car.create({ data: req.body });
  await logAction(null, 'car.create', { id: created.id });
  res.status(201).json(created);
});
app.put('/api/cars/:id', async (req, res) => {
  const updated = await prisma.car.update({ where: { id: req.params.id }, data: req.body });
  await logAction(null, 'car.update', { id: updated.id });
  res.json(updated);
});
app.delete('/api/cars/:id', async (req, res) => {
  await prisma.car.delete({ where: { id: req.params.id } });
  await logAction(null, 'car.delete', { id: req.params.id });
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

// Reservations
app.get('/api/reservations', async (req, res) => {
  const list = await prisma.reservation.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(list);
});
app.post('/api/reservations', async (req, res) => {
  const data = req.body;
  const created = await prisma.reservation.create({ data: {
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
    invoiceAddr: data.invoice?.addr || null,
    invoiceEmail: data.invoice?.email || null,
    total: data.total || 0
  }});
  await logAction(null, 'reservation.create', { id: created.id });
  res.status(201).json(created);
});
app.patch('/api/reservations/:id/status', async (req, res) => {
  const { status } = req.body;
  const updated = await prisma.reservation.update({ where: { id: req.params.id }, data: { status } });
  await logAction(null, 'reservation.status', { id: updated.id, status });
  res.json(updated);
});

// Invoices
app.post('/api/invoices/:reservationId/issue', async (req, res) => {
  const reservationId = req.params.reservationId;
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  const number = `INV-${new Date().getFullYear()}-${Math.floor(Math.random()*900000+100000)}`;
  const total = reservation.total || 0;
  const invoice = await prisma.invoice.create({ data: { reservationId, number, total, paid: false } });
  await prisma.reservation.update({ where: { id: reservationId }, data: { status: 'INVOICED' } });
  await logAction(null, 'invoice.issue', { id: invoice.id, reservationId });
  res.status(201).json(invoice);
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
    bank: body.bank || null, iban: body.iban || null, bic: body.bic || null
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


