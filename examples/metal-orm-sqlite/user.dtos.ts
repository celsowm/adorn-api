import { Dto, Errors, Field, OmitDto, PartialDto, PickDto, t } from "../../src";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

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

const USER_MUTATION_KEYS = ["id", "createdAt"] as const satisfies Array<keyof UserDto>;
type UserMutationDto = Omit<UserDto, (typeof USER_MUTATION_KEYS)[number]>;

export interface CreateUserDto extends UserMutationDto {}

@OmitDto(UserDto, USER_MUTATION_KEYS)
export class CreateUserDto {}

export interface ReplaceUserDto extends UserMutationDto {}

@OmitDto(UserDto, USER_MUTATION_KEYS)
export class ReplaceUserDto {}

export interface UpdateUserDto extends Partial<UserMutationDto> {}

@PartialDto(ReplaceUserDto)
export class UpdateUserDto {}

export interface UserParamsDto extends Pick<UserDto, "id"> {}

@PickDto(UserDto, ["id"])
export class UserParamsDto {}

@Dto()
export class UserQueryDto {
  @Field(t.optional(t.integer({ minimum: 1, default: 1 })))
  page?: number;

  @Field(
    t.optional(
      t.integer({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
    )
  )
  pageSize?: number;

  @Field(t.optional(t.string({ minLength: 1 })))
  nameContains?: string;

  @Field(t.optional(t.string({ minLength: 1 })))
  emailContains?: string;
}

@Dto({ description: "Paged user list response." })
export class UserPagedResponseDto {
  @Field(t.array(t.ref(UserDto)))
  items!: UserDto[];

  @Field(t.integer({ minimum: 0 }))
  totalItems!: number;

  @Field(t.integer({ minimum: 1 }))
  page!: number;

  @Field(t.integer({ minimum: 1 }))
  pageSize!: number;

  @Field(t.integer({ minimum: 1 }))
  totalPages!: number;

  @Field(t.boolean())
  hasNextPage!: boolean;

  @Field(t.boolean())
  hasPrevPage!: boolean;
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
