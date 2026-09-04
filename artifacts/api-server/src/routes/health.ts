import { Router} from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

router.get("/healthz", (_req, res) => {
 res.json ({status: "ok" }); as HealthCheckResponse
});

export default router;
