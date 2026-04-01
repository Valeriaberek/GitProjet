import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { DbService } from "../db/db.service";
import { AuthResponse, LoginDto, LogoutDto, RefreshDto, RegisterDto, UserPublic } from "./auth.types";

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "ROWER" | "STAFF" | "ADMIN";
  isActive: boolean;
  passwordHash: string;
}

interface RefreshTokenRow {
  [key: string]: unknown;
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

interface SessionResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

const scryptAsync = promisify(nodeScrypt);

@Injectable()
export class AuthService implements OnModuleInit {
  private static readonly REFRESH_DURATION_DAYS = 30;

  constructor(
    private readonly jwtService: JwtService,
    private readonly dbService: DbService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultUsers();
  }

  async register(payload: RegisterDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(payload.email);
    const password = payload.password?.trim() ?? "";
    const name = payload.name?.trim() || "User";

    if (!email.includes("@")) {
      throw new BadRequestException("Email invalide");
    }

    if (password.length < 8) {
      throw new BadRequestException("Le mot de passe doit contenir au moins 8 caracteres");
    }

    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new ConflictException("Cet email existe deja");
    }

    const user: UserRecord = {
      id: randomUUID(),
      email,
      name,
      role: "ROWER",
      isActive: true,
      passwordHash: await this.hashSecret(password)
    };

    await this.dbService.query(
      `
      INSERT INTO users (id, email, name, role, is_active, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [user.id, user.email, user.name, user.role, user.isActive, user.passwordHash]
    );

    return this.createAuthResponse(user);
  }

  async login(payload: LoginDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(payload.email);
    const password = payload.password?.trim() ?? "";
    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Compte inactif");
    }

    const isValid = await this.verifySecret(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    return this.createAuthResponse(user);
  }

  async me(authHeader: string | undefined): Promise<UserPublic> {
    const token = this.extractToken(authHeader);

    if (!token) {
      throw new UnauthorizedException("Token manquant");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(token);
      const user = await this.findUserByEmail(payload.email);

      if (!user || user.id !== payload.sub || !user.isActive) {
        throw new UnauthorizedException("Utilisateur introuvable");
      }

      return this.toPublicUser(user);
    } catch {
      throw new UnauthorizedException("Token invalide");
    }
  }

  async refresh(payload: RefreshDto): Promise<AuthResponse> {
    const refreshToken = payload.refreshToken?.trim() ?? "";

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token manquant");
    }

    const tokenRows = await this.dbService.query<RefreshTokenRow>(
      `
      SELECT id, user_id, token_hash, expires_at, revoked_at
      FROM refresh_tokens
      WHERE revoked_at IS NULL
      AND expires_at > NOW()
      `
    );

    let matchedToken: RefreshTokenRow | null = null;

    for (const tokenRow of tokenRows) {
      const match = await this.verifySecret(refreshToken, tokenRow.token_hash);
      if (match) {
        matchedToken = tokenRow;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException("Refresh token invalide");
    }

    const userRows = await this.dbService.query<{
      id: string;
      email: string;
      name: string;
      role: "ROWER" | "STAFF" | "ADMIN";
      is_active: boolean;
      password_hash: string;
    }>(
      `
      SELECT id, email, name, role, is_active, password_hash
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [matchedToken.user_id]
    );

    const userRow = userRows[0];
    if (!userRow || !userRow.is_active) {
      throw new UnauthorizedException("Utilisateur introuvable");
    }

    const user: UserRecord = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      isActive: userRow.is_active,
      passwordHash: userRow.password_hash
    };

    const session = await this.createSession(user);

    await this.dbService.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = NOW(), replaced_by = $1
      WHERE id = $2
      `,
      [session.refreshTokenId, matchedToken.id]
    );

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: this.toPublicUser(user)
    };
  }

  async logout(payload: LogoutDto): Promise<void> {
    const refreshToken = payload.refreshToken?.trim() ?? "";

    if (!refreshToken) {
      return;
    }

    const tokenRows = await this.dbService.query<RefreshTokenRow>(
      `
      SELECT id, user_id, token_hash, expires_at, revoked_at
      FROM refresh_tokens
      WHERE revoked_at IS NULL
      `
    );

    for (const tokenRow of tokenRows) {
      const match = await this.verifySecret(refreshToken, tokenRow.token_hash);
      if (!match) {
        continue;
      }

      await this.dbService.query(
        `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1
        `,
        [tokenRow.id]
      );

      return;
    }
  }

  private async createAuthResponse(user: UserRecord): Promise<AuthResponse> {
    const session = await this.createSession(user);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: this.toPublicUser(user)
    };
  }

  private async createSession(user: UserRecord): Promise<SessionResult> {
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
    const refreshToken = randomBytes(48).toString("hex");
    const refreshTokenHash = await this.hashSecret(refreshToken);
    const refreshTokenId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + AuthService.REFRESH_DURATION_DAYS);

    await this.dbService.query(
      `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [refreshTokenId, user.id, refreshTokenHash, expiresAt]
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenId
    };
  }

  private toPublicUser(user: UserRecord): UserPublic {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  }

  private async findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.dbService.query<{
      id: string;
      email: string;
      name: string;
      role: "ROWER" | "STAFF" | "ADMIN";
      is_active: boolean;
      password_hash: string;
    }>(
      `
      SELECT id, email, name, role, is_active, password_hash
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    if (!rows[0]) {
      return null;
    }

    return {
      id: rows[0].id,
      email: rows[0].email,
      name: rows[0].name,
      role: rows[0].role,
      isActive: rows[0].is_active,
      passwordHash: rows[0].password_hash
    };
  }

  private normalizeEmail(email: string): string {
    return email?.trim().toLowerCase() ?? "";
  }

  private async hashSecret(secret: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = (await scryptAsync(secret, salt, 64)) as Buffer;
    return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
  }

  private async verifySecret(secret: string, storedHash: string): Promise<boolean> {
    const [algorithm, saltHex, hashHex] = storedHash.split("$");

    if (algorithm !== "scrypt" || !saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, "hex");
    const expectedHash = Buffer.from(hashHex, "hex");
    const actualHash = (await scryptAsync(secret, salt, expectedHash.length)) as Buffer;

    if (actualHash.length !== expectedHash.length) {
      return false;
    }

    return timingSafeEqual(actualHash, expectedHash);
  }

  private extractToken(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return null;
    }

    return token.trim();
  }

  private async ensureDefaultUsers(): Promise<void> {
    const seedToggle = process.env.AUTH_SEED_DEFAULT_USERS;
    const shouldSeed = seedToggle
      ? seedToggle.toLowerCase() === "true"
      : process.env.NODE_ENV !== "production";

    if (!shouldSeed) {
      return;
    }

    const defaults: Array<{ email: string; name: string; role: "ROWER" | "STAFF" | "ADMIN" }> = [
      { email: "admin@rowing.local", name: "Admin", role: "ADMIN" },
      { email: "staff@rowing.local", name: "Staff", role: "STAFF" },
      { email: "rower@rowing.local", name: "Rower", role: "ROWER" }
    ];

    const defaultPasswordHash = await this.hashSecret("Rowing123!");

    for (const account of defaults) {
      await this.dbService.query(
        `
        INSERT INTO users (id, email, name, role, is_active, password_hash)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          is_active = TRUE,
          password_hash = EXCLUDED.password_hash,
          updated_at = NOW()
        `,
        [
          randomUUID(),
          this.normalizeEmail(account.email),
          account.name,
          account.role,
          true,
          defaultPasswordHash
        ]
      );
    }
  }
}
