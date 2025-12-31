import { Controller, Get, Post, Put, Delete } from "adorn-api";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  status: "draft" | "published" | "archived";
}

const products: Product[] = [
  { id: 1, name: "ProBook 15 Laptop", description: "15.6-inch laptop with Intel i7, 16GB RAM, 512GB SSD", price: 1299.99, stock: 45, status: "published" },
  { id: 2, name: "Wireless Mouse", description: "Ergonomic wireless mouse with precision tracking", price: 29.99, stock: 150, status: "published" },
  { id: 3, name: "Mechanical Keyboard", description: "RGB backlit mechanical keyboard with Cherry MX switches", price: 89.99, stock: 75, status: "published" },
  { id: 4, name: "USB-C Hub", description: "7-in-1 USB-C hub with HDMI, USB 3.0 ports", price: 49.99, stock: 200, status: "published" },
  { id: 5, name: "27-inch Monitor", description: "4K UHD monitor with HDR support", price: 399.99, stock: 30, status: "published" },
  { id: 6, name: "Webcam HD", description: "1080p HD webcam with built-in microphone", price: 79.99, stock: 85, status: "published" },
  { id: 7, name: "Standing Desk", description: "Electric height-adjustable standing desk", price: 599.99, stock: 20, status: "published" },
  { id: 8, name: "Ergonomic Chair", description: "Mesh ergonomic office chair with lumbar support", price: 349.99, stock: 40, status: "published" },
  { id: 9, name: "Noise-Canceling Headphones", description: "Premium wireless headphones with active noise cancellation", price: 249.99, stock: 60, status: "published" },
  { id: 10, name: "Smartphone Stand", description: "Adjustable aluminum phone stand for desk", price: 19.99, stock: 300, status: "published" },
  { id: 11, name: "Wireless Charger", description: "Fast wireless charging pad compatible with Qi devices", price: 39.99, stock: 120, status: "published" },
  { id: 12, name: "Portable SSD 1TB", description: "Ultra-portable external SSD with USB 3.2", price: 159.99, stock: 65, status: "published" },
  { id: 13, name: "Gaming Mouse Pad", description: "Extra-large RGB gaming mouse pad", price: 24.99, stock: 180, status: "published" },
  { id: 14, name: "Cable Management Kit", description: "Velcro cable ties and organizers", price: 14.99, stock: 250, status: "published" },
  { id: 15, name: "Desk Lamp LED", description: "Adjustable LED desk lamp with USB charging port", price: 44.99, stock: 90, status: "published" },
  { id: 16, name: "4K Webcam Pro", description: "Professional 4K webcam with auto-focus", price: 199.99, stock: 35, status: "draft" },
  { id: 17, name: "Tablet Stand Pro", description: "Premium aluminum tablet and laptop stand", price: 69.99, stock: 50, status: "draft" },
  { id: 18, name: "Wireless Earbuds", description: "True wireless earbuds with noise isolation", price: 129.99, stock: 100, status: "draft" },
  { id: 19, name: "Old Keyboard Model", description: "Legacy keyboard model - discontinued", price: 49.99, stock: 0, status: "archived" },
  { id: 20, name: "Vintage Monitor 24", description: "Outdated monitor model - no longer available", price: 199.99, stock: 0, status: "archived" },
];

@Controller("/products")
export class ProductsController {
  @Get("/")
  async getProducts(): Promise<Product[]> {
    return products.filter(p => p.status === "published");
  }

  @Get("/:id")
  async getProduct(id: number): Promise<Product | null> {
    return products.find(p => p.id === Number(id)) || null;
  }

  @Post("/")
  async createProduct(body: { name: string; description: string; price: number; stock: number }): Promise<Product> {
    const newProduct: Product = {
      id: products.length + 1,
      name: body.name,
      description: body.description,
      price: body.price,
      stock: body.stock,
      status: "draft",
    };
    products.push(newProduct);
    return newProduct;
  }

  @Put("/:id")
  async updateProduct(id: number, body: Partial<{ name: string; description: string; price: number; stock: number }>): Promise<Product | null> {
    const product = products.find(p => p.id === Number(id));
    if (product) {
      Object.assign(product, body);
      return product;
    }
    return null;
  }

  @Delete("/:id")
  async deleteProduct(id: number): Promise<{ success: boolean }> {
    const index = products.findIndex(p => p.id === Number(id));
    if (index !== -1) {
      products.splice(index, 1);
      return { success: true };
    }
    return { success: false };
  }

  @Post("/:id/publish")
  async publishProduct(id: number): Promise<{ success: boolean; message: string }> {
    const product = products.find(p => p.id === Number(id));
    if (product) {
      product.status = "published";
      return { success: true, message: `Product ${product.name} has been published` };
    }
    return { success: false, message: "Product not found" };
  }

  @Post("/:id/archive")
  async archiveProduct(id: number): Promise<{ success: boolean; message: string }> {
    const product = products.find(p => p.id === Number(id));
    if (product) {
      product.status = "archived";
      return { success: true, message: `Product ${product.name} has been archived` };
    }
    return { success: false, message: "Product not found" };
  }

  @Post("/search/advanced")
  async advancedSearch(body: { query?: string; minPrice?: number; maxPrice?: number; inStockOnly?: boolean }): Promise<Product[]> {
    let results = [...products];

    if (body.query) {
      const lowerQuery = body.query.toLowerCase();
      results = results.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || 
        p.description.toLowerCase().includes(lowerQuery)
      );
    }

    if (body.minPrice !== undefined) {
      results = results.filter(p => p.price >= body.minPrice!);
    }

    if (body.maxPrice !== undefined) {
      results = results.filter(p => p.price <= body.maxPrice!);
    }

    if (body.inStockOnly) {
      results = results.filter(p => p.stock > 0);
    }

    return results.filter(p => p.status === "published");
  }
}
