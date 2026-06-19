import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@quoteflow.com';
const DEMO_PASSWORD = 'demopass1';

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo company
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-001' },
    update: {},
    create: {
      id: 'demo-company-001',
      name: 'Demo Company',
    },
  });

  console.log(`✅ Created company: ${company.name} (${company.id})`);

  // Create a demo user with a real (login-able) password hash.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: {
      companyId: company.id,
      email: DEMO_EMAIL,
      passwordHash,
      role: 'OWNER',
    },
  });

  console.log(`✅ Created user: ${user.email}  (login: ${DEMO_EMAIL} / ${DEMO_PASSWORD})`);

  // Create some demo customers
  const customer1 = await prisma.customer.upsert({
    where: { id: 'demo-customer-001' },
    update: {},
    create: {
      id: 'demo-customer-001',
      companyId: company.id,
      name: 'Acme Corporation',
      email: 'contact@acme.com',
      contact: 'John Smith',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: 'demo-customer-002' },
    update: {},
    create: {
      id: 'demo-customer-002',
      companyId: company.id,
      name: 'Global Logistics Ltd',
      email: 'info@globallogistics.com',
      contact: 'Jane Doe',
    },
  });

  console.log(`✅ Created customers: ${customer1.name}, ${customer2.name}`);

  console.log('✨ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
