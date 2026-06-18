import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check(): { status: string; service: string; time: string } {
    return {
      status: "ok",
      service: "quoteflow-api",
      time: new Date().toISOString(),
    };
  }
}
