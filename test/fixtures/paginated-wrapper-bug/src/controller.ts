import { Controller, Get } from "adorn-api";
import type { ListQuery } from "adorn-api/metal";

interface User {
  id: number;
  name: string;
}

interface Company {
  id: number;
  companyName: string;
}

interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
}

@Controller("/")
export class TestController {
  @Get("/users")
  async getUsers(query: ListQuery<User>): Promise<PaginatedResult<User>> {
    return {} as any;
  }

  @Get("/companies")
  async getCompanies(query: ListQuery<Company>): Promise<PaginatedResult<Company>> {
    return {} as any;
  }
}
