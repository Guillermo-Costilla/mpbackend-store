import { Router } from "express"
import { agregarFavorito, eliminarFavorito, obtenerFavoritos } from "../controllers/favoritos-controller.js"

const router = Router()
router.post("/", agregarFavorito)
router.delete("/", eliminarFavorito)
router.get("/:usuario_id", obtenerFavoritos)
export default router
