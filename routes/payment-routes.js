import { Router } from "express"
import { paymentController } from "../controllers/payment-controller.js"
import { authRequired } from "../middlewares/auth.js"

const router = Router()
router.post("/create-preference", authRequired, paymentController.createPreference)
router.get("/payment-status/:id", authRequired, paymentController.getPaymentStatus)
router.get("/public-key", paymentController.getPublicKey)
export default router
