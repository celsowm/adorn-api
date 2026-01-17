import { createApp } from "./app";

const app = createApp();

app.listen(3000, () => {
  console.log("Adorn API running on http://localhost:3000");
});
