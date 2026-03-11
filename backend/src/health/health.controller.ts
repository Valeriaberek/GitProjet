import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  public health(): { status: string; service: string; timestamp: string } {
    return {
      status: "ok",
      service: "backend",
      timestamp: new Date().toISOString()
    };
  }

  @Get()
  public root(): { message: string } {
    return { message: "Rowing Logbook API" };
  }
}
