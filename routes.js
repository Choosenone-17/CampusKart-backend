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
      res.status(201).json({
        ...product,
        deleteKey: validatedData.deleteKey,
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

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { deleteKey } = req.body;
      if (!deleteKey) return res.status(400).json({ message: "Delete key is required" });

      const deleted = await storage.deleteProduct(req.params.id, deleteKey);
      if (!deleted) return res.status(403).json({ message: "Invalid product ID or delete key" });

      res.status(204).send();
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.get("/api/products/delete/:id", async (req, res) => {
    try {
      const { key } = req.query;
      if (!key) return res.status(400).send("❌ Delete key is required");

      const deleted = await storage.deleteProduct(req.params.id, key);
      if (!deleted) return res.status(403).send("❌ Invalid product ID or delete key");

      res.send("✅ Product deleted successfully");
    } catch (error) {
      console.error("Delete product error (link):", error);
      res.status(500).send("❌ Failed to delete product");
    }
  });

  // --- Cart routes (MongoDB session-based) ---
  // Get cart for a session
  app.get("/api/cart/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    let cart = await Cart.findOne({ sessionId }).populate("products.productId");
    if (!cart) cart = await Cart.create({ sessionId, products: [] });
    res.json(cart);
  });

  // Add product to cart
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

  // Remove product from cart
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
