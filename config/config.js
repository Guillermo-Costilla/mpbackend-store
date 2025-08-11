import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Cargar .env desde la raíz del proyecto
dotenv.config({ path: join(__dirname, "../.env") })

// Validar variables de entorno críticas en producción
const requiredEnvVars = {
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  JWT_SECRET: process.env.JWT_SECRET,
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
}

if (process.env.NODE_ENV === "production") {
  const missing = Object.entries(requiredEnvVars)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    console.error("❌ Variables de entorno faltantes:", missing)
    console.error("⚠️  Configúralas en tu proveedor (p. ej. Vercel)")
  }
}

export const config = {
  database: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "fallback-secret-for-development",
  },
  server: {
    port: process.env.PORT || 5000,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  },
  email: {
    authUser: process.env.EMAIL_AUTH_USER,
    authPass: process.env.EMAIL_AUTH_PASS,
  },
  mercadopago: {
    accessToken: process.env.MP_ACCESS_TOKEN || "",
    publicKey: process.env.MP_PUBLIC_KEY || "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET || "",
  },
}
