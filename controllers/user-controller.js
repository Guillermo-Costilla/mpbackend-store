import client from "../config/database.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { config } from "../config/config.js"

export const userController = {
  async register(req, res) {
    try {
      const {
        nombre,
        email,
        password,
        pais = "Argentina",
        localidad = "Buenos Aires",
        codigo_postal = "1000",
      } = req.body
      if (!nombre || !email || !password) return res.status(400).json({ message: "Todos los campos son requeridos" })

      const exists = await client.execute({ sql: "SELECT id FROM usuarios WHERE email = ?", args: [email] })
      if (exists.rows.length > 0) return res.status(400).json({ message: "El email ya está registrado" })

      const hashedPassword = await bcrypt.hash(password, 10)
      await client.execute({
        sql: "INSERT INTO usuarios (nombre, email, contraseña, pais, localidad, codigo_postal, rol) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [nombre, email, hashedPassword, pais, localidad, codigo_postal, "usuario"],
      })

      res.status(201).json({ message: "Usuario registrado exitosamente" })
    } catch (error) {
      console.error("Error en registro:", error)
      res.status(500).json({ message: error.message })
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body
      const r = await client.execute({ sql: "SELECT * FROM usuarios WHERE email = ?", args: [email] })
      const user = r.rows[0]
      if (!user) return res.status(401).json({ message: "Credenciales inválidas" })
      const ok = await bcrypt.compare(password, user.contraseña)
      if (!ok) return res.status(401).json({ message: "Credenciales inválidas" })

      const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, config.jwt.secret, { expiresIn: "24h" })
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
          pais: user.pais,
          localidad: user.localidad,
          codigo_postal: user.codigo_postal,
        },
      })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async getProfile(req, res) {
    try {
      const r = await client.execute({
        sql: "SELECT id, nombre, email, pais, localidad, codigo_postal, rol FROM usuarios WHERE id = ?",
        args: [req.user.id],
      })
      if (r.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado" })
      res.json(r.rows[0])
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async updateProfile(req, res) {
    try {
      const { nombre, email, pais, localidad, codigo_postal } = req.body
      await client.execute({
        sql: "UPDATE usuarios SET nombre = ?, email = ?, pais = ?, localidad = ?, codigo_postal = ? WHERE id = ?",
        args: [nombre, email, pais, localidad, codigo_postal, req.user.id],
      })
      res
        .status(200)
        .json({ message: "Perfil actualizado exitosamente", user: { nombre, email, pais, localidad, codigo_postal } })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },
}
