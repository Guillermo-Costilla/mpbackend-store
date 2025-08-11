import { createClient } from "@libsql/client"
import { config } from "./config.js"

const client = createClient({
  url: config.database.url,
  authToken: config.database.authToken,
})

export default client
