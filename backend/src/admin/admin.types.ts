export type Role = "ROWER" | "STAFF" | "ADMIN";

export interface AuthContext {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface DashboardSession {
  id: string;
  boatName: string;
  responsibleName: string;
  crew: string[];
  departureTime: string;
  durationMinutes: number;
  route: string | null;
  plannedDistanceKm: number;
  isOverThreeHours: boolean;
}

export interface DashboardIndicators {
  inProgressCount: number;
  completedTodayCount: number;
  availableBoats: number;
  totalBoats: number;
}

export interface DashboardPayload {
  generatedAt: string;
  indicators: DashboardIndicators;
  activeSessions: DashboardSession[];
}

export interface SessionListItem {
  id: string;
  boatName: string;
  responsibleName: string;
  departureTime: string;
  returnTime: string | null;
  status: "IN_PROGRESS" | "COMPLETED";
  plannedDistanceKm: number;
  actualDistanceKm: number | null;
  route: string | null;
}

export interface SessionDetail extends SessionListItem {
  crew: string[];
  remarks: string | null;
}

export interface MemberItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface BoatItem {
  id: string;
  name: string;
  type: string;
  capacity: number;
  condition: string;
  isOutOfService: boolean;
}

export interface StatsOverview {
  period: string;
  sessionCount: number;
  totalDistanceKm: number;
  totalDurationHours: number;
}

export interface RowerStat {
  rowerId: string;
  rowerName: string;
  sessionCount: number;
  totalDistanceKm: number;
}

export interface BoatStat {
  boatId: string;
  boatName: string;
  sessionCount: number;
  totalDistanceKm: number;
  usageRatePercent: number;
}
