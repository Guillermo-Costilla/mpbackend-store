import { Router } from "express"
import { productController } from "../controllers/product-controller.js"
import { authRequired, adminOnly } from "../middlewares/auth.js"

const router = Router()
router.get("/", productController.getProducts)
router.get("/categories", productController.getCategories)
router.get("/:id", productController.getProductById)
router.post("/", authRequired, adminOnly, productController.createProduct)
router.put("/:id", authRequired, adminOnly, productController.updateProduct)
router.delete("/:id", authRequired, adminOnly, productController.deleteProduct)
export default router
