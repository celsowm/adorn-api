import {
  Dto,
  MergeDto,
  Errors,
  createMetalCrudDtoClasses,
  createPagedResponseDtoClass,
  createNestedCreateDtoClass,
  createPagedFilterQueryDtoClass,
  SimpleErrorDto,
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

const postCrud = createMetalCrudDtoClasses(Post, {
  overrides: POST_DTO_OVERRIDES,
  response: { description: "Post returned by API." },
  mutationExclude: ["id", "createdAt"]
});

export const {
  response: PostDto,
  create: CreatePostDto,
  replace: ReplacePostDto,
  update: UpdatePostDto,
  params: PostParamsDto
} = postCrud;

export type PostDto = Omit<Post, "user">;
type PostMutationDto = Omit<PostDto, "id" | "createdAt">;
export type CreatePostDto = PostMutationDto;
export type ReplacePostDto = PostMutationDto;
export type UpdatePostDto = Partial<PostMutationDto>;
export type PostParamsDto = InstanceType<typeof PostParamsDto>;

export const CreateUserPostDtoClass = createNestedCreateDtoClass(
  Post,
  POST_DTO_OVERRIDES,
  {
    name: "CreateUserPostDto",
    additionalExclude: ["userId"]
  }
);

export interface CreateUserPostDto {
  title: string;
  body?: string | null;
}

export const PostQueryDtoClass = createPagedFilterQueryDtoClass({
  name: "PostQueryDto",
  filters: {
    titleContains: { schema: t.string({ minLength: 1 }), operator: "contains" },
    userId: { schema: t.integer({ minimum: 1 }), operator: "equals" }
  }
});

export interface PostQueryDto {
  page?: number;
  pageSize?: number;
  titleContains?: string;
  userId?: number;
}

export const PostPagedResponseDto = createPagedResponseDtoClass({
  name: "PostPagedResponseDto",
  itemDto: PostDto,
  description: "Paged post list response."
});

export const PostErrors = Errors(SimpleErrorDto, [
  { status: 400, description: "Invalid post id." },
  { status: 404, description: "Post not found." }
]);
