# E-commerce API Example

This example demonstrates a realistic e-commerce API with both RESTful and non-RESTful endpoints.

## Sample Data

The API comes pre-populated with realistic sample data:

- **Products**: 20 products across various categories (laptops, monitors, accessories, office furniture, etc.) with different prices and stock levels
- **Carts**: 2 pre-populated carts for users 1 and 2
- **Orders**: 5 sample orders with different statuses (pending, processing, shipped, delivered, cancelled)
- **Coupons**: 8 valid coupon codes with varying discount types and minimum purchase requirements

## Features

### RESTful Endpoints
- **Products**: Full CRUD operations (`/products`)
- **Cart**: Get, add, update, remove items (`/cart/:userId`)
- **Orders**: Retrieve orders (`/orders`)

### Non-RESTful Endpoints

#### Products
- `POST /products/:id/publish` - Publish a draft product
- `POST /products/:id/archive` - Archive a published product
- `POST /products/search/advanced` - Advanced product search with filters

#### Cart
- `POST /cart/:userId/apply-coupon` - Apply a discount coupon code
- `POST /cart/:userId/checkout` - Process checkout and create an order

#### Orders
- `POST /orders/:orderId/cancel` - Cancel an existing order
- `POST /orders/:orderId/track` - Get tracking information for an order
- `POST /orders/sync` - Synchronize orders from external systems

## Running the Example

```bash
npm install
npm run dev
```

The API will be available at `http://localhost:3000`

## Example Requests

### Publish a Product (Non-RESTful)
```bash
curl -X POST http://localhost:3000/products/3/publish
```

### Apply Coupon to Cart (Non-RESTful)
```bash
# 10% discount (no minimum)
curl -X POST http://localhost:3000/cart/1/apply-coupon \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE10"}'

# 20% discount (minimum $100 purchase required)
curl -X POST http://localhost:3000/cart/1/apply-coupon \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE20"}'

# $50 flat discount
curl -X POST http://localhost:3000/cart/1/apply-coupon \
  -H "Content-Type: application/json" \
  -d '{"code": "FLAT50"}'

# $100 flat discount (minimum $500 purchase required)
curl -X POST http://localhost:3000/cart/1/apply-coupon \
  -H "Content-Type: application/json" \
  -d '{"code": "FLAT100"}'

# First order discount 15%
curl -X POST http://localhost:3000/cart/1/apply-coupon \
  -H "Content-Type: application/json" \
  -d '{"code": "FIRSTORDER"}'

# 25% summer discount
curl -X POST http://localhost:3000/cart/1/apply-coupon \
  -H "Content-Type: application/json" \
  -d '{"code": "SUMMER2024"}'

# Free order (100% off subtotal)
curl -X POST http://localhost:3000/cart/1/apply-coupon \
  -H "Content-Type: application/json" \
  -d '{"code": "FREE99"}'
```

### Process Checkout (Non-RESTful)
```bash
curl -X POST http://localhost:3000/cart/1/checkout \
  -H "Content-Type: application/json" \
  -d '{"shippingAddress": "123 Main St", "paymentMethod": "credit_card"}'
```

### Track Order (Non-RESTful)
```bash
# Track a delivered order
curl -X POST http://localhost:3000/orders/ORD-1735651200000-abc123/track

# Track a shipped order
curl -X POST http://localhost:3000/orders/ORD-1735737600000-def456/track

# Track a processing order
curl -X POST http://localhost:3000/orders/ORD-1735824000000-ghi789/track

# Track a pending order
curl -X POST http://localhost:3000/orders/ORD-1735910400000-jkl012/track
```

### View All Orders (Pre-populated Data)
```bash
# View all orders with different statuses
curl http://localhost:3000/orders
```

### Advanced Search (Non-RESTful)
```bash
# Search for products containing "wireless" between $0 and $100
curl -X POST http://localhost:3000/products/search/advanced \
  -H "Content-Type: application/json" \
  -d '{"query": "wireless", "minPrice": 0, "maxPrice": 100}'

# Search for products in stock only
curl -X POST http://localhost:3000/products/search/advanced \
  -H "Content-Type: application/json" \
  -d '{"inStockOnly": true}'

# Search for laptops over $1000
curl -X POST http://localhost:3000/products/search/advanced \
  -H "Content-Type: application/json" \
  -d '{"query": "laptop", "minPrice": 1000}'
```

### View Existing Cart (Pre-populated Data)
```bash
# User 1 has a pre-populated cart with a laptop and keyboard
curl http://localhost:3000/cart/1

# User 2 has a cart with headphones
curl http://localhost:3000/cart/2
```

## Notes

Non-RESTful endpoints are used when:
- The operation is a command/action rather than a resource manipulation
- Complex business logic needs to be encapsulated
- The action doesn't fit standard HTTP verb semantics
- The operation is domain-specific and meaningful in business context

Even though these endpoints don't follow strict REST principles, they are pragmatic and meaningful for real-world applications.
