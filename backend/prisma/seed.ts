import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const managerHash = await bcrypt.hash("Manager123!", 10);
  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      firstName: "Manager",
      lastName: "User",
      email: "manager@example.com",
      passwordHash: managerHash,
      role: "MANAGER",
    },
  });

  const empHash = await bcrypt.hash("Employee123!", 10);
  const employee = await prisma.user.upsert({
    where: { email: "employee@example.com" },
    update: {},
    create: {
      firstName: "Ivan",
      lastName: "Ivanov",
      email: "employee@example.com",
      passwordHash: empHash,
      role: "EMPLOYEE",
    },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.task.createMany({
    data: [
      {
        userId: employee.id,
        title: "Подготовить отчет",
        description: "Подготовить отчет за день",
        status: "pending",
        priority: "medium",
        taskDate: today,
      },
      {
        userId: employee.id,
        title: "Позвонить клиенту",
        status: "in_progress",
        priority: "high",
        taskDate: today,
      },
    ],
  });

  console.log("Seed complete:", { admin: admin.email, manager: manager.email, employee: employee.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
