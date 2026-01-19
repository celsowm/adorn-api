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

export type PostDto = Omit<Post, "user">;
type PostMutationDto = Omit<PostDto, "id" | "createdAt">;
export type CreatePostDto = PostMutationDto;
export type ReplacePostDto = PostMutationDto;
export type UpdatePostDto = Partial<PostMutationDto>;
export type PostParamsDto = Pick<PostDto, "id">;

export const {
  response: PostDto,
  create: CreatePostDto,
  replace: ReplacePostDto,
  update: UpdatePostDto,
  params: PostParamsDto
} = postCrud;

export const CreateUserPostDto = createNestedCreateDtoClass(
  Post,
  POST_DTO_OVERRIDES,
  {
    name: "CreateUserPostDto",
    additionalExclude: ["userId"]
  }
);

export const PostQueryDto = createPagedFilterQueryDtoClass({
  name: "PostQueryDto",
  filters: {
    titleContains: { schema: t.string({ minLength: 1 }), operator: "contains" },
    userId: { schema: t.integer({ minimum: 1 }), operator: "equals" }
  }
});

export const PostPagedResponseDto = createPagedResponseDtoClass({
  name: "PostPagedResponseDto",
  itemDto: PostDto,
  description: "Paged post list response."
});

export const PostErrors = Errors(SimpleErrorDto, [
  { status: 400, description: "Invalid post id." },
  { status: 404, description: "Post not found." }
]);

export type PostQueryDto = typeof PostQueryDto;
