import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function upsertUser(email: string, password: string, fullName: string, role: "NURSE" | "PARENT" | "ADMIN", phone: string | null, facilityName: string | null) {
  const passwordHash = hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, fullName, role, phone, facilityName, active: true },
    create: { email, passwordHash, fullName, role, phone, facilityName },
  });
  console.log(`  ✓ ${role} user ${email}`);
}

async function main() {
  console.log("Seeding MatPed Care accounts...");
  await upsertUser("admin@matpedcare.test", "Admin123!", "Adaobi Okonkwo", "ADMIN", "+2348010000001", "MatPed HQ");
  await upsertUser("nurse@matpedcare.test", "Nurse123!", "Ngozi Adeyemi", "NURSE", "+2348010000002", "St. Mary's Health Centre");
  await upsertUser("parent@matpedcare.test", "Parent123!", "Chinedu Okafor", "PARENT", "+2348010000003", null);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });