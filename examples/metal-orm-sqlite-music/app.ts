import { createExpressApp } from "../../src";
import { initializeDatabase } from "./db";
import { AlbumController } from "./album.controller";
import { ArtistController } from "./artist.controller";
import { TrackController } from "./track.controller";
import { startExampleServer } from "../utils/start-server";

export async function start() {
  await initializeDatabase();

  const app = createExpressApp({
    controllers: [ArtistController, AlbumController, TrackController],
    openApi: {
      info: { title: "Music Library API", version: "1.0.0" },
      docs: true
    }
  });
  startExampleServer(app, { name: "Music Library API" });
}
