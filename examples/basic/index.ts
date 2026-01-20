import { createApp } from "./app";
import { startExampleServer } from "../utils/start-server";

const app = createApp();

startExampleServer(app, { name: "Adorn API" });
