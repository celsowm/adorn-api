import {
  Dto,
  Errors,
  Field,
  MergeDto,
  createMetalCrudDtoClasses,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
  t
} from "../../src";
import { User } from "./user.entity";
import { PostDto } from "./post.dtos";

const USER_DTO_OVERRIDES = {
  id: t.integer({ description: "User id." }),
  name: t.string({ minLength: 1 }),
  email: t.nullable(t.string({ format: "email" })),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const userCrud = createMetalCrudDtoClasses(User, {
  overrides: USER_DTO_OVERRIDES,
  response: { description: "User returned by the API." },
  mutationExclude: ["id", "createdAt"]
});

export type UserDto = Omit<User, "posts">;
type UserMutationDto = Omit<UserDto, "id" | "createdAt">;
export type CreateUserDto = UserMutationDto;
export type ReplaceUserDto = UserMutationDto;
export type UpdateUserDto = Partial<UserMutationDto>;
export type UserParamsDto = Pick<UserDto, "id">;

export const {
  response: UserDto,
  create: CreateUserDto,
  replace: ReplaceUserDto,
  update: UpdateUserDto,
  params: UserParamsDto
} = userCrud;

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

const PagedQueryDto = createPagedQueryDtoClass({
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
