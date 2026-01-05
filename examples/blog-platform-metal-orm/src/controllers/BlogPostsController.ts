import { Controller, Get, Post, Put, Delete } from "adorn-api";
import type { SearchWhere, ListQuery } from "adorn-api/metal";
import { pagedOptions, parseSort } from "adorn-api/metal";
import type { PaginatedResult } from "metal-orm";
import { BlogPost, Category, Tag, User } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRefs, eq, and, like, columnOperand, aliasRef } from "metal-orm";

type PostWhere = SearchWhere<BlogPost, {
  include: [
    "status",
    "title",
    "author.id",
    "author.email",
    "author.name",
    "category.id",
    "category.slug",
    "tags.name",
    "comments.author.name"
  ];
}>;

type PostListQuery =
  Omit<ListQuery<BlogPost>, "where"> & {
    where?: PostWhere;
  };

@Controller("/blog-posts")
export class BlogPostsController {

  /**
   * List blog posts with pagination, filtering and sorting
   * @example GET /blog-posts?page=1&pageSize=10
   * @example GET /blog-posts?sort=-createdAt
   * @example GET /blog-posts?sort=author.name
   * @example GET /blog-posts?sort=-publishedAt,title
   * @example GET /blog-posts?where[author][id]=1
   * @example GET /blog-posts?where[category][id]=2&page=2
   * @example GET /blog-posts?where[author][name]=Bob
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

    const where = query?.where ?? (query as any);

    if (where?.author?.id !== undefined) {
      conditions.push(eq(P.authorId, Number(where.author.id)));
    }
    if (where?.author?.name !== undefined) {
      qb = qb.whereHas("author", (authorQb) =>
        authorQb.where(eq(U.$.name, where.author.name))
      );
    }
    if (where?.author?.email !== undefined) {
      qb = qb.whereHas("author", (authorQb) =>
        authorQb.where(eq(U.$.email, where.author.email))
      );
    }
    if (where?.category?.id !== undefined) {
      conditions.push(eq(P.categoryId, Number(where.category.id)));
    }
    if (where?.category?.slug !== undefined) {
      qb = qb.whereHas("category", (categoryQb) =>
        categoryQb.where(eq(C.$.slug, where.category.slug))
      );
    }
    if (where?.status !== undefined) {
      conditions.push(eq(P.status, where.status));
    }
    if (where?.title !== undefined) {
      conditions.push(eq(P.title, where.title));
    }
    if (where?.tags?.name !== undefined) {
      qb = qb.whereHas("tags", (tagsQb) =>
        tagsQb.where(eq(T.$.name, where.tags.name))
      );
    }
    if (where?.comments?.author?.name !== undefined) {
      qb = qb.whereHas("comments", (commentsQb) =>
        commentsQb.whereHas("author", (commentAuthorQb) =>
          commentAuthorQb.where(eq(U.$.name, where.comments.author.name))
        )
      );
    }
    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    const isTitle = query?.sort === 'title';
    const col = (P.$ as Record<string, any>)[isTitle ? 'title' : 'createdAt'];
    qb = qb.orderBy(col, isTitle ? 'ASC' : 'DESC');

    return qb.executePaged(session, pagedOptions(query));
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
