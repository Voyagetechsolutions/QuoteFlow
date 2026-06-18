import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@quoteflow.com' },
    update: {},
    create: {
      companyId: company.id,
      email: 'demo@quoteflow.com',
      passwordHash: 'demo-hash-placeholder', // Replace with actual hash in production
      role: 'OWNER',
    },
  });

  console.log(`✅ Created user: ${user.email}`);

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
