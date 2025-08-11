import { Router } from "express"
import { userController } from "../controllers/user-controller.js"
import { authRequired } from "../middlewares/auth.js"

const router = Router()
router.post("/register", userController.register)
router.post("/login", userController.login)
router.get("/profile", authRequired, userController.getProfile)
router.put("/profile", authRequired, userController.updateProfile)
export default router
