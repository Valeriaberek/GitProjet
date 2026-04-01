import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, QueryResultRow } from "pg";

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST ?? "localhost",
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
      database: process.env.DB_NAME ?? "rowing_logbook",
      user: process.env.DB_USER ?? "rl_user",
      password: process.env.DB_PASSWORD ?? "rl_pass"
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  private async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ROWER',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        replaced_by UUID REFERENCES refresh_tokens(id)
      );
    `);
  }
}
