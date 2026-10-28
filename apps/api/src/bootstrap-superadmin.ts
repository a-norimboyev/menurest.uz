import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { prisma } from './db.js';

dotenv.config();

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
      const val = parts.length > 1 ? parts.slice(1).join('=') : process.argv[i + 1] || 'true';
      if (!arg.includes('=') && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
        i++;
      }
      args[key] = val;
    }
  }
  return args;
}

function validatePassword(pass: string): { valid: boolean; reason?: string } {
  if (pass.length < 10) {
    return { valid: false, reason: 'Parol uzunligi kamida 10 ta belgidan iborat bo\'lishi shart' };
  }
  if (!/[A-Z]/.test(pass)) {
    return { valid: false, reason: 'Parolda kamida bitta katta harf bo\'lishi shart' };
  }
  if (!/[a-z]/.test(pass)) {
    return { valid: false, reason: 'Parolda kamida bitta kichik harf bo\'lishi shart' };
  }
  if (!/[0-9]/.test(pass)) {
    return { valid: false, reason: 'Parolda kamida bitta raqam bo\'lishi shart' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass)) {
    return { valid: false, reason: 'Parolda kamida bitta maxsus belgi bo\'lishi shart' };
  }
  return { valid: true };
}

async function bootstrapSuperAdmin() {
  console.log('\n======================================================');
  console.log('MENUREST.UZ — BIR MARTALIK SUPER ADMIN BOOTSTRAP TOOL');
  console.log('======================================================');

  const args = parseArgs();
  const phone = args.phone || process.env.SUPERADMIN_PHONE;
  const rawPassword = args.password || process.env.SUPERADMIN_PASSWORD;
  const fullName = args.name || process.env.SUPERADMIN_NAME || 'Platform Administrator';
  const force = args.force === 'true' || args.force === '';

  // 1. Allaqachon Super Admin mavjudligini tekshirish
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { isSuperAdmin: true },
  });

  if (existingSuperAdmin && !force) {
    console.log('\n[XAVFSIZLIK TO\'SIQ]:');
    console.log('Tizimda allaqachon Super Admin mavjud (ID:', existingSuperAdmin.id, ').');
    console.log('Xavfsizlik yuzasidan yangi super admin yaratish rad etildi.');
    console.log('Agar mavjud adminni yangilash lozim bo\'lsa, --force bayrog\'i bilan ishga tushiring.\n');
    process.exit(0);
  }

  // 2. Kirish ma'lumotlarini tekshirish
  if (!phone || !phone.trim()) {
    console.error('\nXATOLIK: Super admin telefon raqami ko\'rsatilmadi!');
    console.error('Quyidagicha ishga tushiring:');
    console.error('  npm run bootstrap:superadmin -- --phone="+998901234567" --password="SuperSecurePassword123!"');
    console.error('Yoki muhit o\'zgaruvchilari orqali: SUPERADMIN_PHONE va SUPERADMIN_PASSWORD.\n');
    process.exit(1);
  }

  if (!rawPassword || !rawPassword.trim()) {
    console.error('\nXATOLIK: Super admin paroli ko\'rsatilmadi!');
    console.error('Parol kamida 10 ta belgidan iborat kuchli kombinatsiya bo\'lishi shart.\n');
    process.exit(1);
  }

  const passCheck = validatePassword(rawPassword.trim());
  if (!passCheck.valid) {
    console.error(`\nXATOLIK: ${passCheck.reason}\n`);
    process.exit(1);
  }

  const cleanPhone = phone.trim();
  const cleanName = fullName.trim();
  const passwordHash = await bcrypt.hash(rawPassword.trim(), 10);

  // 3. Foydalanuvchini bazada yaratish yoki yangilash
  const superAdmin = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { phone: cleanPhone },
      update: {
        fullName: cleanName,
        passwordHash,
        isSuperAdmin: true,
        isActive: true,
      },
      create: {
        phone: cleanPhone,
        fullName: cleanName,
        passwordHash,
        isSuperAdmin: true,
        isActive: true,
      },
    });

    // Audit logiga qayd etish
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: 'SUPER_ADMIN',
        action: 'SUPER_ADMIN_BOOTSTRAPPED',
        entityName: 'User',
        entityId: user.id,
        reason: 'CLI orqali bir martalik xavfsiz Super Admin bootstrap qilindi',
        newStateJson: {
          phone: cleanPhone,
          fullName: cleanName,
          isSuperAdmin: true,
        },
      },
    });

    return user;
  });

  console.log('\n✓ MUVAFFAQIShIYATLI BOOTSTRAP QILINDI:');
  console.log('  ID:        ', superAdmin.id);
  console.log('  Telefon:   ', superAdmin.phone);
  console.log('  Ism:       ', superAdmin.fullName);
  console.log('  Vakolat:    SUPER_ADMIN');
  console.log('  Xavfsizlik: Parol qat\'iy bcrypt bilan hashlandi. Secretlar hech qayerda saqlanmadi.\n');
  process.exit(0);
}

bootstrapSuperAdmin().catch((err) => {
  console.error('Bootstrap jarayonida kutilmagan xatolik:', err);
  process.exit(1);
});
