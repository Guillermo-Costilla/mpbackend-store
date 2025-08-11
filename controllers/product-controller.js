import client from "../config/database.js"

export const productController = {
  async createProduct(req, res) {
    try {
      if (req.user.rol !== "admin")
        return res.status(403).json({ message: "Acceso denegado. Solo administradores pueden crear productos." })
      const { nombre, categoria, imagen, imagenes = [], descripcion, precio, descuento = 0, stock = 0 } = req.body
      const precio_descuento = Number(precio) * (1 - Number(descuento || 0) / 100)

      await client.execute({
        sql: "INSERT INTO productos (nombre, categoria, imagen, imagenes, descripcion, precio, descuento, precio_descuento, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          nombre,
          categoria,
          imagen || "",
          JSON.stringify(imagenes),
          descripcion || "",
          Number(precio),
          Number(descuento) || 0,
          Number(precio_descuento),
          Number(stock),
        ],
      })
      res.status(201).json({ message: "Producto creado exitosamente" })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async getProducts(req, res) {
    try {
      const { categoria, limit = 50, offset = 0 } = req.query
      let sql = "SELECT * FROM productos WHERE stock > 0"
      const args = []
      if (categoria) {
        sql += " AND categoria = ?"
        args.push(categoria)
      }
      sql += " ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?"
      args.push(Number.parseInt(limit), Number.parseInt(offset))
      const result = await client.execute({ sql, args })
      res.json(result.rows)
    } catch (error) {
      console.error("❌ Error en getProducts:", error)
      res.status(500).json({ message: "Error interno del servidor al obtener productos", error: error.message })
    }
  },

  async getProductById(req, res) {
    try {
      const { id } = req.params
      const result = await client.execute({ sql: "SELECT * FROM productos WHERE id = ?", args: [id] })
      if (result.rows.length === 0) return res.status(404).json({ message: "Producto no encontrado" })
      res.json(result.rows[0])
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async updateProduct(req, res) {
    try {
      if (req.user.rol !== "admin")
        return res.status(403).json({ message: "Acceso denegado. Solo administradores pueden actualizar productos." })
      const { id } = req.params
      const { nombre, categoria, imagen, imagenes = [], descripcion, precio, descuento, stock, puntuacion } = req.body
      const precio_descuento = precio ? Number(precio) * (1 - Number(descuento || 0) / 100) : undefined

      const result = await client.execute({
        sql: `
          UPDATE productos SET
            nombre = COALESCE(?, nombre),
            categoria = COALESCE(?, categoria),
            imagen = COALESCE(?, imagen),
            imagenes = COALESCE(?, imagenes),
            descripcion = COALESCE(?, descripcion),
            precio = COALESCE(?, precio),
            descuento = COALESCE(?, descuento),
            precio_descuento = COALESCE(?, precio_descuento),
            stock = COALESCE(?, stock),
            puntuacion = COALESCE(?, puntuacion)
          WHERE id = ?`,
        args: [
          nombre || null,
          categoria || null,
          imagen || null,
          JSON.stringify(imagenes) || null,
          descripcion || null,
          precio ?? null,
          descuento ?? null,
          precio_descuento ?? null,
          stock ?? null,
          puntuacion ?? null,
          id,
        ],
      })

      if (result.rowsAffected === 0) return res.status(404).json({ message: "Producto no encontrado" })
      res.json({ message: "Producto actualizado exitosamente" })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async deleteProduct(req, res) {
    try {
      if (req.user.rol !== "admin")
        return res.status(403).json({ message: "Acceso denegado. Solo administradores pueden eliminar productos." })
      const { id } = req.params
      const result = await client.execute({ sql: "DELETE FROM productos WHERE id = ?", args: [id] })
      if (result.rowsAffected === 0) return res.status(404).json({ message: "Producto no encontrado" })
      res.json({ message: "Producto eliminado exitosamente" })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async getCategories(req, res) {
    try {
      const result = await client.execute({ sql: "SELECT DISTINCT categoria FROM productos ORDER BY categoria" })
      res.json(result.rows.map((r) => r.categoria))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
}
