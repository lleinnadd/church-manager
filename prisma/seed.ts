import { PrismaClient, PermissionAction, PermissionScopeType, DepartmentScope } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_RESOURCES = [
  'members',
  'congregations',
  'departments',
  'events',
  'treasury',
  'treasury-config',
];

interface ProfilePermission {
  resource: string;
  action: PermissionAction;
  scopeType: PermissionScopeType;
}

async function upsertProfile(
  name: string,
  description: string,
  permissions: ProfilePermission[],
) {
  const profile = await prisma.rbacProfile.upsert({
    where: { name },
    update: { description, isSystem: true },
    create: { name, description, isSystem: true },
  });

  await prisma.rbacPermission.deleteMany({ where: { profileId: profile.id } });

  await prisma.rbacPermission.createMany({
    data: permissions.map((p) => ({
      profileId: profile.id,
      resource: p.resource,
      action: p.action,
      scopeType: p.scopeType,
    })),
  });

  return profile;
}

async function main() {
  console.log('Seeding RBAC profiles...');

  const geralProfile = await upsertProfile(
    'Secretário Geral',
    'Acesso total a todos os recursos e congregações',
    ALL_RESOURCES.map((resource) => ({
      resource,
      action: PermissionAction.MANAGE,
      scopeType: PermissionScopeType.ALL,
    })),
  );
  console.log(`  ✓ Profile "${geralProfile.name}" created/updated`);

  const localPermissions: ProfilePermission[] = [
    { resource: 'members', action: PermissionAction.MANAGE, scopeType: PermissionScopeType.OWN_CONGREGATION },
    { resource: 'congregations', action: PermissionAction.READ, scopeType: PermissionScopeType.OWN_CONGREGATION },
    { resource: 'congregations', action: PermissionAction.UPDATE, scopeType: PermissionScopeType.OWN_CONGREGATION },
    { resource: 'departments', action: PermissionAction.READ, scopeType: PermissionScopeType.OWN_CONGREGATION },
    { resource: 'events', action: PermissionAction.MANAGE, scopeType: PermissionScopeType.OWN_CONGREGATION },
    { resource: 'treasury', action: PermissionAction.MANAGE, scopeType: PermissionScopeType.OWN_CONGREGATION },
    { resource: 'treasury-config', action: PermissionAction.READ, scopeType: PermissionScopeType.OWN_CONGREGATION },
    { resource: 'treasury-config', action: PermissionAction.UPDATE, scopeType: PermissionScopeType.OWN_CONGREGATION },
  ];

  const localProfile = await upsertProfile(
    'Secretário Local',
    'Acesso à gestão da própria congregação',
    localPermissions,
  );
  console.log(`  ✓ Profile "${localProfile.name}" created/updated`);

  const diretoria = await prisma.department.findFirst({
    where: { name: { contains: 'Diretoria', mode: 'insensitive' } },
    include: {
      functions: {
        where: {
          name: { contains: 'Secretári', mode: 'insensitive' },
        },
      },
    },
  });

  if (diretoria && diretoria.functions.length > 0) {
    const secretarioFn = diretoria.functions[0]!;

    await prisma.rbacProfileBinding.upsert({
      where: {
        profileId_functionId_scope: {
          profileId: geralProfile.id,
          functionId: secretarioFn.id,
          scope: DepartmentScope.GENERAL,
        },
      },
      update: {},
      create: {
        profileId: geralProfile.id,
        functionId: secretarioFn.id,
        scope: DepartmentScope.GENERAL,
      },
    });
    console.log(`  ✓ Binding: "${geralProfile.name}" → "${secretarioFn.name}" (GENERAL)`);

    await prisma.rbacProfileBinding.upsert({
      where: {
        profileId_functionId_scope: {
          profileId: localProfile.id,
          functionId: secretarioFn.id,
          scope: DepartmentScope.LOCAL,
        },
      },
      update: {},
      create: {
        profileId: localProfile.id,
        functionId: secretarioFn.id,
        scope: DepartmentScope.LOCAL,
      },
    });
    console.log(`  ✓ Binding: "${localProfile.name}" → "${secretarioFn.name}" (LOCAL)`);
  } else {
    console.log('  ⚠ "Diretoria" department or "Secretário(a)" function not found — skipping bindings');
    console.log('    Bindings will need to be created manually or re-run seed after setting up departments');
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
