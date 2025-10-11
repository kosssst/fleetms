import {Router} from "express";
import {protect} from "../middleware/auth.middleware";
import {getSummary} from "../controllers/dashboard.controller";

const router = Router();

router.route('/summary').get(protect, getSummary);

export default router;