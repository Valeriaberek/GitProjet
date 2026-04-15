import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
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
    await this.ensureDemoData();
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

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS boats (
        id UUID PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        condition TEXT NOT NULL,
        is_out_of_service BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        boat_id UUID NOT NULL REFERENCES boats(id),
        responsible_id UUID NOT NULL REFERENCES users(id),
        status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
        departure_time TIMESTAMPTZ NOT NULL,
        return_time TIMESTAMPTZ,
        planned_distance_km NUMERIC(8, 2) NOT NULL DEFAULT 0,
        actual_distance_km NUMERIC(8, 2),
        route TEXT,
        remarks TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (return_time IS NULL OR return_time > departure_time),
        CHECK (planned_distance_km >= 0 AND (actual_distance_km IS NULL OR actual_distance_km >= 0))
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS session_crew (
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (session_id, user_id)
      );
    `);

    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_in_progress_per_boat_idx
      ON sessions (boat_id)
      WHERE status = 'IN_PROGRESS';
    `);
  }

  private async ensureDemoData(): Promise<void> {
    const demoToggle = process.env.DB_SEED_DEMO_DATA;
    const shouldSeed = demoToggle
      ? demoToggle.toLowerCase() === "true"
      : process.env.NODE_ENV !== "production";

    if (!shouldSeed) {
      return;
    }

    const boatsCountRows = await this.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM boats`);
    if (Number(boatsCountRows[0]?.count ?? 0) === 0) {
      const boats = [
        { name: "Filippi F42", type: "Skiff", capacity: 1, condition: "Bon etat" },
        { name: "Empacher E8", type: "Huit", capacity: 8, condition: "Bon etat" },
        { name: "Hudson H4", type: "Quatre", capacity: 4, condition: "A surveiller" }
      ];

      for (const boat of boats) {
        await this.query(
          `
          INSERT INTO boats (id, name, type, capacity, condition, is_out_of_service)
          VALUES ($1, $2, $3, $4, $5, FALSE)
          ON CONFLICT (name) DO NOTHING
          `,
          [randomUUID(), boat.name, boat.type, boat.capacity, boat.condition]
        );
      }
    }

    const sessionsCountRows = await this.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM sessions`);
    if (Number(sessionsCountRows[0]?.count ?? 0) > 0) {
      return;
    }

    const users = await this.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email IN ('admin@rowing.local', 'staff@rowing.local', 'rower@rowing.local')`
    );
    const boats = await this.query<{ id: string; name: string }>(`SELECT id, name FROM boats ORDER BY name ASC`);

    if (users.length < 2 || boats.length < 2) {
      return;
    }

    const admin = users.find((u) => u.email === "admin@rowing.local") ?? users[0];
    const staff = users.find((u) => u.email === "staff@rowing.local") ?? users[1];
    const rower = users.find((u) => u.email === "rower@rowing.local") ?? users[0];

    const inProgressId = randomUUID();
    const completedId = randomUUID();
    const completedOldId = randomUUID();

    await this.query(
      `
      INSERT INTO sessions (
        id,
        boat_id,
        responsible_id,
        status,
        departure_time,
        return_time,
        planned_distance_km,
        actual_distance_km,
        route,
        remarks
      )
      VALUES
      ($1, $2, $3, 'IN_PROGRESS', NOW() - INTERVAL '2 hours 25 minutes', NULL, 14.5, NULL, 'Boucle estuaire', 'Sortie endurance'),
      ($4, $5, $6, 'COMPLETED', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '4 hours 35 minutes', 12.0, 12.7, 'Canal nord', 'Bonne cadence'),
      ($7, $8, $9, 'COMPLETED', NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days 22 hours', 9.5, 9.1, 'Lac central', 'Vent modere')
      `,
      [
        inProgressId,
        boats[0].id,
        staff.id,
        completedId,
        boats[1].id,
        admin.id,
        completedOldId,
        boats[Math.min(2, boats.length - 1)].id,
        rower.id
      ]
    );

    await this.query(
      `
      INSERT INTO session_crew (session_id, user_id)
      VALUES ($1, $2), ($1, $3), ($4, $5)
      ON CONFLICT DO NOTHING
      `,
      [inProgressId, admin.id, rower.id, completedId, staff.id]
    );
  }
}
