import { Router } from "express"
import { authRequired, adminOnly } from "../middlewares/auth.js"
import {
  obtenerMétricasAdmin,
  obtenerOrdenesCompletas,
  obtenerUsuariosAdmin,
  obtenerOrdenDetallada,
} from "../controllers/admin-controller.js"

const router = Router()
router.get("/dashboard", authRequired, adminOnly, obtenerMétricasAdmin)
router.get("/orders", authRequired, adminOnly, obtenerOrdenesCompletas)
router.get("/orders/:id", authRequired, adminOnly, obtenerOrdenDetallada)
router.get("/users", authRequired, adminOnly, obtenerUsuariosAdmin)
export default router
