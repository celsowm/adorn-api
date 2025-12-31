import { Controller, Get, Post } from "adorn-api";

interface Order {
  id: string;
  userId: number;
  items: Array<{ productId: number; productName: string; quantity: number; price: number }>;
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  shippingAddress: string;
  createdAt: string;
  updatedAt: string;
}

const orders: Order[] = [
  {
    id: "ORD-1735651200000-abc123",
    userId: 1,
    items: [
      { productId: 1, productName: "ProBook 15 Laptop", quantity: 1, price: 1299.99 },
      { productId: 2, productName: "Wireless Mouse", quantity: 2, price: 29.99 },
    ],
    total: 1359.97,
    status: "delivered",
    shippingAddress: "123 Main Street, New York, NY 10001",
    createdAt: "2024-12-30T10:00:00.000Z",
    updatedAt: "2024-12-31T15:30:00.000Z",
  },
  {
    id: "ORD-1735737600000-def456",
    userId: 2,
    items: [
      { productId: 3, productName: "Mechanical Keyboard", quantity: 1, price: 89.99 },
      { productId: 4, productName: "USB-C Hub", quantity: 1, price: 49.99 },
    ],
    total: 153.98,
    status: "shipped",
    shippingAddress: "456 Oak Avenue, Los Angeles, CA 90001",
    createdAt: "2024-12-31T08:00:00.000Z",
    updatedAt: "2025-01-02T14:20:00.000Z",
  },
  {
    id: "ORD-1735824000000-ghi789",
    userId: 1,
    items: [
      { productId: 5, productName: "27-inch Monitor", quantity: 2, price: 399.99 },
    ],
    total: 879.98,
    status: "processing",
    shippingAddress: "123 Main Street, New York, NY 10001",
    createdAt: "2025-01-01T09:00:00.000Z",
    updatedAt: "2025-01-01T11:30:00.000Z",
  },
  {
    id: "ORD-1735910400000-jkl012",
    userId: 3,
    items: [
      { productId: 6, productName: "Webcam HD", quantity: 1, price: 79.99 },
      { productId: 10, productName: "Smartphone Stand", quantity: 3, price: 19.99 },
    ],
    total: 139.96,
    status: "pending",
    shippingAddress: "789 Pine Street, Chicago, IL 60601",
    createdAt: "2025-01-02T10:00:00.000Z",
    updatedAt: "2025-01-02T10:00:00.000Z",
  },
  {
    id: "ORD-1735996800000-mno345",
    userId: 2,
    items: [
      { productId: 7, productName: "Standing Desk", quantity: 1, price: 599.99 },
    ],
    total: 659.99,
    status: "cancelled",
    shippingAddress: "456 Oak Avenue, Los Angeles, CA 90001",
    createdAt: "2025-01-03T07:00:00.000Z",
    updatedAt: "2025-01-03T16:45:00.000Z",
  },
];

@Controller("/orders")
export class OrdersController {
  @Get("/")
  async getOrders(): Promise<Order[]> {
    return orders;
  }

  @Get("/:orderId")
  async getOrder(orderId: string): Promise<Order | null> {
    return orders.find(o => o.id === orderId) || null;
  }

  @Post("/:orderId/cancel")
  async cancelOrder(orderId: string, body: { reason?: string }): Promise<{ success: boolean; message: string }> {
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return { success: false, message: "Order not found" };
    }

    if (order.status === "delivered") {
      return { success: false, message: "Cannot cancel a delivered order" };
    }

    if (order.status === "cancelled") {
      return { success: false, message: "Order is already cancelled" };
    }

    order.status = "cancelled";
    order.updatedAt = new Date().toISOString();
    
    return { 
      success: true, 
      message: body.reason 
        ? `Order cancelled. Reason: ${body.reason}` 
        : "Order cancelled successfully" 
    };
  }

  @Post("/:orderId/track")
  async trackOrder(orderId: string): Promise<{ 
    success: boolean; 
    status: string; 
    trackingInfo: { 
      location?: string; 
      estimatedDelivery?: string; 
      updates: Array<{ timestamp: string; status: string; message: string }> 
    } | null 
  }> {
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return { success: false, status: "", trackingInfo: null };
    }

    const updates: Array<{ timestamp: string; status: string; message: string }> = [
      { timestamp: order.createdAt, status: "pending", message: "Order placed" },
    ];

    if (order.status === "processing") {
      updates.push({ timestamp: order.updatedAt, status: "processing", message: "Order is being prepared" });
    } else if (order.status === "shipped") {
      updates.push({ timestamp: order.updatedAt, status: "processing", message: "Order is being prepared" });
      updates.push({ timestamp: order.updatedAt, status: "shipped", message: "Order has been shipped" });
    } else if (order.status === "delivered") {
      updates.push({ timestamp: order.updatedAt, status: "processing", message: "Order is being prepared" });
      updates.push({ timestamp: order.updatedAt, status: "shipped", message: "Order has been shipped" });
      updates.push({ timestamp: order.updatedAt, status: "delivered", message: "Order delivered successfully" });
    }

    return {
      success: true,
      status: order.status,
      trackingInfo: {
        location: order.status === "shipped" ? "Distribution Center" : order.status === "delivered" ? order.shippingAddress : undefined,
        estimatedDelivery: order.status !== "pending" ? "2-3 business days" : undefined,
        updates,
      }
    };
  }

  @Post("/sync")
  async syncOrders(body: { externalOrderIds: string[] }): Promise<{ 
    synced: number; 
    failed: string[]; 
    message: string 
  }> {
    const failed: string[] = [];
    let synced = 0;

    for (const externalId of body.externalOrderIds) {
      const existingOrder = orders.find(o => o.id === externalId);
      
      if (!existingOrder) {
        failed.push(externalId);
      } else {
        synced++;
      }
    }

    return {
      synced,
      failed,
      message: failed.length > 0 
        ? `Synced ${synced} orders, ${failed.length} not found` 
        : `All ${synced} orders synced successfully`
    };
  }
}
