import { mp } from "../lib/axios-mp.js"
import client from "../config/database.js"
import { config } from "../config/config.js"
import crypto from "crypto"
import { randomUUID } from "crypto"

// Resolver base URL para back_urls y notification_url
function resolveBaseUrl(req) {
  if (config.server.publicBaseUrl) return config.server.publicBaseUrl
  const host = req.get("host")
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http"
  return `${proto}://${host}`
}

// Validación X-Signature Mercado Pago (HTTP v2)
// x-signature: ts=<timestamp>,v1=<hmac-sha256>
// string a firmar (comúnmente documentado):
//   id:<data.id>;request-id:<x-request-id>;ts:<ts>
function verifyMPSignature(req) {
  const secret = config.mercadopago.webhookSecret
  if (!secret) return { ok: true, reason: "no-secret-configured" }

  const sigHeader = req.headers["x-signature"]
  const requestId = req.headers["x-request-id"]
  const dataId = req.query["data.id"] || req.query.id || ""
  if (!sigHeader || !requestId || !dataId) return { ok: false, reason: "missing-header-or-id" }

  const parts = String(sigHeader)
    .split(",")
    .map((p) => p.trim())
    .reduce(
      (acc, p) => {
        const [k, v] = p.split("=")
        acc[k] = v
        return acc
      },
      /** @type {Record<string,string>} */ ({}),
    )

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return { ok: false, reason: "invalid-signature-format" }

  const dataToSign = `id:${dataId};request-id:${requestId};ts:${ts}`
  const computed = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex")

  // Comparación en tiempo constante
  const ok =
    computed.length === v1.length && crypto.timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(v1, "utf8"))

  return { ok, reason: ok ? "valid" : "mismatch" }
}

