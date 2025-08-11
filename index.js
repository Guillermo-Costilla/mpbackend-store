import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"

// Rutas activas
import userRoutes from "./routes/user-routes.js"
import productRoutes from "./routes/product-routes.js"
import orderRoutes from "./routes/order-routes.js"
import paymentRoutes from "./routes/payment-routes.js"
import favoritosRoutes from "./routes/favoritos-routes.js"
import adminRoutes from "./routes/admin-routes.js"

// Controlador MP para el webhook
import { paymentController } from "./controllers/payment-controller.js"

const app = express()

// Webhook de Mercado Pago (ANTES de cualquier parser JSON)
app.post("/api/payments/webhook/mercadopago", express.raw({ type: "*/*" }), paymentController.webhookMP)

// Middlewares de seguridad
app.use(helmet())

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)
app.set("trust proxy", 1)

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })
app.use(limiter)

// Parsers
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Salud y diagnóstico
app.get("/", (req, res) => {
  res.json({
    message: "API de Tienda con Mercado Pago",
    version: "MP-1.0.0",
    status: "OK",
    timestamp: new Date().toISOString(),
  })
})

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || "development" })
})

app.get("/diagnostic", (req, res) => {
  const envVars = {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ? "✅" : "❌",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "✅" : "❌",
    JWT_SECRET: process.env.JWT_SECRET ? "✅" : "❌",
    MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN ? "✅" : "❌",
    MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY ? "✅" : "❌",
    MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET ? "✅" : "❌",
  }
  res.json({ success: true, environment: envVars, timestamp: new Date().toISOString() })
})

// Rutas API activas
app.use("/api/users", userRoutes)
app.use("/api/products", productRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/favoritos", favoritosRoutes)
app.use("/api/admin", adminRoutes)

// 404
app.use("*", (req, res) => res.status(404).json({ message: "Ruta no encontrada" }))

// Error global
app.use((err, req, res, next) => {
  console.error("❌ Error del servidor:", err)
  res.status(500).json({
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === "development" ? err.message : "Error interno",
  })
})

export default app
