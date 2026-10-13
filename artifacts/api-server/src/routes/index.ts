import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import catalogRouter from "./catalog";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(adminRouter);

export default router;
