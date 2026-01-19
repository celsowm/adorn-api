import {
  Dto,
  Errors,
  Field,
  MergeDto,
  MetalDto,
  createMetalCrudDtos,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
  t
} from "../../src";
import { Post } from "./post.entity";

const POST_DTO_OVERRIDES = {
  id: t.integer({ description: "Post id." }),
  title: t.string({ minLength: 1 }),
  body: t.nullable(t.string()),
  userId: t.integer({ description: "User id." }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const postCrud = createMetalCrudDtos(Post, {
  overrides: POST_DTO_OVERRIDES,
  response: { description: "Post returned by the API." },
  mutationExclude: ["id", "createdAt"]
});

export interface PostDto extends Omit<Post, "user"> {}

@postCrud.response
export class PostDto {}

type PostMutationDto = Omit<PostDto, "id" | "createdAt">;

export interface CreatePostDto extends PostMutationDto {}

@postCrud.create
export class CreatePostDto {}

export interface ReplacePostDto extends PostMutationDto {}

@postCrud.replace
export class ReplacePostDto {}

export interface UpdatePostDto extends Partial<PostMutationDto> {}

@postCrud.update
export class UpdatePostDto {}

export interface PostParamsDto extends Pick<PostDto, "id"> {}

@postCrud.params
export class PostParamsDto {}

type UserPostMutationDto = Omit<PostDto, "id" | "createdAt" | "userId">;

export interface CreateUserPostDto extends UserPostMutationDto {}

@MetalDto(Post, {
  mode: "create",
  overrides: POST_DTO_OVERRIDES,
  exclude: ["id", "createdAt", "userId"]
})
export class CreateUserPostDto {}

const PagedQueryDto = createPagedQueryDtoClass({
  name: "PostPagedQueryDto"
});

@Dto()
class PostFilterQueryDto {
  @Field(t.optional(t.string({ minLength: 1 })))
  titleContains?: string;

  @Field(t.optional(t.integer({ minimum: 1 })))
  userId?: number;
}

@MergeDto([PagedQueryDto, PostFilterQueryDto])
export class PostQueryDto {
  declare page?: number;
  declare pageSize?: number;
  declare titleContains?: string;
  declare userId?: number;
}

export const PostPagedResponseDto = createPagedResponseDtoClass({
  name: "PostPagedResponseDto",
  itemDto: PostDto,
  description: "Paged post list response."
});

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const PostErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid post id." },
  { status: 404, description: "Post not found." }
]);