export const paymentController = {
  // Crea preferencia de Mercado Pago y vincula/crea la orden
  async createPreference(req, res) {
    try {
      const { items = [], currency = "ARS", customer = {}, shipping = {}, order_id } = req.body
      const usuario_id = req.user?.id || null
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: "Debe incluir al menos un producto", code: "NO_PRODUCTS" })
      }

      // Validar/armar items desde BD
      let total = 0
      const detalle = []
      const mpItems = []
      for (const it of items) {
        const r = await client.execute({ sql: "SELECT * FROM productos WHERE id = ?", args: [it.id] })
        const p = r.rows[0]
        if (!p)
          return res
            .status(404)
            .json({ success: false, error: `Producto ${it.id} no encontrado`, code: "PRODUCT_NOT_FOUND" })
        if (Number(p.stock) < Number(it.quantity)) {
          return res
            .status(400)
            .json({ success: false, error: `Stock insuficiente para ${p.nombre}`, code: "INSUFFICIENT_STOCK" })
        }
        const unit = Number(p.precio)
        const qty = Number(it.quantity)
        total += unit * qty
        detalle.push({ id: p.id, nombre: p.nombre, precio: unit, cantidad: qty, subtotal: unit * qty })
        mpItems.push({ id: p.id, title: p.nombre, quantity: qty, unit_price: unit, currency_id: currency })
      }

      const { direccion, localidad, provincia, codigo_postal } = shipping
      if (!direccion || !localidad || !provincia || !codigo_postal) {
        return res.status(400).json({ success: false, error: "Faltan datos de envío", code: "MISSING_SHIPPING_DATA" })
      }

      const ordenId = order_id || randomUUID()
      if (!order_id) {
        await client.execute({
          sql: `
            INSERT INTO ordenes (id, usuario_id, total, estado, pago, productos, direccion, localidad, provincia, codigo_postal)
            VALUES (?, ?, ?, 'pendiente_envio', 'pendiente', ?, ?, ?, ?, ?)`,
          args: [ordenId, usuario_id, total, JSON.stringify(detalle), direccion, localidad, provincia, codigo_postal],
        })
      } else {
        await client.execute({
          sql: "UPDATE ordenes SET total = ?, productos = ? WHERE id = ?",
          args: [total, JSON.stringify(detalle), order_id],
        })
      }

      const baseUrl = resolveBaseUrl(req)
      const notificationUrl = `${baseUrl}/api/payments/webhook/mercadopago`

      const payload = {
        items: mpItems,
        payer: { email: customer.email, name: customer.name },
        back_urls: {
          success: `${baseUrl}/payment/success?order_id=${ordenId}`,
          pending: `${baseUrl}/payment/pending?order_id=${ordenId}`,
          failure: `${baseUrl}/payment/failure?order_id=${ordenId}`,
        },
        auto_return: "approved",
        external_reference: ordenId,
        notification_url: notificationUrl,
        statement_descriptor: "Store",
        metadata: { usuario_id: usuario_id || "", order_id: ordenId },
      }

      const { data } = await mp.post("/checkout/preferences", payload)
      await client.execute({ sql: "UPDATE ordenes SET mp_preference_id = ? WHERE id = ?", args: [data.id, ordenId] })

      res.json({
        success: true,
        orden_id: ordenId,
        total,
        preference_id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
      })
    } catch (err) {
      console.error("Error createPreference:", err?.response?.data || err.message)
      res.status(500).json({
        success: false,
        error: "Error creando preferencia de pago",
        details: err?.response?.data || err.message,
      })
    }
  },

  // Webhook IPN de Mercado Pago con validación de firma
  async webhookMP(req, res) {
    try {
      // Validar firma si hay secreto configurado
      const validation = verifyMPSignature(req)
      if (!validation.ok) {
        console.warn("⚠️ Webhook MP firma inválida:", validation.reason)
        return res.status(401).json({ received: false })
      }

      const topic = req.query.topic || req.query.type
      const dataId = req.query["data.id"] || req.query.id

      if (!topic) {
        console.log("Webhook MP sin topic - body:", req.body?.toString?.() || req.body)
        return res.status(200).json({ received: true })
      }

      if (topic === "payment") {
        if (!dataId) return res.status(200).json({ received: true })
        const { data: payment } = await mp.get(`/v1/payments/${dataId}`)
        const externalRef = payment.external_reference
        const status = payment.status // approved|pending|rejected|in_process
        const newPago = status === "approved" ? "pagado" : status === "rejected" ? "cancelado" : "pendiente"
        if (externalRef) {
          await client.execute({
            sql: "UPDATE ordenes SET pago = ?, mp_payment_id = ? WHERE id = ?",
            args: [newPago, String(payment.id), externalRef],
          })
        }
      } else if (topic === "merchant_order") {
        if (!dataId) return res.status(200).json({ received: true })
        const { data: mo } = await mp.get(`/merchant_orders/${dataId}`)
        const externalRef = mo.external_reference
        const paidAmount = mo.paid_amount || 0
        const totalAmount = mo.total_amount || 0
        const newPago = paidAmount >= totalAmount && totalAmount > 0 ? "pagado" : "pendiente"
        if (externalRef) {
          await client.execute({ sql: "UPDATE ordenes SET pago = ? WHERE id = ?", args: [newPago, externalRef] })
        }
      } else {
        console.log("Webhook MP topic no manejado:", topic)
      }

      res.status(200).json({ received: true })
    } catch (err) {
      console.error("Error webhook MP:", err?.response?.data || err.message)
      // Siempre responder 200 para evitar reintentos excesivos si ya procesaste el evento
      res.status(200).json({ received: true })
    }
  },

  async getPaymentStatus(req, res) {
    try {
      const { id } = req.params
      const { data } = await mp.get(`/v1/payments/${id}`)
      res.json({
        success: true,
        payment: {
          id: data.id,
          status: data.status,
          status_detail: data.status_detail,
          transaction_amount: data.transaction_amount,
          currency_id: data.currency_id,
          payer: data.payer,
          date_created: data.date_created,
        },
      })
    } catch (err) {
      res
        .status(400)
        .json({ success: false, error: "No se pudo obtener el pago", details: err?.response?.data || err.message })
    }
  },

  async getPublicKey(req, res) {
    if (!config.mercadopago.publicKey)
      return res.status(500).json({ success: false, error: "MP_PUBLIC_KEY no configurada" })
    res.json({ success: true, public_key: config.mercadopago.publicKey })
  },
}
