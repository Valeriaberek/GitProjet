import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res } from "@nestjs/common";

import { AdminService } from "./admin.service";
import { Role } from "./admin.types";

@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("admin/dashboard")
  dashboard(@Headers("authorization") authorization?: string) {
    return this.adminService.getDashboard(authorization);
  }

  @Get("sessions/history")
  sessions(
    @Headers("authorization") authorization?: string,
    @Query("status") status?: "IN_PROGRESS" | "COMPLETED",
    @Query("boat") boat?: string,
    @Query("rower") rower?: string,
    @Query("date") date?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.adminService.listSessions(authorization, { status, boat, rower, date, page, pageSize });
  }

  @Get("sessions/:id")
  sessionDetail(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.adminService.getSessionDetail(authorization, id);
  }

  @Post("sessions/:id/close")
  closeSession(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() payload: { returnTime?: string; actualDistanceKm?: number; remarks?: string }
  ) {
    return this.adminService.closeSession(authorization, id, payload);
  }

  @Get("sessions/export.csv")
  async exportSessionsCsv(
    @Headers("authorization") authorization: string | undefined,
    @Res() res: { setHeader: (name: string, value: string) => void; send: (body: string) => void },
    @Query("status") status?: "IN_PROGRESS" | "COMPLETED",
    @Query("boat") boat?: string,
    @Query("rower") rower?: string,
    @Query("date") date?: string
  ): Promise<void> {
    const csv = await this.adminService.exportSessionsCsv(authorization, { status, boat, rower, date });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=sessions-export.csv");
    res.send(csv);
  }

  @Get("members")
  members(@Headers("authorization") authorization?: string) {
    return this.adminService.listMembers(authorization);
  }

  @Post("members")
  createMember(
    @Headers("authorization") authorization: string | undefined,
    @Body() payload: { firstName: string; lastName: string; email: string; role: Role }
  ) {
    return this.adminService.createMember(authorization, payload);
  }

  @Patch("members/:id")
  updateMember(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() payload: { firstName?: string; lastName?: string; role?: Role }
  ) {
    return this.adminService.updateMember(authorization, id, payload);
  }

  @Patch("members/:id/status")
  setMemberStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() payload: { isActive: boolean }
  ) {
    return this.adminService.setMemberStatus(authorization, id, payload);
  }

  @Delete("members/:id")
  deleteMember(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.adminService.deleteMember(authorization, id);
  }

  @Get("boats")
  boats(@Headers("authorization") authorization?: string) {
    return this.adminService.listBoats(authorization);
  }

  @Post("boats")
  createBoat(
    @Headers("authorization") authorization: string | undefined,
    @Body() payload: { name: string; type: string; capacity: number; condition: string }
  ) {
    return this.adminService.createBoat(authorization, payload);
  }

  @Patch("boats/:id")
  updateBoat(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() payload: { name?: string; type?: string; capacity?: number; condition?: string }
  ) {
    return this.adminService.updateBoat(authorization, id, payload);
  }

  @Patch("boats/:id/out-of-service")
  setBoatOutOfService(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() payload: { isOutOfService: boolean }
  ) {
    return this.adminService.setBoatOutOfService(authorization, id, payload);
  }

  @Get("stats/overview")
  overviewStats(@Headers("authorization") authorization?: string, @Query("period") period?: string) {
    return this.adminService.getOverviewStats(authorization, period);
  }

  @Get("stats/rowers")
  rowerStats(@Headers("authorization") authorization?: string) {
    return this.adminService.getRowerStats(authorization);
  }

  @Get("stats/boats")
  boatStats(@Headers("authorization") authorization?: string) {
    return this.adminService.getBoatStats(authorization);
  }
}
