import { Dto, Errors, Field, OmitDto, PartialDto, PickDto, t } from "../../src";

@Dto({ description: "User returned by the API." })
export class UserDto {
  @Field(t.integer({ description: "User id." }))
  id!: number;

  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.optional(t.nullable(t.string({ format: "email" }))))
  email?: string | null;

  @Field(t.dateTime({ description: "Creation timestamp." }))
  createdAt!: string;
}

export interface CreateUserDto extends Omit<UserDto, "id" | "createdAt"> {}

@OmitDto(UserDto, ["id", "createdAt"])
export class CreateUserDto {}

export interface ReplaceUserDto extends Omit<UserDto, "id" | "createdAt"> {}

@OmitDto(UserDto, ["id", "createdAt"])
export class ReplaceUserDto {}

export interface UpdateUserDto extends Partial<ReplaceUserDto> {}

@PartialDto(ReplaceUserDto)
export class UpdateUserDto {}

export interface UserParamsDto extends Pick<UserDto, "id"> {}

@PickDto(UserDto, ["id"])
export class UserParamsDto {}

@Dto()
export class UserQueryDto {
  @Field(t.optional(t.integer({ minimum: 0 })))
  offset?: number;

  @Field(t.optional(t.integer({ minimum: 1, maximum: 100 })))
  limit?: number;
}

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const UserErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid user id." },
  { status: 404, description: "User not found." }
]);
