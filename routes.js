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

// ✅ Cloudinary config
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

  // 🖼 Upload endpoint
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: "campuskart" });
      fs.unlinkSync(req.file.path); // remove temp
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

  // ✅ Create product → return product + deleteKey
  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);

      // attach deleteKey temporarily to response
      res.status(201).json({
        ...product,
        deleteKey: validatedData.deleteKey, // must be saved by seller
      });
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

  // ✅ Delete route (API style)
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { deleteKey } = req.body;

      if (!deleteKey) {
        return res.status(400).json({ message: "Delete key is required" });
      }

      const deleted = await storage.deleteProduct(req.params.id, deleteKey);
      if (!deleted) {
        return res.status(403).json({ message: "Invalid product ID or delete key" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // ✅ Delete via direct link (for users who saved the link)
  app.get("/api/products/delete/:id", async (req, res) => {
    try {
      const { key } = req.query;
      if (!key) return res.status(400).send("❌ Delete key is required");

      const deleted = await storage.deleteProduct(req.params.id, key);
      if (!deleted) {
        return res.status(403).send("❌ Invalid product ID or delete key");
      }

      res.send("✅ Product deleted successfully");
    } catch (error) {
      console.error("Delete product error (link):", error);
      res.status(500).send("❌ Failed to delete product");
    }
  });

  return createServer(app);
}
