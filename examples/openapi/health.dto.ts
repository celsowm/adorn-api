import { Dto, Field, t } from "../../src";

@Dto()
export class HealthDto {
  @Field(t.string())
  message!: string;
}
