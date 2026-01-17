import { Dto, Field, OmitDto, PickDto, t } from "../../src";

@Dto({ description: "User record returned by the API." })
export class UserDto {
  @Field(t.uuid({ description: "User identifier." }))
  id!: string;

  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.optional(t.string()))
  nickname?: string;
}

export interface CreateUserDto extends Omit<UserDto, "id"> {}

@OmitDto(UserDto, ["id"])
export class CreateUserDto {}

export interface UserParamsDto extends Pick<UserDto, "id"> {}

@PickDto(UserDto, ["id"])
export class UserParamsDto {}
