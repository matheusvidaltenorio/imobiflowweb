import type { PrismaClient } from '@prisma/client';
import { DEVELOPMENTS_CATALOG, coverPathForFile, slugifyForSeed } from './developments-catalog';

export async function seedDevelopmentsCatalog(prisma: PrismaClient): Promise<void> {
  console.log('\n[developments] catálogo inicial (imagens locais /uploads/loteamentos/)…');
  for (const entry of DEVELOPMENTS_CATALOG) {
    const exists = await prisma.development.findFirst({
      where: { name: entry.name },
      select: { id: true },
    });
    if (exists) {
      console.log(`[developments] ignorado — já existe: "${entry.name}"`);
      continue;
    }

    const base = slugifyForSeed(entry.name);
    let slug = base;
    let n = 0;
    while (
      await prisma.development.findFirst({
        where: { slug },
        select: { id: true },
      })
    ) {
      n += 1;
      slug = `${base}-${n}`;
    }

    const coverImage = coverPathForFile(entry.imageFile);
    await prisma.development.create({
      data: {
        name: entry.name,
        slug,
        city: entry.city,
        state: entry.state,
        description: entry.description,
        coverImage,
        coverImageAlt: `Imagem do loteamento ${entry.name}`,
      },
    });
    console.log(`[developments] inserido: "${entry.name}" | ${coverImage}`);
  }
}

/** Garante slug para loteamentos antigos (ex.: seed demo Vista Verde). */
export async function backfillDevelopmentSlugs(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.development.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  });
  if (!rows.length) return;

  console.log('\n[developments] preenchendo slug em registros antigos…');
  for (const d of rows) {
    const base = slugifyForSeed(d.name);
    let slug = base;
    let n = 0;
    while (
      await prisma.development.findFirst({
        where: { slug, NOT: { id: d.id } },
        select: { id: true },
      })
    ) {
      n += 1;
      slug = `${base}-${n}`;
    }
    await prisma.development.update({
      where: { id: d.id },
      data: { slug },
    });
    console.log(`[developments] slug: "${d.name}" → ${slug}`);
  }
}
