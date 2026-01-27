import bcrypt from "bcryptjs";
import { prisma } from "../db.js";

const now = new Date();

const users = [
  {
    email: "admin@admin.com",
    name: "Admin",
    password: "admin1234",
    role: "admin",
  },
  {
    email: "support@support.com",
    name: "Support",
    password: "support.com",
    role: "support",
  },
];

const main = async () => {
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        role: u.role,
        isActive: true,
        approvalStatus: "approved",
        emailVerifiedAt: now,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        isActive: true,
        approvalStatus: "approved",
        emailVerifiedAt: now,
      },
    });
  }

  const result = await prisma.user.findMany({
    where: { email: { in: users.map((u) => u.email) } },
    select: { id: true, email: true, role: true, isActive: true, approvalStatus: true, emailVerifiedAt: true },
    orderBy: { email: "asc" },
  });

  console.log("Seeded users:");
  for (const row of result) {
    console.log(`- ${row.email} (${row.role}) active=${row.isActive} approval=${row.approvalStatus}`);
  }
};

main()
  .catch((err) => {
    console.error("Failed to seed admin/support users", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

