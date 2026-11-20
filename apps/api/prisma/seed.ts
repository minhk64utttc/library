import { hash } from '@node-rs/argon2';
import { PrismaClient, type Role } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@12345';

interface DemoAccount {
  email: string;
  role: Role;
  fullName: string;
  mustChangePassword?: boolean;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'admin@thu-vien.local',
    role: 'admin',
    fullName: 'Quản trị hệ thống',
    mustChangePassword: true,
  },
  { email: 'manager@thu-vien.local', role: 'manager', fullName: 'Quản lý thư viện' },
  { email: 'catalog@thu-vien.local', role: 'cataloging', fullName: 'Cán bộ biên mục' },
  { email: 'inventory@thu-vien.local', role: 'inventory', fullName: 'Cán bộ kho' },
  { email: 'circulation@thu-vien.local', role: 'circulation', fullName: 'Cán bộ mượn trả' },
  { email: 'reader@thu-vien.local', role: 'reader', fullName: 'Bạn đọc mẫu' },
];

async function main(): Promise<void> {
  const passwordHash = await hash(DEMO_PASSWORD);

  for (const account of DEMO_ACCOUNTS) {
    await prisma.account.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        status: 'active',
        ...(account.mustChangePassword !== undefined
          ? { mustChangePassword: account.mustChangePassword }
          : {}),
        roles: { deleteMany: {}, create: [{ role: account.role }] },
        profile: {
          upsert: {
            create: { fullName: account.fullName },
            update: { fullName: account.fullName },
          },
        },
      },
      create: {
        email: account.email,
        passwordHash,
        mustChangePassword: account.mustChangePassword ?? false,
        roles: { create: [{ role: account.role }] },
        profile: { create: { fullName: account.fullName } },
      },
    });
  }

  await prisma.policy.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });

  console.log(`Đã seed ${DEMO_ACCOUNTS.length} tài khoản demo và chính sách mặc định.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
