import { Controller, Get, Post, Put, Delete } from "adorn-api";

interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
  createdAt: string;
}

const posts: Post[] = [
  { id: 1, title: "First Post", content: "Hello World", authorId: 1, createdAt: new Date().toISOString() },
  { id: 2, title: "Second Post", content: "Another day", authorId: 2, createdAt: new Date().toISOString() },
];

@Controller("/posts")
export class PostsController {
  @Get("/")
  async getPosts(): Promise<Post[]> {
    return posts;
  }

  @Get("/:id")
  async getPost(id: number): Promise<Post | null> {
    return posts.find((p) => p.id === Number(id)) || null;
  }

  @Post("/")
  async createPost(body: { title: string; content: string; authorId: number }): Promise<Post> {
    const newPost: Post = {
      id: posts.length + 1,
      title: body.title,
      content: body.content,
      authorId: body.authorId,
      createdAt: new Date().toISOString(),
    };
    posts.push(newPost);
    return newPost;
  }

  @Put("/:id")
  async updatePost(id: number, body: { title?: string; content?: string }): Promise<Post | null> {
    const post = posts.find((p) => p.id === Number(id));
    if (post) {
      if (body.title) post.title = body.title;
      if (body.content) post.content = body.content;
      return post;
    }
    return null;
  }

  @Delete("/:id")
  async deletePost(id: number): Promise<{ success: boolean }> {
    const index = posts.findIndex((p) => p.id === Number(id));
    if (index !== -1) {
      posts.splice(index, 1);
      return { success: true };
    }
    return { success: false };
  }
}
