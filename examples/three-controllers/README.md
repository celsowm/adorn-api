# Three Controllers Example

This example demonstrates how to use multiple controllers with adorn-api, showcasing a simple blog application with Users, Posts, and Comments resources.

## Features

- **UsersController**: Manage users (GET, POST, DELETE)
- **PostsController**: Manage blog posts (GET, POST, PUT, DELETE)
- **CommentsController**: Manage comments on posts (GET, POST)

## Available Endpoints

### Users
- `GET /users/` - Get all users
- `GET /users/:id` - Get a specific user
- `POST /users/` - Create a new user
- `DELETE /users/:id` - Delete a user

### Posts
- `GET /posts/` - Get all posts
- `GET /posts/:id` - Get a specific post
- `POST /posts/` - Create a new post
- `PUT /posts/:id` - Update a post
- `DELETE /posts/:id` - Delete a post

### Comments
- `GET /comments/` - Get all comments (optionally filter by postId)
- `GET /comments/:id` - Get a specific comment
- `POST /comments/` - Create a new comment

## Running the Example

```bash
npm run example -- three-controllers
```

The server will start at http://localhost:3000 and Swagger UI documentation will be available at http://localhost:3000/docs
