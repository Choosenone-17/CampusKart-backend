import { createServer } from "http";
import { storage } from "./storage.js";
import { insertProductSchema } from "./shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// --- Debug: log Cloudinary env variables (safe for dev, remove in prod) ---
console.log("CLOUDINARY_CLOUD_NAME (raw):", `"${process.env.CLOUDINARY_CLOUD_NAME}"`);
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? "set" : "missing");
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "set" : "missing");

// ✅ Cloudinary config (normalize & trim values)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim().toLowerCase(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

export async function registerRoutes(app) {
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

  const storageConfig = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
  });

  const upload = multer({ storage: storageConfig });

  // 🖼 Upload endpoint (Cloudinary)
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    console.log("Uploading file:", req.file.path);

    try {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: "campuskart" });

      // Remove temp file
      fs.unlinkSync(req.file.path);

      console.log("✅ Cloudinary upload success:", result.secure_url);
      res.json({ url: result.secure_url });
    } catch (err) {
      console.error("❌ Cloudinary upload error:", err.message || err);
      res.status(500).json({ message: "Image upload failed", error: err.message || err });
    }
  });

  app.use("/uploads", express.static(uploadDir));

  // --- Product routes ---
  app.get("/api/products", async (req, res) => {
    try {
      const { category } = req.query;
      const products = category && category !== "all"
        ? await storage.getProductsByCategory(category)
        : await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Fetch products error:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProductById(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Fetch product error:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Create product error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, validatedData);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Product not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  return createServer(app);
}
