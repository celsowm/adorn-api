import { Controller, Get, Post, Put, Delete } from "adorn-api";
import type { SearchWhere, ListQuery } from "adorn-api/metal";
import { applyListQuery } from "adorn-api/metal";
import type { PaginatedResult } from "metal-orm";
import { BlogPost, Category, Tag, User } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRefs, eq, and, like } from "metal-orm";

type PostWhere = SearchWhere<BlogPost, {
  include: [
    "status",
    "author.id",
    "author.email",
    "category.id",
    "category.slug",
    "tags.name",
    "comments.author.name"
  ];
}>;

type PostListQuery =
  Omit<ListQuery<BlogPost>, "where"> & {
    where?: PostWhere;
    q?: string;
    hasComments?: boolean;
  };

@Controller("/blog-posts")
export class BlogPostsController {

  /**
   * List blog posts with pagination and filtering
   * @example GET /blog-posts?page=1&pageSize=10
   * @example GET /blog-posts?where[author][id]=1
   * @example GET /blog-posts?where[category][id]=2&page=2
   */
  @Get("/")
  async getPosts(query: PostListQuery): Promise<PaginatedResult<BlogPost>> {
    const session = getSession();
    const [P, U, C, T] = entityRefs(BlogPost, User, Category, Tag);
    let qb = selectFromEntity(BlogPost)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt");

    qb = qb.include({
      author: true,
      category: true,
      tags: true,
      comments: { include: { author: true } }
    });

    const conditions = [];

    if (query?.where?.author?.id !== undefined) {
      conditions.push(eq(P.authorId, Number(query.where.author.id)));
    }
    if (query?.where?.category?.id !== undefined) {
      conditions.push(eq(P.categoryId, Number(query.where.category.id)));
    }
    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 10;
    return qb.executePaged(session, { page, pageSize });
  }

  /**
   * Get a single blog post by ID
   * @example GET /blog-posts/1
   * @example GET /blog-posts/42
   */
  @Get("/:id")
  async getPost(id: number): Promise<BlogPost | null> {

    const session = getSession();
    const [P] = entityRefs(BlogPost);
    const posts = await selectFromEntity(BlogPost)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt")
      .where(eq(P.id, id))
      .execute(session);
    return posts[0] ?? null;

  }

  /**
   * Create a new blog post
   * @example POST /blog-posts with body: { "title": "My First Post", "content": "Hello world", "authorId": 1, "categoryId": 1 }
   */
  @Post("/")
  async createPost(
    body: Pick<BlogPost, "title" | "content" | "authorId" | "categoryId">
  ): Promise<BlogPost> {

    const session = getSession();
    const post = await session.saveGraphAndFlush(
      BlogPost,
      {
        ...body,
        status: "draft",
        createdAt: new Date()
      }
    );
    return post;

  }

  /**
   * Update an existing blog post
   * @example PUT /blog-posts/1 with body: { "title": "Updated Title", "status": "published" }
   * @example PUT /blog-posts/42 with body: { "publishedAt": "2025-01-05T00:00:00Z" }
   */
  @Put("/:id")
  async updatePost(
    id: number,
    body: Pick<BlogPost, "title" | "content" | "status" | "categoryId" | "publishedAt">
  ): Promise<BlogPost | null> {

    const session = getSession();
    const post = await session.updateGraph(
      BlogPost,
      { id, ...body }
    );
    return post;

  }

  /**
   * Delete a blog post
   * @example DELETE /blog-posts/1
   * @example DELETE /blog-posts/42
   */
  @Delete("/:id")
  async deletePost(id: number): Promise<{ success: boolean }> {

    const session = getSession();
    const post = await session.find(BlogPost, id);
    if (post) {
      await session.remove(post);
      await session.flush();
    }
    return { success: true };

  }
}
