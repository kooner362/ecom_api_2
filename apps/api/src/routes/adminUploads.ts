import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import type { ApiEnv } from "@ecom/shared";
import { createAuthMiddleware } from "../middleware/auth.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function createAdminUploadsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = path.resolve(env.UPLOADS_DIR, storeId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = MIME_TO_EXT[file.mimetype] ?? "bin";
      const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
      cb(null, unique);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter(_req, file, cb) {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });

  router.post("/admin/uploads", upload.single("file"), (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: { code: "NO_FILE", message: "No file provided" } });
        return;
      }

      const relativePath = `uploads/${storeId}/${req.file.filename}`;
      const url = `${env.API_PUBLIC_URL.replace(/\/+$/, "")}/${relativePath}`;

      res.status(201).json({ url });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
