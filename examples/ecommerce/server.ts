import { bootstrap } from "adorn-api/express";
import { ProductsController } from "./src/products.controller.js";
import { CartController } from "./src/cart.controller.js";
import { OrdersController } from "./src/orders.controller.js";

async function main() {
  try {
    const result = await bootstrap({
      controllers: [ProductsController, CartController, OrdersController],
    });

    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await result.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down...');
      await result.close();
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

main();
