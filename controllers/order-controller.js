import client from "../config/database.js"
import { enviarCorreo } from "../lib/mailer.js"
import { randomUUID } from "crypto"

export const orderController = {
  async createOrder(req, res) {
    try {
      const { productos, direccion, localidad, provincia, codigo_postal } = req.body
      const usuario_id = req.user.id

      if (!Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ message: "Debe incluir al menos un producto" })
      }
      if (!direccion || !localidad || !provincia || !codigo_postal) {
        return res
          .status(400)
          .json({ message: "Debe incluir todos los datos de envío: direccion, localidad, provincia, codigo_postal" })
      }

      let total = 0
      const productosDetalle = []
      for (const item of productos) {
        const r = await client.execute({ sql: "SELECT * FROM productos WHERE id = ?", args: [item.producto_id] })
        const p = r.rows[0]
        if (!p) return res.status(404).json({ message: `Producto ${item.producto_id} no encontrado` })
        if (Number(p.stock) < Number(item.cantidad)) {
          return res.status(400).json({ message: `Stock insuficiente para ${p.nombre}. Stock disponible: ${p.stock}` })
        }
        const subtotal = Number(p.precio) * Number(item.cantidad)
        total += subtotal
        productosDetalle.push({
          id: p.id,
          nombre: p.nombre,
          precio: Number(p.precio),
          cantidad: Number(item.cantidad),
          subtotal,
        })
      }

      const orden_id = randomUUID()
      await client.execute({
        sql: `
          INSERT INTO ordenes (id, usuario_id, total, estado, pago, productos, direccion, localidad, provincia, codigo_postal)
          VALUES (?, ?, ?, 'pendiente_envio', 'pendiente', ?, ?, ?, ?, ?)`,
        args: [
          orden_id,
          usuario_id,
          total,
          JSON.stringify(productosDetalle),
          direccion,
          localidad,
          provincia,
          codigo_postal,
        ],
      })

      // Email (opcional)
      const usuarioResult = await client.execute({
        sql: "SELECT nombre, email FROM usuarios WHERE id = ?",
        args: [usuario_id],
      })
      const usuario = usuarioResult.rows[0]
      if (usuario?.email) {
        const productosHTML = productosDetalle
          .map(
            (producto) => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${producto.nombre}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${producto.cantidad}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${Number(producto.precio).toFixed(2)}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${Number(producto.subtotal).toFixed(2)}</td>
            </tr>`,
          )
          .join("")
        await enviarCorreo({
          to: usuario.email,
          subject: "Confirmación de orden creada",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Hola ${usuario.nombre}, recibimos tu orden.</h2>
              <p>Tu orden #${orden_id} fue creada. Te redirigiremos a Mercado Pago para completar el pago.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <thead>
                  <tr style="background-color: #e9ecef;">
                    <th style="padding: 10px; text-align: left;">Producto</th>
                    <th style="padding: 10px; text-align: center;">Cant.</th>
                    <th style="padding: 10px; text-align: right;">Precio</th>
                    <th style="padding: 10px; text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>${productosHTML}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Total</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold;">$${Number(total).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `,
        })
      }

      res.status(201).json({ message: "Orden creada exitosamente", orden_id, total })
    } catch (error) {
      console.error("Error creando orden:", error)
      res.status(500).json({ message: error.message })
    }
  },

  async getUserOrders(req, res) {
    try {
      const usuario_id = req.user.id
      const result = await client.execute({
        sql: "SELECT * FROM ordenes WHERE usuario_id = ? ORDER BY fecha_creacion DESC",
        args: [usuario_id],
      })
      const ordenes = result.rows.map((o) => ({ ...o, productos: JSON.parse(o.productos) }))
      res.json(ordenes)
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async getAllOrders(req, res) {
    try {
      if (req.user.rol !== "admin") return res.status(403).json({ message: "Acceso denegado" })
      const { limit = 50, offset = 0, estado, pago } = req.query
      let sql = `
        SELECT o.*, u.nombre as usuario_nombre, u.email as usuario_email
        FROM ordenes o JOIN usuarios u ON o.usuario_id = u.id`
      const args = []
      const cond = []
      if (estado) {
        cond.push("o.estado = ?")
        args.push(estado)
      }
      if (pago) {
        cond.push("o.pago = ?")
        args.push(pago)
      }
      if (cond.length) sql += " WHERE " + cond.join(" AND ")
      sql += " ORDER BY o.fecha_creacion DESC LIMIT ? OFFSET ?"
      args.push(Number(limit), Number(offset))
      const result = await client.execute({ sql, args })
      const ordenes = result.rows.map((o) => ({ ...o, productos: JSON.parse(o.productos) }))
      res.json(ordenes)
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async updateOrderStatus(req, res) {
    try {
      if (req.user.rol !== "admin") return res.status(403).json({ message: "Acceso denegado" })
      const { id } = req.params
      const { estado, pago } = req.body
      const updates = []
      const args = []
      if (estado) {
        updates.push("estado = ?")
        args.push(estado)
      }
      if (pago) {
        updates.push("pago = ?")
        args.push(pago)
      }
      if (!updates.length)
        return res.status(400).json({ message: "Debe proporcionar al menos un campo para actualizar" })
      args.push(id)

      const result = await client.execute({ sql: `UPDATE ordenes SET ${updates.join(", ")} WHERE id = ?`, args })
      if (result.rowsAffected === 0) return res.status(404).json({ message: "Orden no encontrada" })

      if (estado === "enviado") {
        const order = await client.execute({ sql: "SELECT productos FROM ordenes WHERE id = ?", args: [id] })
        const items = JSON.parse(order.rows[0].productos || "[]")
        for (const it of items) {
          await client.execute({
            sql: "UPDATE productos SET stock = stock - ? WHERE id = ?",
            args: [Number(it.cantidad), it.id],
          })
        }
      }

      res.json({ message: "Estado de orden actualizado exitosamente" })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
}
