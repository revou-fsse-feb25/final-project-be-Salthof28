import { Prisma } from "@prisma/client";
import { DatabaseException } from "../exception/database-exception";


export function handlePrismaError(error): never {
    // Error unique constraint, foreign key (example P1001: prisma not connect to database)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if(error.code === 'P2025') throw new DatabaseException('data in database not found')
        throw new DatabaseException(`Database error: ${error.code} - ${error.message}`);
    }
    // problem connection DB (PgBouncer juga bisa muncul di sini)
    if (error instanceof Prisma.PrismaClientInitializationError) {
        throw new DatabaseException(`Database connection failed: ${error.message}`);
    }
    // Query Prisma not valid
    if (error instanceof Prisma.PrismaClientValidationError) {

        throw new DatabaseException(`Invalid database query: ${error.message}`);
    }
    // PgBouncer / Postgres native error
    if (error && typeof error === 'object' && 'code' in error) {
        throw new DatabaseException(`Postgres error: ${error.code} - ${error.message}`);
    }
    // Fallback unknown error
    throw new DatabaseException();
}

function isRetryableError(error: unknown): boolean {
    // check connection to prisma
    if(error instanceof Prisma.PrismaClientInitializationError) {
        return true;
    }
    // known transient prisma errors
    if(error instanceof Prisma.PrismaClientKnownRequestError) {
        // check this error P1001 or P1008, if not return false
        return ['P1001','P1008'].includes(error.code)
    }
    return false
}

export async function retry<T>(fn: () => Promise<T>, retries:number = 2, delay:number = 300) {
    try{
        return await fn();
    } catch (error: unknown) {
        if(!isRetryableError(error)) {
            throw error;
        }

        if(retries <= 0) {
            throw error;
        }
        console.log(`Retrying database query... (${retries})`);
        // delay next retry
        await new Promise((resolve) => setTimeout(resolve, delay));
        // retry again
        return retry(fn, retries - 1, delay * 2)
    }
}