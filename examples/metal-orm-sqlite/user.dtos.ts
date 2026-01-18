import {
  Dto,
  Errors,
  Field,
  MergeDto,
  createMetalCrudDtos,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
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

const userCrud = createMetalCrudDtos(User, {
  overrides: USER_DTO_OVERRIDES,
  response: { description: "User returned by the API." },
  mutationExclude: ["id", "createdAt"]
});

export interface UserDto extends Omit<User, "posts"> {}

@userCrud.response
export class UserDto {}

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

type UserMutationDto = Omit<UserDto, "id" | "createdAt">;

export interface CreateUserDto extends UserMutationDto {}

@userCrud.create
export class CreateUserDto {}

export interface ReplaceUserDto extends UserMutationDto {}

@userCrud.replace
export class ReplaceUserDto {}

export interface UpdateUserDto extends Partial<UserMutationDto> {}

@userCrud.update
export class UpdateUserDto {}

export interface UserParamsDto extends Pick<UserDto, "id"> {}

@userCrud.params
export class UserParamsDto {}

const PagedQueryDto = createPagedQueryDtoClass({
  defaultPageSize: DEFAULT_PAGE_SIZE,
  maxPageSize: MAX_PAGE_SIZE,
  name: "UserPagedQueryDto"
});

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

export const UserPagedResponseDto = createPagedResponseDtoClass({
  name: "UserPagedResponseDto",
  itemDto: UserDto,
  description: "Paged user list response."
});

export const UserWithPostsPagedResponseDto = createPagedResponseDtoClass({
  name: "UserWithPostsPagedResponseDto",
  itemDto: UserWithPostsDto,
  description: "Paged user list response with posts."
});

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const UserErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid user id." },
  { status: 404, description: "User not found." }
]);
