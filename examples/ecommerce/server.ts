import { bootstrap } from "adorn-api/express";
import { ProductsController } from "./src/products.controller.js";
import { CartController } from "./src/cart.controller.js";
import { OrdersController } from "./src/orders.controller.js";

async function main() {
  await bootstrap({
    controllers: [ProductsController, CartController, OrdersController],
  });
}

main().catch(console.error);
