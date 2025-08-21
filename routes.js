import { createServer } from "http";
import { storage } from "./storage.js";
import { insertProductSchema } from "./shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Cart from "./models/cart.js";
import { ProductModel } from "./shared/schema.js"; // ✅ Import directly for secretKey check

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

  // ❌ We are NOT using delete anymore (kept here if you want rollback later)
  app.delete("/api/products/:id", async (req, res) => {
    try {
      res.status(403).json({ message: "Deleting products is disabled. Use 'mark as sold' instead." });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.get("/api/products/delete/:id", async (req, res) => {
    try {
      res.status(403).send("❌ Deleting products is disabled. Use 'mark as sold' instead.");
    } catch (error) {
      console.error("Delete product error (link):", error);
      res.status(500).send("❌ Failed to delete product");
    }
  });

  // --- ✅ Mark product as sold ---
  app.post("/api/products/:id/mark-sold", async (req, res) => {
    try {
      const { secretKey } = req.body;
      if (!secretKey) {
        return res.status(400).json({ message: "Secret key is required" });
      }

      // ✅ Fetch product directly from DB (with secretKey)
      const product = await ProductModel.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.secretKey !== secretKey) {
        return res.status(403).json({ message: "Invalid secret key" });
      }

      product.status = "sold";
      product.soldAt = new Date();
      await product.save();

      res.json({ message: "✅ Product marked as sold", product: storage.toProduct(product) });
    } catch (error) {
      console.error("Mark sold error:", error);
      res.status(500).json({ message: "Failed to mark product as sold" });
    }
  });

  // --- Cart routes (MongoDB session-based) ---
  app.get("/api/cart/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    let cart = await Cart.findOne({ sessionId }).populate("products.productId");
    if (!cart) cart = await Cart.create({ sessionId, products: [] });
    res.json(cart);
  });

  app.post("/api/cart/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "productId is required" });

    let cart = await Cart.findOne({ sessionId });
    if (!cart) cart = await Cart.create({ sessionId, products: [] });

    const existing = cart.products.find(p => p.productId.toString() === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.products.push({ productId, quantity: 1 });
    }

    await cart.save();
    res.status(201).json(cart);
  });

  app.delete("/api/cart/:sessionId/:productId", async (req, res) => {
    const { sessionId, productId } = req.params;
    const cart = await Cart.findOne({ sessionId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.products = cart.products.filter(p => p.productId.toString() !== productId);
    await cart.save();

    res.json(cart);
  });

  return createServer(app);
}
