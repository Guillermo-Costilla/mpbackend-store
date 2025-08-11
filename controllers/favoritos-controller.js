import client from "../config/database.js"

export async function agregarFavorito(req, res) {
  const { usuario_id, producto_id } = req.body
  try {
    const usuario = await client.execute("SELECT id FROM usuarios WHERE id = ?", [usuario_id])
    if (usuario.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" })

    const producto = await client.execute("SELECT id FROM productos WHERE id = ?", [producto_id])
    if (producto.rows.length === 0) return res.status(404).json({ error: "Producto no encontrado" })

    await client.execute(`INSERT INTO favoritos (usuario_id, producto_id) VALUES (?, ?)`, [usuario_id, producto_id])
    res.status(201).json({ mensaje: "Agregado a favoritos" })
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Ya estaba en favoritos" })
    if (String(err.message).includes("FOREIGN KEY"))
      return res.status(400).json({ error: "Usuario o producto no válido" })
    res.status(500).json({ error: "Error al agregar favorito" })
  }
}

export async function eliminarFavorito(req, res) {
  const { usuario_id, producto_id } = req.body
  try {
    await client.execute(`DELETE FROM favoritos WHERE usuario_id = ? AND producto_id = ?`, [usuario_id, producto_id])
    res.json({ mensaje: "Eliminado de favoritos" })
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar favorito" })
  }
}

export async function obtenerFavoritos(req, res) {
  const { usuario_id } = req.params
  try {
    const favoritos = await client.execute(
      `
      SELECT productos.* FROM favoritos
      JOIN productos ON favoritos.producto_id = productos.id
      WHERE favoritos.usuario_id = ?`,
      [usuario_id],
    )
    res.json(favoritos)
  } catch (err) {
    res.status(500).json({ error: "Error al obtener favoritos" })
  }
}
