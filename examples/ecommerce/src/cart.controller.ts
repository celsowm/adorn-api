import { Controller, Get, Post, Put, Delete } from "adorn-api";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
}

interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
}

let carts = new Map<number, Cart>();

 carts.set(1, {
  items: [
    { productId: 1, productName: "ProBook 15 Laptop", quantity: 1, price: 1299.99 },
    { productId: 3, productName: "Mechanical Keyboard", quantity: 1, price: 89.99 },
  ],
  subtotal: 1389.98,
  tax: 138.998,
  total: 1528.978,
  discount: 0,
});

carts.set(2, {
  items: [
    { productId: 9, productName: "Noise-Canceling Headphones", quantity: 2, price: 249.99 },
  ],
  subtotal: 499.98,
  tax: 49.998,
  total: 549.978,
  discount: 0,
});

function getCart(userId: number): Cart {
  if (!carts.has(userId)) {
    carts.set(userId, {
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      discount: 0,
    });
  }
  return carts.get(userId)!;
}

function calculateCartTotals(cart: Cart): void {
  cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cart.tax = cart.subtotal * 0.1;
  cart.total = cart.subtotal + cart.tax - cart.discount;
}

@Controller("/cart")
export class CartController {
  @Get("/:userId")
  async getCart(userId: number): Promise<Cart> {
    return getCart(userId);
  }

  @Post("/:userId/items")
  async addItem(userId: number, body: { productId: number; productName: string; price: number; quantity: number }): Promise<Cart> {
    const cart = getCart(userId);
    const existingItem = cart.items.find(item => item.productId === body.productId);
    
    if (existingItem) {
      existingItem.quantity += body.quantity;
    } else {
      cart.items.push({
        productId: body.productId,
        productName: body.productName,
        price: body.price,
        quantity: body.quantity,
      });
    }
    
    calculateCartTotals(cart);
    return cart;
  }

  @Put("/:userId/items/:productId")
  async updateItemQuantity(userId: number, productId: number, body: { quantity: number }): Promise<Cart | null> {
    const cart = getCart(userId);
    const item = cart.items.find(item => item.productId === Number(productId));
    
    if (item) {
      item.quantity = body.quantity;
      calculateCartTotals(cart);
      return cart;
    }
    return null;
  }

  @Delete("/:userId/items/:productId")
  async removeItem(userId: number, productId: number): Promise<Cart> {
    const cart = getCart(userId);
    cart.items = cart.items.filter(item => item.productId !== Number(productId));
    calculateCartTotals(cart);
    return cart;
  }

  @Post("/:userId/apply-coupon")
  async applyCoupon(userId: number, body: { code: string }): Promise<{ success: boolean; message: string; discount: number }> {
    const cart = getCart(userId);
    
    const validCoupons: Record<string, { discount: number; percentage: boolean; minPurchase?: number }> = {
      "SAVE10": { discount: 10, percentage: true },
      "SAVE20": { discount: 20, percentage: true, minPurchase: 100 },
      "SAVE30": { discount: 30, percentage: true, minPurchase: 500 },
      "FLAT50": { discount: 50, percentage: false },
      "FLAT100": { discount: 100, percentage: false, minPurchase: 500 },
      "FIRSTORDER": { discount: 15, percentage: true },
      "SUMMER2024": { discount: 25, percentage: true },
      "FREE99": { discount: 100, percentage: false },
    };

    const coupon = validCoupons[body.code.toUpperCase()];
    
    if (coupon) {
      if (coupon.minPurchase && cart.subtotal < coupon.minPurchase) {
        return { 
          success: false, 
          message: `Minimum purchase of $${coupon.minPurchase} required for this coupon`, 
          discount: 0 
        };
      }
      
      cart.discount = coupon.percentage ? cart.subtotal * (coupon.discount / 100) : coupon.discount;
      calculateCartTotals(cart);
      return { 
        success: true, 
        message: `Coupon ${body.code} applied successfully`, 
        discount: cart.discount 
      };
    }
    
    return { success: false, message: "Invalid coupon code", discount: 0 };
  }

  @Post("/:userId/checkout")
  async processCheckout(userId: number, body: { shippingAddress: string; paymentMethod: string }): Promise<{ success: boolean; orderId: string; message: string }> {
    const cart = getCart(userId);
    
    if (cart.items.length === 0) {
      return { success: false, orderId: "", message: "Cart is empty" };
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    carts.delete(userId);
    
    return {
      success: true,
      orderId,
      message: `Order placed successfully! Items will be shipped to ${body.shippingAddress}`
    };
  }

  @Delete("/:userId")
  async clearCart(userId: number): Promise<{ success: boolean; message: string }> {
    const cart = getCart(userId);
    cart.items = [];
    cart.subtotal = 0;
    cart.tax = 0;
    cart.total = 0;
    cart.discount = 0;
    
    return { success: true, message: "Cart cleared successfully" };
  }
}
