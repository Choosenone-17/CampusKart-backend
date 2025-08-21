import { z } from "zod";
import mongoose, { Schema } from "mongoose";

// ✅ Zod schema (validation for API input)
export const insertProductSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().min(0, "Price must be positive"),
  category: z.enum([
    "textbooks",
    "electronics",
    "dorm-items",
    "supplies",
    "clothing",
    "furniture",
    "other",
  ]),
  images: z.array(z.string().url()).optional().default([]),
  sellerName: z.string().min(1, "Seller name is required"),
  contactMethod: z.enum(["email", "phone", "whatsapp", "telegram"]),
  contactDetails: z.string().min(1, "Contact details are required"),
  condition: z
    .enum(["new", "like-new", "good", "fair", "poor"])
    .optional()
    .default("good"),

  // 🔹 New fields for sold-out logic
  status: z.enum(["available", "sold"]).optional().default("available"),
  secretKey: z.string().optional(), // generated automatically
  soldAt: z.date().optional(),
});

// ✅ Mongoose schema with timestamps
const productSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
      type: String,
      required: true,
      enum: [
        "textbooks",
        "electronics",
        "dorm-items",
        "supplies",
        "clothing",
        "furniture",
        "other",
      ],
    },
    images: { type: [String], default: [] },
    sellerName: { type: String, required: true },
    contactMethod: {
      type: String,
      required: true,
      enum: ["email", "phone", "whatsapp", "telegram"],
    },
    contactDetails: { type: String, required: true },
    condition: {
      type: String,
      enum: ["new", "like-new", "good", "fair", "poor"],
      default: "good",
    },

    // 🔹 Sold-out logic
    status: {
      type: String,
      enum: ["available", "sold"],
      default: "available",
    },
    secretKey: { type: String, required: true },
    soldAt: { type: Date, default: null },
  },
  { timestamps: true } 
);

export const ProductModel = mongoose.model("Product", productSchema);
