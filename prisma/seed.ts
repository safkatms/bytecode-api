import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // =========================
  // ADMIN ACCOUNTS
  // =========================

  const admins = [
    {
      firstName: 'Safkat Mahmud',
      lastName: 'Sakib',
      email: 'safkatmahmudsakib@gmail.com',
      password: 'Sakib#44389',
      employeeCode: 'EMP-001',
      designation: 'System Administrator',
      joiningDate: new Date('2024-01-01'),
    },
    {
      firstName: 'Admin',
      lastName: 'Two',
      email: 'admin2@example.com',
      password: 'Admin@12345',
      employeeCode: 'EMP-003',
      designation: 'Administrator',
      joiningDate: new Date('2026-01-01'),
    },
  ];

  const adminUsers = [];

  for (const adminData of admins) {
    const hashedPassword = await bcrypt.hash(
      adminData.password,
      10,
    );

    const admin = await prisma.user.upsert({
      where: {
        email: adminData.email,
      },
      update: {},
      create: {
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        email: adminData.email,
        password: hashedPassword,
        role: Role.admin,
        isActive: true,
        createdBy: null,
        updatedBy: null,
      },
    });

    // Set the admin as their own updater
    await prisma.user.update({
      where: {
        id: admin.id,
      },
      data: {
        updatedBy: admin.id,
      },
    });

    adminUsers.push(admin);

    console.log(`✅ Admin account: ${admin.email}`);

    // Create admin employee profile if it doesn't exist
    const existingEmployee = await prisma.employee.findUnique({
      where: {
        userId: admin.id,
      },
    });

    if (!existingEmployee) {
      await prisma.employee.create({
        data: {
          userId: admin.id,
          employeeCode: adminData.employeeCode,
          designation: adminData.designation,
          joiningDate: adminData.joiningDate,
          isActive: true,
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      });

      console.log(
        `✅ Admin employee profile created: ${adminData.employeeCode}`,
      );
    } else {
      console.log(
        `⏭️ Admin employee profile already exists: ${admin.email}`,
      );
    }
  }

  // Use the first admin as the creator of regular users
  const primaryAdmin = adminUsers[0];

  // =========================
  // DEFAULT USER PASSWORD
  // =========================

  const password = await bcrypt.hash('pass123', 10);

  // =========================
  // REGULAR USERS + EMPLOYEES
  // =========================

  const users = [
    {
      firstName: 'Faysal',
      lastName: 'Islam',
      email: 'faysalemon509@gmail.com',
      role: Role.user,
      employeeCode: 'EMP-002',
      designation: 'Software Support Engineer',
      joiningDate: new Date('2026-01-01'),
    },
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
        createdBy: primaryAdmin.id,
        updatedBy: primaryAdmin.id,
      },
    });

    console.log(`✅ User account: ${user.email}`);

    // Create employee profile if it doesn't exist
    const existingEmployee = await prisma.employee.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!existingEmployee) {
      await prisma.employee.create({
        data: {
          userId: user.id,
          employeeCode: userData.employeeCode,
          designation: userData.designation,
          joiningDate: userData.joiningDate,
          isActive: true,
          createdBy: primaryAdmin.id,
          updatedBy: primaryAdmin.id,
        },
      });

      console.log(
        `✅ Employee profile created: ${userData.employeeCode}`,
      );
    } else {
      console.log(
        `⏭️ Employee profile already exists: ${user.email}`,
      );
    }
  }

  console.log('🌱 Seeding complete.');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });