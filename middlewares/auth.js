import jwt from "jsonwebtoken"
import { config } from "../config/config.js"

export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || ""
    const [type, token] = header.split(" ")
    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "No autenticado" })
    }
    const payload = jwt.verify(token, config.jwt.secret)
    req.user = payload
    next()
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" })
  }
}

export function adminOnly(req, res, next) {
  if (!req.user || req.user.rol !== "admin") {
    return res.status(403).json({ message: "Acceso denegado: requiere rol admin" })
  }
  next()
}
