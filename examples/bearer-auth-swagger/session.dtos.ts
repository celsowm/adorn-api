import { Dto, Field, t } from "../../src";

@Dto({ description: "Authenticated user session returned by protected routes." })
export class SessionDto {
  @Field(t.string({ description: "User identifier." }))
  id!: string;

  @Field(t.array(t.string(), { description: "Roles granted to the bearer token." }))
  roles!: string[];

  @Field(t.string({ description: "Human-readable route result." }))
  message!: string;
}

@Dto({ description: "Public health response." })
export class PublicStatusDto {
  @Field(t.string())
  status!: string;
}
