import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`DeckForge API rodando em http://localhost:${env.port}`);
});
