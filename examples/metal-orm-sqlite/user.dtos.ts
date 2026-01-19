import {
  Dto,
  Field,
  MergeDto,
  Errors,
  createMetalCrudDtoClasses,
  createPagedResponseDtoClass,
  createNestedCreateDtoClass,
  createPagedFilterQueryDtoClass,
  SimpleErrorDto,
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
  response: { description: "User returned by API." },
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
  description: "User returned by API with posts."
})
export class UserWithPostsDto {}

export const UserQueryDto = createPagedFilterQueryDtoClass({
  name: "UserQueryDto",
  filters: {
    nameContains: { schema: t.string({ minLength: 1 }), operator: "contains" },
    emailContains: { schema: t.string({ minLength: 1 }), operator: "contains" }
  }
});

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

export const UserErrors = Errors(SimpleErrorDto, [
  { status: 400, description: "Invalid user id." },
  { status: 404, description: "User not found." }
]);

export type UserQueryDto = typeof UserQueryDto;
