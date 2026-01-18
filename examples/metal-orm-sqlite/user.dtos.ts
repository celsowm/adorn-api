import {
  Dto,
  Errors,
  Field,
  MergeDto,
  MetalDto,
  OmitDto,
  PartialDto,
  PickDto,
  t
} from "../../src";
import { User } from "./user.entity";
import { PostDto } from "./post.dtos";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

const USER_DTO_OVERRIDES = {
  id: t.integer({ description: "User id." }),
  name: t.string({ minLength: 1 }),
  email: t.nullable(t.string({ format: "email" })),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

export interface UserDto extends Omit<User, "posts"> {}

@MetalDto(User, {
  description: "User returned by the API.",
  overrides: USER_DTO_OVERRIDES
})
export class UserDto {
  declare id: number;
  declare name: string;
  declare email?: string | null;
  declare createdAt: string;
}

export interface UserWithPostsDto extends UserDto {
  posts: PostDto[];
}

@Dto()
class UserPostsDto {
  @Field(t.array(t.ref(PostDto)))
  posts!: PostDto[];
}

@MergeDto([UserDto, UserPostsDto], {
  description: "User returned by the API with posts."
})
export class UserWithPostsDto {}

const USER_MUTATION_KEYS: Array<keyof UserDto> = ["id", "createdAt"];
type UserMutationDto = Omit<UserDto, (typeof USER_MUTATION_KEYS)[number]>;

export interface CreateUserDto extends UserMutationDto {}

@OmitDto(UserDto, USER_MUTATION_KEYS)
export class CreateUserDto {
  declare name: string;
  declare email?: string | null;
}

export interface ReplaceUserDto extends UserMutationDto {}

@OmitDto(UserDto, USER_MUTATION_KEYS)
export class ReplaceUserDto {
  declare name: string;
  declare email?: string | null;
}

export interface UpdateUserDto extends Partial<UserMutationDto> {}

@PartialDto(ReplaceUserDto)
export class UpdateUserDto {
  declare name?: string;
  declare email?: string | null;
}

export interface UserParamsDto extends Pick<UserDto, "id"> {}

@PickDto(UserDto, ["id"])
export class UserParamsDto {
  declare id: number;
}

@Dto()
class PagedQueryDto {
  @Field(t.optional(t.integer({ minimum: 1, default: 1 })))
  page?: number;

  @Field(
    t.optional(
      t.integer({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
    )
  )
  pageSize?: number;
}

@Dto()
class UserFilterQueryDto {
  @Field(t.optional(t.string({ minLength: 1 })))
  nameContains?: string;

  @Field(t.optional(t.string({ minLength: 1 })))
  emailContains?: string;
}

@MergeDto([PagedQueryDto, UserFilterQueryDto])
export class UserQueryDto {
  declare page?: number;
  declare pageSize?: number;
  declare nameContains?: string;
  declare emailContains?: string;
}

@Dto()
class UserListItemsDto {
  @Field(t.array(t.ref(UserDto)))
  items!: UserDto[];
}

@Dto()
class PagedResponseMetaDto {
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

@MergeDto([UserListItemsDto, PagedResponseMetaDto], {
  description: "Paged user list response."
})
export class UserPagedResponseDto {}

@Dto()
class UserWithPostsListItemsDto {
  @Field(t.array(t.ref(UserWithPostsDto)))
  items!: UserWithPostsDto[];
}

@MergeDto([UserWithPostsListItemsDto, PagedResponseMetaDto], {
  description: "Paged user list response with posts."
})
export class UserWithPostsPagedResponseDto {}

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const UserErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid user id." },
  { status: 404, description: "User not found." }
]);
