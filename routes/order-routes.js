import { Router } from "express"
import { orderController } from "../controllers/order-controller.js"
import { authRequired, adminOnly } from "../middlewares/auth.js"

const router = Router()
router.post("/", authRequired, orderController.createOrder)
router.get("/my-orders", authRequired, orderController.getUserOrders)
router.get("/all", authRequired, adminOnly, orderController.getAllOrders)
router.put("/:id/status", authRequired, adminOnly, orderController.updateOrderStatus)
export default router
