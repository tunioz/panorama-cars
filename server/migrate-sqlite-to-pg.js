/**
 * One-time migration script: SQLite → PostgreSQL
 * Reads all data from local SQLite dev.db and inserts into Railway PostgreSQL
 */
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const DB_PATH = path.join(__dirname, 'prisma', 'dev.db');

// Read a table from SQLite as JSON
function readSqlite(table) {
  const raw = execSync(`sqlite3 -json "${DB_PATH}" "SELECT * FROM ${table}"`, { encoding: 'utf-8' });
  return JSON.parse(raw || '[]');
}

// Convert SQLite timestamp (ms) to JS Date
function msToDate(ms) {
  if (ms == null) return null;
  return new Date(Number(ms));
}

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('📖 Reading SQLite data...');
    const users = readSqlite('User');
    const cars = readSqlite('Car');
    const paramDefs = readSqlite('CarParamDef');
    const paramValues = readSqlite('CarParamValue');
    const locations = readSqlite('Location');
    const reservations = readSqlite('Reservation');
    const invoices = readSqlite('Invoice');
    const logs = readSqlite('Log');
    const companyInfo = readSqlite('CompanyInfo');
    const policies = readSqlite('Policy');

    console.log(`  Users: ${users.length}`);
    console.log(`  Cars: ${cars.length}`);
    console.log(`  ParamDefs: ${paramDefs.length}`);
    console.log(`  ParamValues: ${paramValues.length}`);
    console.log(`  Locations: ${locations.length}`);
    console.log(`  Reservations: ${reservations.length}`);
    console.log(`  Invoices: ${invoices.length}`);
    console.log(`  Logs: ${logs.length}`);
    console.log(`  CompanyInfo: ${companyInfo.length}`);
    console.log(`  Policies: ${policies.length}`);

    console.log('\n🗑️  Clearing PostgreSQL tables (reverse dependency order)...');
    // Must delete in dependency order
    await prisma.invoice.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.carParamValue.deleteMany();
    await prisma.carParamDef.deleteMany();
    await prisma.log.deleteMany();
    await prisma.car.deleteMany();
    await prisma.user.deleteMany();
    await prisma.location.deleteMany();
    await prisma.companyInfo.deleteMany();
    await prisma.policy.deleteMany();
    console.log('  ✅ All tables cleared');

    console.log('\n📥 Inserting data into PostgreSQL...');

    // 1. Users
    for (const u of users) {
      await prisma.user.create({
        data: {
          id: u.id,
          email: u.email,
          passwordHash: u.passwordHash,
          role: u.role || 'OPERATOR',
          createdAt: msToDate(u.createdAt),
        }
      });
    }
    console.log(`  ✅ Users: ${users.length}`);

    // 2. Cars
    for (const c of cars) {
      await prisma.car.create({
        data: {
          id: c.id,
          brand: c.brand,
          model: c.model,
          trim: c.trim || null,
          year: c.year || null,
          pricePerHour: c.pricePerHour || 0,
          pricePerDay: c.pricePerDay || null,
          bodyStyle: c.bodyStyle || null,
          transmission: c.transmission || null,
          fuel: c.fuel || null,
          seats: c.seats || null,
          images: c.images || null,
          type: c.type || null,
          status: c.status || 'AVAILABLE',
          createdAt: msToDate(c.createdAt),
          updatedAt: msToDate(c.updatedAt),
        }
      });
    }
    console.log(`  ✅ Cars: ${cars.length}`);

    // 3. CarParamDef
    for (const d of paramDefs) {
      await prisma.carParamDef.create({
        data: {
          id: d.id,
          name: d.name,
          type: d.type,
          options: d.options || null,
          unit: d.unit || null,
        }
      });
    }
    console.log(`  ✅ ParamDefs: ${paramDefs.length}`);

    // 4. CarParamValue
    for (const v of paramValues) {
      await prisma.carParamValue.create({
        data: {
          id: v.id,
          carId: v.carId,
          paramId: v.paramId,
          valueText: v.valueText || null,
          valueNum: v.valueNum || null,
          valueEnum: v.valueEnum || null,
        }
      });
    }
    console.log(`  ✅ ParamValues: ${paramValues.length}`);

    // 5. Locations
    for (const l of locations) {
      await prisma.location.create({
        data: {
          id: l.id,
          label: l.label,
          active: l.active === 1 || l.active === true,
          createdAt: msToDate(l.createdAt),
        }
      });
    }
    console.log(`  ✅ Locations: ${locations.length}`);

    // 6. Reservations
    for (const r of reservations) {
      await prisma.reservation.create({
        data: {
          id: r.id,
          seq: r.seq || 0,
          carId: r.carId,
          from: msToDate(r.from),
          to: msToDate(r.to),
          pickPlace: r.pickPlace || null,
          dropPlace: r.dropPlace || null,
          driverName: r.driverName || null,
          driverPhone: r.driverPhone || null,
          driverEmail: r.driverEmail || null,
          driverLicense: r.driverLicense || null,
          driverBirth: msToDate(r.driverBirth),
          driverAddress: r.driverAddress || null,
          invoiceType: r.invoiceType || null,
          invoiceName: r.invoiceName || null,
          invoiceNum: r.invoiceNum || null,
          invoiceEgn: r.invoiceEgn || null,
          invoiceVat: r.invoiceVat || null,
          invoiceMol: r.invoiceMol || null,
          invoiceBank: r.invoiceBank || null,
          invoiceIban: r.invoiceIban || null,
          invoiceBic: r.invoiceBic || null,
          invoiceAddr: r.invoiceAddr || null,
          invoiceEmail: r.invoiceEmail || null,
          status: r.status || 'REQUESTED',
          total: r.total || null,
          ratePerDay: r.ratePerDay || null,
          currency: r.currency || 'EUR',
          createdAt: msToDate(r.createdAt),
        }
      });
    }
    console.log(`  ✅ Reservations: ${reservations.length}`);

    // 7. Invoices
    for (const inv of invoices) {
      await prisma.invoice.create({
        data: {
          id: inv.id,
          reservationId: inv.reservationId,
          type: inv.type,
          number: inv.number || null,
          issueDate: msToDate(inv.issueDate),
          dueDate: msToDate(inv.dueDate),
          currency: inv.currency || 'EUR',
          paymentMethod: inv.paymentMethod || null,
          paymentTerms: inv.paymentTerms || null,
          status: inv.status || 'DRAFT',
          notes: inv.notes || null,
          supplierName: inv.supplierName,
          supplierEik: inv.supplierEik,
          supplierVat: inv.supplierVat || null,
          supplierAddr: inv.supplierAddr,
          supplierMol: inv.supplierMol || null,
          supplierEmail: inv.supplierEmail || null,
          supplierPhone: inv.supplierPhone || null,
          supplierBank: inv.supplierBank || null,
          supplierIban: inv.supplierIban || null,
          supplierBic: inv.supplierBic || null,
          buyerType: inv.buyerType || null,
          buyerName: inv.buyerName || null,
          buyerEik: inv.buyerEik || null,
          buyerVat: inv.buyerVat || null,
          buyerEgn: inv.buyerEgn || null,
          buyerMol: inv.buyerMol || null,
          buyerAddr: inv.buyerAddr || null,
          buyerEmail: inv.buyerEmail || null,
          buyerBank: inv.buyerBank || null,
          buyerIban: inv.buyerIban || null,
          buyerBic: inv.buyerBic || null,
          items: inv.items || null,
          subtotal: inv.subtotal || null,
          vatAmount: inv.vatAmount || null,
          total: inv.total || null,
          createdAt: msToDate(inv.createdAt),
          updatedAt: msToDate(inv.updatedAt),
        }
      });
    }
    console.log(`  ✅ Invoices: ${invoices.length}`);

    // 8. Logs
    for (const l of logs) {
      await prisma.log.create({
        data: {
          id: l.id,
          userId: l.userId || null,
          action: l.action,
          meta: l.meta || null,
          createdAt: msToDate(l.createdAt),
        }
      });
    }
    console.log(`  ✅ Logs: ${logs.length}`);

    // 9. CompanyInfo
    for (const ci of companyInfo) {
      await prisma.companyInfo.create({
        data: {
          id: ci.id,
          name: ci.name,
          eik: ci.eik,
          vat: ci.vat || null,
          address: ci.address,
          city: ci.city,
          country: ci.country || 'България',
          mol: ci.mol || null,
          email: ci.email || null,
          phone: ci.phone || null,
          bank: ci.bank || null,
          iban: ci.iban || null,
          bic: ci.bic || null,
          proStart: ci.proStart || 1,
          invStart: ci.invStart || 1,
          createdAt: msToDate(ci.createdAt),
          updatedAt: msToDate(ci.updatedAt),
        }
      });
    }
    console.log(`  ✅ CompanyInfo: ${companyInfo.length}`);

    // 10. Policies
    for (const p of policies) {
      await prisma.policy.create({
        data: {
          id: p.id,
          slug: p.slug,
          title: p.title,
          content: p.content || null,
          createdAt: msToDate(p.createdAt),
          updatedAt: msToDate(p.updatedAt),
        }
      });
    }
    console.log(`  ✅ Policies: ${policies.length}`);

    // Verify
    console.log('\n✅ Migration complete! Verifying...');
    const counts = {
      users: await prisma.user.count(),
      cars: await prisma.car.count(),
      paramDefs: await prisma.carParamDef.count(),
      paramValues: await prisma.carParamValue.count(),
      locations: await prisma.location.count(),
      reservations: await prisma.reservation.count(),
      invoices: await prisma.invoice.count(),
      logs: await prisma.log.count(),
      companyInfo: await prisma.companyInfo.count(),
      policies: await prisma.policy.count(),
    };
    console.log('PostgreSQL counts:', counts);

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
