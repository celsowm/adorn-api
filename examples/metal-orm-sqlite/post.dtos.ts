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
import { Post } from "./post.entity";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

const POST_DTO_OVERRIDES = {
  id: t.integer({ description: "Post id." }),
  title: t.string({ minLength: 1 }),
  body: t.nullable(t.string()),
  userId: t.integer({ description: "User id." }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

export interface PostDto extends Omit<Post, "user"> {}

@MetalDto(Post, {
  description: "Post returned by the API.",
  overrides: POST_DTO_OVERRIDES
})
export class PostDto {
  declare id: number;
  declare title: string;
  declare body?: string | null;
  declare userId: number;
  declare createdAt: string;
}

const POST_MUTATION_KEYS: Array<keyof PostDto> = ["id", "createdAt"];
type PostMutationDto = Omit<PostDto, (typeof POST_MUTATION_KEYS)[number]>;

export interface CreatePostDto extends PostMutationDto {}

@OmitDto(PostDto, POST_MUTATION_KEYS)
export class CreatePostDto {
  declare title: string;
  declare body?: string | null;
  declare userId: number;
}

export interface ReplacePostDto extends PostMutationDto {}

@OmitDto(PostDto, POST_MUTATION_KEYS)
export class ReplacePostDto {
  declare title: string;
  declare body?: string | null;
  declare userId: number;
}

export interface UpdatePostDto extends Partial<PostMutationDto> {}

@PartialDto(ReplacePostDto)
export class UpdatePostDto {
  declare title?: string;
  declare body?: string | null;
  declare userId?: number;
}

export interface PostParamsDto extends Pick<PostDto, "id"> {}

@PickDto(PostDto, ["id"])
export class PostParamsDto {
  declare id: number;
}

const USER_POST_MUTATION_KEYS: Array<keyof PostDto> = [
  ...POST_MUTATION_KEYS,
  "userId"
];
type UserPostMutationDto = Omit<PostDto, (typeof USER_POST_MUTATION_KEYS)[number]>;

export interface CreateUserPostDto extends UserPostMutationDto {}

@OmitDto(PostDto, USER_POST_MUTATION_KEYS)
export class CreateUserPostDto {
  declare title: string;
  declare body?: string | null;
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

@Dto()
class PostListItemsDto {
  @Field(t.array(t.ref(PostDto)))
  items!: PostDto[];
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

@MergeDto([PostListItemsDto, PagedResponseMetaDto], {
  description: "Paged post list response."
})
export class PostPagedResponseDto {}

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const PostErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid post id." },
  { status: 404, description: "Post not found." }
]);
