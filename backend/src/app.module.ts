import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuthController, AuthService } from "./auth";
import { DbService } from "./db/db.service";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-local-secret",
      signOptions: { expiresIn: "1d" }
    })
  ],
  controllers: [HealthController, AuthController],
  providers: [AuthService, DbService]
})
export class AppModule {}
