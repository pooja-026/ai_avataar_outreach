import { PrismaPg } from "@prisma/adapter-pg";

export type DatabaseClient = {
  $disconnect(): Promise<void>;
};

type PrismaClientConstructor = new (options: {
  adapter: PrismaPg;
}) => DatabaseClient;

const globalForPrisma = globalThis as unknown as {
  prisma: DatabaseClient | undefined;
};

/**
 * Creates a server-only Prisma client on first use. Keeping initialization lazy
 * lets builds and non-database routes run without a local database connection.
 * `npm run db:generate` creates the typed Prisma module this function loads.
 */
export async function getDb(): Promise<DatabaseClient> {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before database access.");
  }

  const adapter = new PrismaPg({ connectionString });
  const generatedClientModule = "@/generated/prisma/client";
  const { PrismaClient } = (await import(generatedClientModule)) as {
    PrismaClient: PrismaClientConstructor;
  };
  const prisma = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}
