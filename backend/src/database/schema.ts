import { pgTable, uuid, varchar, boolean, timestamp, pgEnum, text, decimal, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['ROWER', 'STAFF', 'ADMIN']);
export const sessionStatusEnum = pgEnum('session_status', ['IN_PROGRESS', 'COMPLETED']);
export const boatStateEnum = pgEnum('boat_state', ['GOOD', 'WATCH', 'MAINTENANCE']);

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: roleEnum('role').notNull().default('ROWER'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex('members_email_idx').on(table.email),
    isActiveIdx: index('members_is_active_idx').on(table.isActive),
  })
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberIdIdx: index('refresh_tokens_member_id_idx').on(table.memberId),
    expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
  })
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberIdIdx: index('password_reset_tokens_member_id_idx').on(table.memberId),
    expiresAtIdx: index('password_reset_tokens_expires_at_idx').on(table.expiresAt),
  })
);

export const invitationTokens = pgTable(
  'invitation_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    role: roleEnum('role').notNull().default('ROWER'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index('invitation_tokens_email_idx').on(table.email),
    expiresAtIdx: index('invitation_tokens_expires_at_idx').on(table.expiresAt),
  })
);

export const boats = pgTable(
  'boats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    capacity: decimal('capacity', { precision: 3, scale: 0 }).notNull(),
    state: boatStateEnum('state').notNull().default('GOOD'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    isActiveIdx: index('boats_is_active_idx').on(table.isActive),
  })
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boatId: uuid('boat_id').notNull().references(() => boats.id),
    responsibleId: uuid('responsible_id').notNull().references(() => members.id),
    departureTime: timestamp('departure_time', { withTimezone: true }).notNull(),
    returnTime: timestamp('return_time', { withTimezone: true }),
    plannedDistanceKm: decimal('planned_distance_km', { precision: 6, scale: 2 }).notNull(),
    actualDistanceKm: decimal('actual_distance_km', { precision: 6, scale: 2 }),
    route: text('route'),
    preRemarks: text('pre_remarks'),
    postRemarks: text('post_remarks'),
    status: sessionStatusEnum('status').notNull().default('IN_PROGRESS'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    boatIdIdx: index('sessions_boat_id_idx').on(table.boatId),
    responsibleIdIdx: index('sessions_responsible_id_idx').on(table.responsibleId),
    statusIdx: index('sessions_status_idx').on(table.status),
  })
);

export const sessionCrews = pgTable(
  'session_crews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').notNull().references(() => members.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionMemberIdx: uniqueIndex('session_crews_session_member_idx').on(table.sessionId, table.memberId),
  })
);

export const membersRelations = relations(members, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  passwordResetTokens: many(passwordResetTokens),
  sessions: many(sessions),
  crewSessions: many(sessionCrews),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  member: one(members, { fields: [refreshTokens.memberId], references: [members.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  member: one(members, { fields: [passwordResetTokens.memberId], references: [members.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  boat: one(boats, { fields: [sessions.boatId], references: [boats.id] }),
  responsible: one(members, { fields: [sessions.responsibleId], references: [members.id] }),
  crew: many(sessionCrews),
}));

export const sessionCrewsRelations = relations(sessionCrews, ({ one }) => ({
  session: one(sessions, { fields: [sessionCrews.sessionId], references: [sessions.id] }),
  member: one(members, { fields: [sessionCrews.memberId], references: [members.id] }),
}));

export const boatsRelations = relations(boats, ({ many }) => ({
  sessions: many(sessions),
}));
