import client from "../config/database.js"

export async function obtenerMétricasAdmin(req, res) {
  try {
    if (req.user.rol !== "admin")
      return res.status(403).json({ error: "Acceso denegado. Solo administradores pueden ver el dashboard." })

    const ventasResult = await client.execute(`SELECT SUM(total) AS total_ventas FROM ordenes WHERE pago = 'pagado'`)
    const totalVentas = ventasResult.rows[0]?.total_ventas || 0

    const ordenesResult = await client.execute(`SELECT COUNT(*) AS total_ordenes FROM ordenes`)
    const totalOrdenes = ordenesResult.rows[0]?.total_ordenes || 0

    const estadosResult = await client.execute(`SELECT estado, COUNT(*) AS cantidad FROM ordenes GROUP BY estado`)
    const ordenesPorEstado = estadosResult.rows

    const pagosResult = await client.execute(`SELECT pago, COUNT(*) AS cantidad FROM ordenes GROUP BY pago`)
    const ordenesPorPago = pagosResult.rows

    const bajoStockResult = await client.execute(
      `SELECT id, nombre, stock, precio FROM productos WHERE stock < 5 ORDER BY stock ASC`,
    )
    const productosConPocoStock = bajoStockResult.rows

    const productosResult = await client.execute(`SELECT COUNT(*) AS total_productos FROM productos`)
    const totalProductos = productosResult.rows[0]?.total_productos || 0

    const recientesResult = await client.execute(`
      SELECT 
        o.id, o.total, o.estado, o.pago, o.fecha_creacion,
        o.direccion, o.localidad, o.provincia, o.codigo_postal,
        u.nombre as cliente_nombre, u.email as cliente_email, u.pais as cliente_pais
      FROM ordenes o
      JOIN usuarios u ON o.usuario_id = u.id
      ORDER BY o.fecha_creacion DESC
      LIMIT 5
    `)
    const ordenesRecientes = recientesResult.rows

    const ventasMesResult = await client.execute(`
      SELECT SUM(total) AS ventas_mes
      FROM ordenes 
      WHERE pago = 'pagado' AND fecha_creacion >= datetime('now', '-30 days')
    `)
    const ventasUltimoMes = ventasMesResult.rows[0]?.ventas_mes || 0

    res.json({
      success: true,
      metricas: {
        ventas: { total: totalVentas, ultimo_mes: ventasUltimoMes },
        ordenes: {
          total: totalOrdenes,
          por_estado: ordenesPorEstado,
          por_pago: ordenesPorPago,
          recientes: ordenesRecientes,
        },
        productos: { total: totalProductos, stock_bajo: productosConPocoStock },
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: "Error interno del servidor al obtener métricas" })
  }
}

export async function obtenerOrdenesCompletas(req, res) {
  try {
    if (req.user.rol !== "admin")
      return res.status(403).json({ error: "Acceso denegado. Solo administradores pueden ver las órdenes completas." })

    const { limit = 50, offset = 0, estado, pago } = req.query
    let sql = `
      SELECT 
        o.*,
        u.nombre as cliente_nombre,
        u.email as cliente_email,
        u.pais as cliente_pais,
        u.localidad as cliente_localidad,
        u.codigo_postal as cliente_codigo_postal
      FROM ordenes o
      JOIN usuarios u ON o.usuario_id = u.id
    `
    const args = []
    const conditions = []
    if (estado) {
      conditions.push("o.estado = ?")
      args.push(estado)
    }
    if (pago) {
      conditions.push("o.pago = ?")
      args.push(pago)
    }
    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ")
    sql += " ORDER BY o.fecha_creacion DESC LIMIT ? OFFSET ?"
    args.push(Number.parseInt(limit), Number.parseInt(offset))

    const result = await client.execute({ sql, args })
    const ordenes = result.rows.map((orden) => {
      const productos = JSON.parse(orden.productos)
      const resumen_productos = productos.map((p) => ({
        nombre: p.nombre,
        cantidad: p.cantidad,
        precio: p.precio,
        subtotal: p.subtotal,
        imagen: p.imagen,
      }))
      return {
        ...orden,
        productos: resumen_productos,
        cliente: {
          nombre: orden.cliente_nombre,
          email: orden.cliente_email,
          pais: orden.cliente_pais,
          localidad: orden.cliente_localidad,
          codigo_postal: orden.cliente_codigo_postal,
        },
        direccion_envio: {
          direccion: orden.direccion,
          localidad: orden.localidad,
          provincia: orden.provincia,
          codigo_postal: orden.codigo_postal,
        },
      }
    })

    res.json({
      success: true,
      ordenes,
      total: ordenes.length,
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
    })
  } catch (error) {
    res.status(500).json({ success: false, error: "Error interno del servidor al obtener órdenes" })
  }
}

export async function obtenerUsuariosAdmin(req, res) {
  try {
    if (req.user.rol !== "admin")
      return res.status(403).json({ error: "Acceso denegado. Solo administradores pueden ver los usuarios." })
    const result = await client.execute(`SELECT * FROM usuarios ORDER BY fecha_creacion DESC`)
    res.json({ success: true, usuarios: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, error: "Error interno del servidor al obtener usuarios" })
  }
}

export async function obtenerOrdenDetallada(req, res) {
  try {
    if (req.user.rol !== "admin")
      return res.status(403).json({ error: "Acceso denegado. Solo administradores pueden ver órdenes detalladas." })
    const { id } = req.params
    const result = await client.execute(
      `
      SELECT 
        o.*,
        u.nombre as cliente_nombre,
        u.email as cliente_email,
        u.pais as cliente_pais,
        u.localidad as cliente_localidad,
        u.codigo_postal as cliente_codigo_postal
      FROM ordenes o
      JOIN usuarios u ON o.usuario_id = u.id
      WHERE o.id = ?`,
      [id],
    )
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Orden no encontrada" })

    const orden = result.rows[0]
    const ordenDetallada = {
      ...orden,
      productos: JSON.parse(orden.productos),
      cliente: {
        nombre: orden.cliente_nombre,
        email: orden.cliente_email,
        pais: orden.cliente_pais,
        localidad: orden.cliente_localidad,
        codigo_postal: orden.cliente_codigo_postal,
      },
      direccion_envio: {
        direccion: orden.direccion,
        localidad: orden.localidad,
        provincia: orden.provincia,
        codigo_postal: orden.codigo_postal,
      },
    }
    res.json({ success: true, orden: ordenDetallada })
  } catch (error) {
    res.status(500).json({ success: false, error: "Error interno del servidor al obtener la orden" })
  }
}
