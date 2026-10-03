import { Prisma } from '@prisma/client'

/** Runtime Prisma JSON null sentinel — kept outside domain modules for INV-4. */
export const PrismaDbNull = Prisma.DbNull
