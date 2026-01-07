import { Controller, Get } from "adorn-api";

interface User {
  id: number;
  name: string;
  email: string;
}

interface Category {
  id: number;
  slug: string;
  name: string;
}

type PostWhere = {
  status?: string;
  title?: string;
  author?: {
    id?: number;
    name?: string;
    email?: string;
  };
  category?: {
    id?: number;
    slug?: string;
  };
  comments?: {
    author?: {
      name?: string;
    };
  };
};

interface PostListQuery {
  where?: PostWhere;
  page?: number;
  pageSize?: number;
  sort?: string | string[];
}

interface BlogPost {
  id: number;
  title: string;
  status: string;
  authorId: number;
  categoryId?: number;
}

interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
}

@Controller("/blog-posts")
export class BlogPostsController {
  private posts: BlogPost[] = [
    { id: 1, title: "First Post", status: "published", authorId: 1, categoryId: 1 },
    { id: 2, title: "Second Post", status: "draft", authorId: 2, categoryId: 1 },
    { id: 3, title: "Third Post", status: "published", authorId: 1, categoryId: 2 },
  ];

  private users: User[] = [
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
  ];

  private categories: Category[] = [
    { id: 1, slug: "tech", name: "Technology" },
    { id: 2, slug: "news", name: "News" },
  ];

  /**
   * List blog posts with pagination, filtering and sorting
   * @example GET /blog-posts?page=1&pageSize=10
   * @example GET /blog-posts?sort=-createdAt
   * @example GET /blog-posts?where[author][id]=1
   * @example GET /blog-posts?where[category][id]=2&page=2
   * @example GET /blog-posts?where[author][name]=Alice
   * @example GET /blog-posts?where[comments][author][name]=Bob
   */
  @Get("/")
  async getPosts(query: PostListQuery): Promise<PaginatedResult<BlogPost>> {
    let filteredPosts = [...this.posts];

    if (query?.where?.author?.id !== undefined) {
      filteredPosts = filteredPosts.filter(p => p.authorId === Number(query.where!.author!.id));
    }
    if (query?.where?.author?.name !== undefined) {
      const user = this.users.find(u => u.name === query.where!.author!.name);
      if (user) {
        filteredPosts = filteredPosts.filter(p => p.authorId === user.id);
      }
    }
    if (query?.where?.category?.id !== undefined) {
      filteredPosts = filteredPosts.filter(p => p.categoryId === Number(query.where!.category!.id));
    }
    if (query?.where?.category?.slug !== undefined) {
      const category = this.categories.find(c => c.slug === query.where!.category!.slug);
      if (category) {
        filteredPosts = filteredPosts.filter(p => p.categoryId === category.id);
      }
    }
    if (query?.where?.status !== undefined) {
      filteredPosts = filteredPosts.filter(p => p.status === query.where!.status);
    }
    if (query?.where?.title !== undefined) {
      filteredPosts = filteredPosts.filter(p => p.title === query.where!.title);
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = filteredPosts.slice(start, end);

    return {
      items,
      page,
      pageSize,
      totalItems: filteredPosts.length,
    };
  }
}
