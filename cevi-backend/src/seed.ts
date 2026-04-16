import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clear existing
  await prisma.doppler.deleteMany();
  await prisma.image.deleteMany();
  await prisma.leg.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.doctor.deleteMany();

  // Create Doctor
  const password = await bcrypt.hash('jnmc2026', 10);
  await prisma.doctor.create({
    data: {
      email: 'dr.iranna@jnmc.edu',
      password,
      name: 'Dr. Iranna M Hittalamani',
      role: 'interventional_radiologist',
    },
  });
  console.log('Created doctor dr.iranna@jnmc.edu');

  // Patient 1
  const p1 = await prisma.patient.create({
    data: {
      uhid: 'UHID-1001',
      name: 'Ramesh Kumar',
      age: 45,
      sex: 'Male',
      height: 170,
      weight: 75,
      bmi: parseFloat((75 / ((170 / 100) ** 2)).toFixed(1)),
      comorbidities: JSON.stringify(['Hypertension', 'Diabetes']),
      venous_history: JSON.stringify(['Previous DVT']),
    },
  });
  console.log('Created patient 1');

  // Patient 2
  const p2 = await prisma.patient.create({
    data: {
      uhid: 'UHID-1002',
      name: 'Suma Patil',
      age: 38,
      sex: 'Female',
      height: 160,
      weight: 65,
      bmi: parseFloat((65 / ((160 / 100) ** 2)).toFixed(1)),
      comorbidities: JSON.stringify([]),
      venous_history: JSON.stringify(['Family History']),
    },
  });
  console.log('Created patient 2');

  // Patient 3
  const p3 = await prisma.patient.create({
    data: {
      uhid: 'UHID-1003',
      name: 'Basavaraj Desai',
      age: 55,
      sex: 'Male',
      height: 165,
      weight: 80,
      bmi: parseFloat((80 / ((165 / 100) ** 2)).toFixed(1)),
      comorbidities: JSON.stringify(['Obesity']),
      venous_history: JSON.stringify([]),
    },
  });
  console.log('Created patient 3');

  console.log('Seeding complete. Use dr.iranna@jnmc.edu / jnmc2026 to log in.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
