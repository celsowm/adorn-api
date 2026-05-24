import {
  Auth,
  Controller,
  Get,
  Public,
  Returns,
  Roles,
  getUser,
  type AuthUser
} from "../../src";
import { PublicStatusDto, SessionDto } from "./session.dtos";

@Controller("/auth-demo")
export class AuthDemoController {
  @Get("/public")
  @Public()
  @Returns(PublicStatusDto)
  publicStatus() {
    return { status: "public route, no bearer token required" };
  }

  @Get("/me")
  @Auth()
  @Returns(SessionDto)
  me(ctx: any) {
    const user = getUser<AuthUser>(ctx.req)!;
    return {
      id: user.id,
      roles: user.roles ?? [],
      message: "Bearer token accepted"
    };
  }

  @Get("/admin")
  @Roles("admin")
  @Returns(SessionDto)
  admin(ctx: any) {
    const user = getUser<AuthUser>(ctx.req)!;
    return {
      id: user.id,
      roles: user.roles ?? [],
      message: "Admin role accepted"
    };
  }
}
