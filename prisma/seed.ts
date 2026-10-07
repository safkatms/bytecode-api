import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const password = await bcrypt.hash('pass123', 10);
  const adminPassword = await bcrypt.hash('Sakib#44389', 10);

  // =========================
  // ADMIN
  // =========================

  const admin = await prisma.user.upsert({
    where: { email: 'safkatmahmudsakib@gmail.com' },
    update: {},
    create: {
      firstName: 'Safkat Mahmud',
      lastName: 'Sakib',
      email: 'safkatmahmudsakib@gmail.com',
      password: adminPassword,
      role: Role.admin,
      isActive: true,
      createdBy: null,
      updatedBy: null,
    },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { updatedBy: admin.id },
  });

  console.log(`✅ Admin: ${admin.email}`);

  // ── Seed admin as employee ────────────────────────────────────
  const existingEmployee = await prisma.employee.findUnique({
    where: { userId: admin.id },
  });

  if (!existingEmployee) {
    await prisma.employee.create({
      data: {
        userId: admin.id,
        employeeCode: 'EMP-001',
        designation: 'System Administrator',
        joiningDate: new Date('2024-01-01'),
        isActive: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
    console.log(`✅ Admin employee profile created`);
  } else {
    console.log(`⏭️  Admin employee profile already exists`);
  }

  // =========================
  // USERS
  // =========================

  const users = [
    // {
    //   firstName: 'Ruhi',
    //   lastName: 'Barua',
    //   email: 'ruhi.barua89@gmail.com',
    //   role: Role.user,
    // },
    // {
    //   firstName: 'Faysal',
    //   lastName: 'Islam',
    //   email: 'faysalemon509@gmail.com',
    //   role: Role.user,
    // },
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: {
        email: userData.email,
      },
      update: {},
      create: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password,
        role: userData.role,
        isActive: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });

    console.log(`✅ User: ${user.email}`);
  }

  console.log('🌱 Seeding complete.');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });