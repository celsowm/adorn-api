import { Controller, Get, Post } from "adorn-api";

interface Comment {
  id: number;
  content: string;
  postId: number;
  userId: number;
  createdAt: string;
}

const comments: Comment[] = [
  { id: 1, content: "Great post!", postId: 1, userId: 2, createdAt: new Date().toISOString() },
  { id: 2, content: "Thanks for sharing", postId: 1, userId: 1, createdAt: new Date().toISOString() },
];

@Controller("/comments")
export class CommentsController {
  @Get("/")
  async getComments(): Promise<Comment[]> {
    return comments;
  }

  @Get("/:id")
  async getComment(id: number): Promise<Comment | null> {
    return comments.find((c) => c.id === Number(id)) || null;
  }

  @Post("/")
  async createComment(body: { content: string; postId: number; userId: number }): Promise<Comment> {
    const newComment: Comment = {
      id: comments.length + 1,
      content: body.content,
      postId: body.postId,
      userId: body.userId,
      createdAt: new Date().toISOString(),
    };
    comments.push(newComment);
    return newComment;
  }
}
