import prisma from "./prisma";

/**
 * One-time data fixes that must never be able to stop the server from booting.
 *
 * Each fix records a row in `app_data_migrations`, so it applies once and then
 * becomes a cheap no-op. The marker table is a real Prisma model (AppDataMigration)
 * so `prisma db push` keeps it in sync instead of treating it as drift and aborting.
 *
 * This runs after the server is listening and swallows its own errors: a slow or
 * failed fix logs a line and gets out of the way.
 */

const MARKER = "company_timezone_indian_maldives";

export async function applyOneTimeDataFixes(): Promise<void> {
  try {
    const applied = await prisma.appDataMigration.findUnique({
      where: { name: MARKER },
      select: { name: true },
    });
    if (applied) {
      return;
    }

    // Companies created before the `timezone` column existed were backfilled with
    // the old 'UTC' default, so their shift times were still read on the UTC clock.
    // Move them onto the deployment timezone; an admin can still change it later,
    // and the marker stops this from re-flipping a deliberate choice.
    const updated = await prisma.company.updateMany({
      where: { timezone: "UTC" },
      data: { timezone: "Indian/Maldives" },
    });

    await prisma.appDataMigration.upsert({
      where: { name: MARKER },
      create: { name: MARKER },
      update: {},
    });

    console.log(`[data-fix] ${MARKER}: updated ${updated.count} company record(s)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[data-fix] ${MARKER} failed; continuing startup: ${message}`);
  }
}
