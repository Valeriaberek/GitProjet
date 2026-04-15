import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";

import { DbService } from "../db/db.service";
import {
  AuthContext,
  BoatItem,
  BoatStat,
  DashboardPayload,
  DashboardSession,
  MemberItem,
  Role,
  RowerStat,
  SessionDetail,
  SessionListItem,
  StatsOverview
} from "./admin.types";

interface UserRow {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly dbService: DbService,
    private readonly jwtService: JwtService
  ) {}

  async getDashboard(authHeader: string | undefined): Promise<DashboardPayload> {
    await this.requireRoles(authHeader, ["STAFF", "ADMIN"]);

    const activeRows = await this.dbService.query<{
      id: string;
      boat_name: string;
      responsible_name: string;
      departure_time: Date;
      route: string | null;
      planned_distance_km: number;
      crew: string[];
      duration_minutes: number;
    }>(
      `
      SELECT
        s.id,
        b.name AS boat_name,
        u.name AS responsible_name,
        s.departure_time,
        s.route,
        s.planned_distance_km,
        COALESCE(array_remove(array_agg(cu.name), NULL), '{}'::text[]) AS crew,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - s.departure_time)) / 60)::int AS duration_minutes
      FROM sessions s
      INNER JOIN boats b ON b.id = s.boat_id
      INNER JOIN users u ON u.id = s.responsible_id
      LEFT JOIN session_crew sc ON sc.session_id = s.id
      LEFT JOIN users cu ON cu.id = sc.user_id
      WHERE s.status = 'IN_PROGRESS'
      GROUP BY s.id, b.name, u.name, s.departure_time, s.route, s.planned_distance_km
      ORDER BY s.departure_time ASC
      `
    );

    const indicatorsRows = await this.dbService.query<{
      in_progress_count: number;
      completed_today_count: number;
      available_boats: number;
      total_boats: number;
    }>(
      `
      SELECT
        (SELECT COUNT(*)::int FROM sessions WHERE status = 'IN_PROGRESS') AS in_progress_count,
        (
          SELECT COUNT(*)::int
          FROM sessions
          WHERE status = 'COMPLETED'
          AND return_time >= date_trunc('day', NOW())
        ) AS completed_today_count,
        (
          SELECT COUNT(*)::int
          FROM boats
          WHERE is_out_of_service = FALSE
          AND id NOT IN (SELECT boat_id FROM sessions WHERE status = 'IN_PROGRESS')
        ) AS available_boats,
        (SELECT COUNT(*)::int FROM boats) AS total_boats
      `
    );

    const activeSessions: DashboardSession[] = activeRows.map((row) => ({
      id: row.id,
      boatName: row.boat_name,
      responsibleName: row.responsible_name,
      crew: row.crew,
      departureTime: row.departure_time.toISOString(),
      durationMinutes: Number(row.duration_minutes),
      route: row.route,
      plannedDistanceKm: Number(row.planned_distance_km),
      isOverThreeHours: Number(row.duration_minutes) >= 180
    }));

    const indicators = indicatorsRows[0];

    return {
      generatedAt: new Date().toISOString(),
      indicators: {
        inProgressCount: Number(indicators?.in_progress_count ?? 0),
        completedTodayCount: Number(indicators?.completed_today_count ?? 0),
        availableBoats: Number(indicators?.available_boats ?? 0),
        totalBoats: Number(indicators?.total_boats ?? 0)
      },
      activeSessions
    };
  }

  async listSessions(
    authHeader: string | undefined,
    filters: {
      status?: "IN_PROGRESS" | "COMPLETED";
      boat?: string;
      rower?: string;
      date?: string;
      page?: string;
      pageSize?: string;
    }
  ): Promise<{ items: SessionListItem[]; total: number }> {
    await this.requireRoles(authHeader, ["STAFF", "ADMIN"]);

    const params: unknown[] = [];
    const where: string[] = [];

    if (filters.status && ["IN_PROGRESS", "COMPLETED"].includes(filters.status)) {
      params.push(filters.status);
      where.push(`s.status = $${params.length}`);
    }

    if (filters.boat?.trim()) {
      params.push(`%${filters.boat.trim().toLowerCase()}%`);
      where.push(`LOWER(b.name) LIKE $${params.length}`);
    }

    if (filters.rower?.trim()) {
      params.push(`%${filters.rower.trim().toLowerCase()}%`);
      where.push(`LOWER(u.name) LIKE $${params.length}`);
    }

    if (filters.date?.trim()) {
      params.push(filters.date.trim());
      where.push(`s.departure_time::date = $${params.length}::date`);
    }

    const page = Math.max(Number(filters.page ?? 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(filters.pageSize ?? 20) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const totalRows = await this.dbService.query<{ total: number }>(
      `
      SELECT COUNT(*)::int AS total
      FROM sessions s
      INNER JOIN boats b ON b.id = s.boat_id
      INNER JOIN users u ON u.id = s.responsible_id
      ${whereClause}
      `,
      params
    );

    const dataParams = [...params, pageSize, offset];

    const rows = await this.dbService.query<{
      id: string;
      boat_name: string;
      responsible_name: string;
      departure_time: Date;
      return_time: Date | null;
      status: "IN_PROGRESS" | "COMPLETED";
      planned_distance_km: number;
      actual_distance_km: number | null;
      route: string | null;
    }>(
      `
      SELECT
        s.id,
        b.name AS boat_name,
        u.name AS responsible_name,
        s.departure_time,
        s.return_time,
        s.status,
        s.planned_distance_km,
        s.actual_distance_km,
        s.route
      FROM sessions s
      INNER JOIN boats b ON b.id = s.boat_id
      INNER JOIN users u ON u.id = s.responsible_id
      ${whereClause}
      ORDER BY s.departure_time DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      dataParams
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        boatName: row.boat_name,
        responsibleName: row.responsible_name,
        departureTime: row.departure_time.toISOString(),
        returnTime: row.return_time ? row.return_time.toISOString() : null,
        status: row.status,
        plannedDistanceKm: Number(row.planned_distance_km),
        actualDistanceKm: row.actual_distance_km == null ? null : Number(row.actual_distance_km),
        route: row.route
      })),
      total: Number(totalRows[0]?.total ?? 0)
    };
  }

  async getSessionDetail(authHeader: string | undefined, sessionId: string): Promise<SessionDetail> {
    await this.requireRoles(authHeader, ["STAFF", "ADMIN"]);

    const rows = await this.dbService.query<{
      id: string;
      boat_name: string;
      responsible_name: string;
      departure_time: Date;
      return_time: Date | null;
      status: "IN_PROGRESS" | "COMPLETED";
      planned_distance_km: number;
      actual_distance_km: number | null;
      route: string | null;
      remarks: string | null;
      crew: string[];
    }>(
      `
      SELECT
        s.id,
        b.name AS boat_name,
        u.name AS responsible_name,
        s.departure_time,
        s.return_time,
        s.status,
        s.planned_distance_km,
        s.actual_distance_km,
        s.route,
        s.remarks,
        COALESCE(array_remove(array_agg(cu.name), NULL), '{}'::text[]) AS crew
      FROM sessions s
      INNER JOIN boats b ON b.id = s.boat_id
      INNER JOIN users u ON u.id = s.responsible_id
      LEFT JOIN session_crew sc ON sc.session_id = s.id
      LEFT JOIN users cu ON cu.id = sc.user_id
      WHERE s.id = $1
      GROUP BY s.id, b.name, u.name, s.departure_time, s.return_time, s.status, s.planned_distance_km, s.actual_distance_km, s.route, s.remarks
      LIMIT 1
      `,
      [sessionId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Sortie introuvable");
    }

    return {
      id: row.id,
      boatName: row.boat_name,
      responsibleName: row.responsible_name,
      departureTime: row.departure_time.toISOString(),
      returnTime: row.return_time ? row.return_time.toISOString() : null,
      status: row.status,
      plannedDistanceKm: Number(row.planned_distance_km),
      actualDistanceKm: row.actual_distance_km == null ? null : Number(row.actual_distance_km),
      route: row.route,
      remarks: row.remarks,
      crew: row.crew
    };
  }

  async closeSession(
    authHeader: string | undefined,
    sessionId: string,
    payload: { returnTime?: string; actualDistanceKm?: number; remarks?: string }
  ): Promise<{ success: boolean }> {
    await this.requireRoles(authHeader, ["STAFF", "ADMIN"]);

    const rows = await this.dbService.query<{ departure_time: Date; status: "IN_PROGRESS" | "COMPLETED" }>(
      `SELECT departure_time, status FROM sessions WHERE id = $1 LIMIT 1`,
      [sessionId]
    );

    const session = rows[0];
    if (!session) {
      throw new NotFoundException("Sortie introuvable");
    }

    if (session.status !== "IN_PROGRESS") {
      throw new BadRequestException("La sortie est deja cloturee");
    }

    const returnTime = payload.returnTime ? new Date(payload.returnTime) : new Date();
    if (Number.isNaN(returnTime.getTime())) {
      throw new BadRequestException("Heure de retour invalide");
    }

    if (returnTime <= new Date(session.departure_time)) {
      throw new BadRequestException("L'heure de retour doit etre strictement posterieure au depart");
    }

    const distance = payload.actualDistanceKm ?? null;
    if (distance != null && distance < 0) {
      throw new BadRequestException("La distance reelle doit etre positive");
    }

    await this.dbService.query(
      `
      UPDATE sessions
      SET
        status = 'COMPLETED',
        return_time = $2,
        actual_distance_km = COALESCE($3, actual_distance_km, planned_distance_km),
        remarks = COALESCE($4, remarks),
        updated_at = NOW()
      WHERE id = $1
      `,
      [sessionId, returnTime, distance, payload.remarks ?? null]
    );

    return { success: true };
  }

  async exportSessionsCsv(
    authHeader: string | undefined,
    filters: {
      status?: "IN_PROGRESS" | "COMPLETED";
      boat?: string;
      rower?: string;
      date?: string;
    }
  ): Promise<string> {
    const listing = await this.listSessions(authHeader, { ...filters, page: "1", pageSize: "5000" });

    const header = [
      "id",
      "bateau",
      "responsable",
      "depart",
      "retour",
      "statut",
      "distance_prevue_km",
      "distance_reelle_km",
      "parcours"
    ];

    const lines = listing.items.map((item) =>
      [
        item.id,
        item.boatName,
        item.responsibleName,
        item.departureTime,
        item.returnTime ?? "",
        item.status,
        item.plannedDistanceKm,
        item.actualDistanceKm ?? "",
        item.route ?? ""
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    );

    return [header.join(","), ...lines].join("\n");
  }

  async listMembers(authHeader: string | undefined): Promise<MemberItem[]> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    const rows = await this.dbService.query<UserRow>(
      `
      SELECT id, email, name, role, is_active, created_at
      FROM users
      ORDER BY created_at DESC
      `
    );

    return rows.map((row) => {
      const split = this.splitName(row.name);
      return {
        id: row.id,
        firstName: split.firstName,
        lastName: split.lastName,
        email: row.email,
        role: row.role,
        isActive: row.is_active,
        createdAt: row.created_at.toISOString()
      };
    });
  }

  async createMember(
    authHeader: string | undefined,
    payload: { firstName: string; lastName: string; email: string; role: Role }
  ): Promise<MemberItem> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    const firstName = payload.firstName?.trim();
    const lastName = payload.lastName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const role = payload.role;

    if (!firstName || !lastName || !email || !email.includes("@")) {
      throw new BadRequestException("Informations membre invalides");
    }

    if (!["ROWER", "STAFF", "ADMIN"].includes(role)) {
      throw new BadRequestException("Role invalide");
    }

    const existing = await this.dbService.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (existing[0]) {
      throw new BadRequestException("Cet email existe deja");
    }

    const id = randomUUID();
    const name = `${firstName} ${lastName}`;

    await this.dbService.query(
      `
      INSERT INTO users (id, email, name, role, is_active, password_hash)
      VALUES ($1, $2, $3, $4, TRUE, $5)
      `,
      [id, email, name, role, "invitation-pending"]
    );

    return {
      id,
      firstName,
      lastName,
      email,
      role,
      isActive: true,
      createdAt: new Date().toISOString()
    };
  }

  async updateMember(
    authHeader: string | undefined,
    memberId: string,
    payload: { firstName?: string; lastName?: string; role?: Role }
  ): Promise<{ success: boolean }> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    const rows = await this.dbService.query<{ id: string; name: string }>(
      `SELECT id, name FROM users WHERE id = $1 LIMIT 1`,
      [memberId]
    );

    const member = rows[0];
    if (!member) {
      throw new NotFoundException("Membre introuvable");
    }

    const split = this.splitName(member.name);
    const firstName = payload.firstName?.trim() || split.firstName;
    const lastName = payload.lastName?.trim() || split.lastName;
    const role = payload.role || undefined;

    if (role && !["ROWER", "STAFF", "ADMIN"].includes(role)) {
      throw new BadRequestException("Role invalide");
    }

    await this.dbService.query(
      `
      UPDATE users
      SET
        name = $2,
        role = COALESCE($3, role),
        updated_at = NOW()
      WHERE id = $1
      `,
      [memberId, `${firstName} ${lastName}`.trim(), role ?? null]
    );

    return { success: true };
  }

  async setMemberStatus(
    authHeader: string | undefined,
    memberId: string,
    payload: { isActive: boolean }
  ): Promise<{ success: boolean }> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    await this.dbService.query(
      `
      UPDATE users
      SET is_active = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [memberId, payload.isActive]
    );

    return { success: true };
  }

  async deleteMember(authHeader: string | undefined, memberId: string): Promise<{ success: boolean }> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    await this.dbService.query(
      `
      UPDATE users
      SET is_active = FALSE, updated_at = NOW(), email = CONCAT('deleted+', id::text, '@anon.invalid')
      WHERE id = $1
      `,
      [memberId]
    );

    return { success: true };
  }

  async listBoats(authHeader: string | undefined): Promise<BoatItem[]> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    const rows = await this.dbService.query<{
      id: string;
      name: string;
      type: string;
      capacity: number;
      condition: string;
      is_out_of_service: boolean;
    }>(
      `
      SELECT id, name, type, capacity, condition, is_out_of_service
      FROM boats
      ORDER BY name ASC
      `
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      capacity: Number(row.capacity),
      condition: row.condition,
      isOutOfService: row.is_out_of_service
    }));
  }

  async createBoat(
    authHeader: string | undefined,
    payload: { name: string; type: string; capacity: number; condition: string }
  ): Promise<BoatItem> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    const name = payload.name?.trim();
    const type = payload.type?.trim();
    const condition = payload.condition?.trim();
    const capacity = Number(payload.capacity);

    if (!name || !type || !condition || Number.isNaN(capacity) || capacity < 1) {
      throw new BadRequestException("Informations bateau invalides");
    }

    const id = randomUUID();

    await this.dbService.query(
      `
      INSERT INTO boats (id, name, type, capacity, condition, is_out_of_service)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      `,
      [id, name, type, capacity, condition]
    );

    return { id, name, type, capacity, condition, isOutOfService: false };
  }

  async updateBoat(
    authHeader: string | undefined,
    boatId: string,
    payload: { name?: string; type?: string; capacity?: number; condition?: string }
  ): Promise<{ success: boolean }> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    const rows = await this.dbService.query<{ id: string }>(`SELECT id FROM boats WHERE id = $1 LIMIT 1`, [boatId]);
    if (!rows[0]) {
      throw new NotFoundException("Bateau introuvable");
    }

    await this.dbService.query(
      `
      UPDATE boats
      SET
        name = COALESCE($2, name),
        type = COALESCE($3, type),
        capacity = COALESCE($4, capacity),
        condition = COALESCE($5, condition),
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        boatId,
        payload.name?.trim() || null,
        payload.type?.trim() || null,
        payload.capacity == null ? null : Number(payload.capacity),
        payload.condition?.trim() || null
      ]
    );

    return { success: true };
  }

  async setBoatOutOfService(
    authHeader: string | undefined,
    boatId: string,
    payload: { isOutOfService: boolean }
  ): Promise<{ success: boolean }> {
    await this.requireRoles(authHeader, ["ADMIN"]);

    await this.dbService.query(
      `
      UPDATE boats
      SET is_out_of_service = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [boatId, payload.isOutOfService]
    );

    return { success: true };
  }

  async getOverviewStats(
    authHeader: string | undefined,
    period?: string
  ): Promise<StatsOverview> {
    await this.requireRoles(authHeader, ["STAFF", "ADMIN"]);

    const clause = this.periodWhereClause(period);

    const rows = await this.dbService.query<{
      session_count: number;
      total_distance_km: number;
      total_duration_hours: number;
    }>(
      `
      SELECT
        COUNT(*)::int AS session_count,
        COALESCE(SUM(COALESCE(actual_distance_km, planned_distance_km)), 0)::float AS total_distance_km,
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(return_time, NOW()) - departure_time)) / 3600), 0)::float AS total_duration_hours
      FROM sessions
      ${clause}
      `
    );

    const value = rows[0];

    return {
      period: period ?? "month",
      sessionCount: Number(value?.session_count ?? 0),
      totalDistanceKm: Number(value?.total_distance_km ?? 0),
      totalDurationHours: Number(value?.total_duration_hours ?? 0)
    };
  }

  async getRowerStats(authHeader: string | undefined): Promise<RowerStat[]> {
    await this.requireRoles(authHeader, ["STAFF", "ADMIN"]);

    const rows = await this.dbService.query<{
      rower_id: string;
      rower_name: string;
      session_count: number;
      total_distance_km: number;
    }>(
      `
      SELECT
        u.id AS rower_id,
        u.name AS rower_name,
        COUNT(s.id)::int AS session_count,
        COALESCE(SUM(COALESCE(s.actual_distance_km, s.planned_distance_km)), 0)::float AS total_distance_km
      FROM users u
      LEFT JOIN sessions s ON s.responsible_id = u.id
      GROUP BY u.id, u.name
      ORDER BY total_distance_km DESC, session_count DESC
      LIMIT 50
      `
    );

    return rows.map((row) => ({
      rowerId: row.rower_id,
      rowerName: row.rower_name,
      sessionCount: Number(row.session_count),
      totalDistanceKm: Number(row.total_distance_km)
    }));
  }

  async getBoatStats(authHeader: string | undefined): Promise<BoatStat[]> {
    await this.requireRoles(authHeader, ["STAFF", "ADMIN"]);

    const rows = await this.dbService.query<{
      boat_id: string;
      boat_name: string;
      session_count: number;
      total_distance_km: number;
      usage_rate_percent: number;
    }>(
      `
      SELECT
        b.id AS boat_id,
        b.name AS boat_name,
        COUNT(s.id)::int AS session_count,
        COALESCE(SUM(COALESCE(s.actual_distance_km, s.planned_distance_km)), 0)::float AS total_distance_km,
        CASE
          WHEN COUNT(*) OVER() = 0 THEN 0
          ELSE ROUND((COUNT(s.id)::numeric / SUM(COUNT(s.id)) OVER()) * 100, 2)::float
        END AS usage_rate_percent
      FROM boats b
      LEFT JOIN sessions s ON s.boat_id = b.id
      GROUP BY b.id, b.name
      ORDER BY session_count DESC, total_distance_km DESC
      `
    );

    return rows.map((row) => ({
      boatId: row.boat_id,
      boatName: row.boat_name,
      sessionCount: Number(row.session_count),
      totalDistanceKm: Number(row.total_distance_km),
      usageRatePercent: Number(row.usage_rate_percent)
    }));
  }

  private async requireRoles(authHeader: string | undefined, allowed: Role[]): Promise<AuthContext> {
    if (!authHeader) {
      throw new UnauthorizedException("Token manquant");
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Token invalide");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(token);

      const userRows = await this.dbService.query<UserRow>(
        `
        SELECT id, email, name, role, is_active, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [payload.sub]
      );

      const user = userRows[0];
      if (!user || !user.is_active) {
        throw new UnauthorizedException("Utilisateur inactif");
      }

      if (!allowed.includes(user.role)) {
        throw new ForbiddenException("Role insuffisant");
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Token invalide");
    }
  }

  private periodWhereClause(period?: string): string {
    if (period === "week") {
      return "WHERE departure_time >= NOW() - INTERVAL '7 days'";
    }

    if (period === "year") {
      return "WHERE departure_time >= NOW() - INTERVAL '1 year'";
    }

    if (period === "all") {
      return "";
    }

    return "WHERE departure_time >= NOW() - INTERVAL '1 month'";
  }

  private splitName(name: string): { firstName: string; lastName: string } {
    const [firstName, ...rest] = (name || "").split(" ").filter(Boolean);
    return {
      firstName: firstName || "-",
      lastName: rest.join(" ") || "-"
    };
  }
}
