import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@demo.local";
  const passwordHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, role: "ADMIN" }
  });

  // Params
  const typeParam = await prisma.carParamDef.upsert({
    where: { name: "Вид кола" },
    update: {},
    create: { name: "Вид кола", type: "ENUM", options: JSON.stringify(["Лека кола", "Джип", "Товарен бус"]) }
  });
  await prisma.carParamDef.upsert({
    where: { name: "Конски сили" },
    update: {},
    create: { name: "Конски сили", type: "NUMBER", unit: "к.с." }
  });

  // Cars
  const cars = [];
  const brands = ["Ford", "Toyota", "Kia", "BMW", "Audi", "Tesla"];
  for (let i = 0; i < 12; i++) {
    const brand = brands[i % brands.length];
    const car = await prisma.car.create({
      data: {
        brand,
        model: i % 2 ? "EcoBlue" : "Focus",
        trim: null,
        pricePerHour: 22 + (i % 7) * 2 + (i % 3),
        transmission: i % 2 ? "AUTOMATIC" : "MANUAL",
        fuel: ["DIESEL", "PETROL", "ELECTRIC"][i % 3],
        seats: [4, 5, 7][i % 3],
        type: ["Лека кола", "Джип", "Товарен бус"][i % 3],
        status: "AVAILABLE"
      }
    });
    cars.push(car);
    await prisma.carParamValue.create({
      data: { carId: car.id, paramId: typeParam.id, valueEnum: car.type }
    });
  }
  console.log(`Seeded ${cars.length} cars`);

  // Locations
  const locations = [
    "гр. София, Летище SOF",
    "гр. София, Център",
    "гр. Пловдив, Център",
    "гр. Варна, Летище VAR"
  ];
  for (const label of locations) {
    await prisma.location.upsert({
      where: { label },
      update: {},
      create: { label }
    });
  }

  // Company info (seed minimal)
  const companyDefault = {
    name: "CarRent BG OOD",
    eik: "204000123",
    vat: "BG204000123",
    address: "ул. Пример 1",
    city: "София",
    country: "България",
    mol: "Иван Иванов",
    email: "office@carrent.bg",
    phone: "+359 888 000 000",
    bank: "УниКредит Булбанк",
    iban: "BG00UNCR00000000000000",
    bic: "UNCRBGSF"
  };
  const existingCompany = await prisma.companyInfo.findFirst();
  if (!existingCompany) {
    await prisma.companyInfo.create({ data: companyDefault });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().finally(() => process.exit(1)); });


