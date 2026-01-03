import { Controller, Get, Post, Put, Delete, QueryStyle } from "adorn-api";
import { BlogPost, Category, Tag, User } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRef, eq, and, like } from "metal-orm";

type PostSearchWhere = {
  author?: { id?: number; email?: string };
  category?: { id?: number; slug?: string };
  tags?: { name?: string };
  comments?: { author?: { name?: string } };
  status?: { eq?: string };
};

@Controller("/blog-posts")
export class BlogPostsController {

  @Get("/")
  @QueryStyle({ style: "deepObject" })
  async getPosts(where?: PostSearchWhere): Promise<BlogPost[]> {

    const session = getSession();
    const P = entityRef(BlogPost);
    const U = entityRef(User);
    const C = entityRef(Category);
    const T = entityRef(Tag);
    let qb = selectFromEntity(BlogPost)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt");

    const conditions = [];

    qb = qb.include({
      author: true,
      category: true,
      tags: true,
      comments: { include: { author: true } }
    });

    const authorEmail = where?.author?.email;
    if (authorEmail) {
      qb = qb.whereHas("author", authorQb =>
        authorQb.where(eq(U.email, authorEmail))
      );
    }

    const categorySlug = where?.category?.slug;
    if (categorySlug) {
      qb = qb.whereHas("category", categoryQb =>
        categoryQb.where(eq(C.slug, categorySlug))
      );
    }

    const tagName = where?.tags?.name;
    if (tagName) {
      qb = qb.whereHas("tags", tagQb =>
        tagQb.where(eq(T.$.name, tagName))
      );
    }

    const commentAuthorName = where?.comments?.author?.name;
    if (commentAuthorName) {
      const nameFilter = commentAuthorName.trim();
      const pattern = nameFilter.includes("%")
        ? nameFilter
        : `%${nameFilter}%`;
      qb = qb.whereHas("comments", commentQb =>
        commentQb.whereHas("author", authorQb =>
          authorQb.where(like(U.$.name, pattern))
        )
      );
    }

    if (where?.author?.id !== undefined) {
      conditions.push(eq(P.authorId, Number(where.author.id)));
    }
    if (where?.category?.id !== undefined) {
      conditions.push(eq(P.categoryId, Number(where.category.id)));
    }
    if (where?.status?.eq) {
      conditions.push(eq(P.status, where.status.eq));
    }

    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    const posts = await qb.execute(session);
    return posts;

  }

  @Get("/:id")
  async getPost(id: number): Promise<BlogPost | null> {

    const session = getSession();
    const P = entityRef(BlogPost);
    const posts = await selectFromEntity(BlogPost)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt")
      .where(eq(P.id, id))
      .execute(session);
    return posts[0] ?? null;

  }

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
