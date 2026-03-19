import { Body, Controller, Get, Headers, Post } from "@nestjs/common";

import { AuthService } from "./auth.service";
import { LoginDto, LogoutDto, RefreshDto, RegisterDto } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post("login")
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    return this.authService.me(authorization);
  }

  @Post("refresh")
  refresh(@Body() payload: RefreshDto) {
    return this.authService.refresh(payload);
  }

  @Post("logout")
  async logout(@Body() payload: LogoutDto) {
    await this.authService.logout(payload);
    return { success: true };
  }
}
