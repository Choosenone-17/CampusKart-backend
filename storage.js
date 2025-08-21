import { ProductModel } from "./shared/schema.js";
import mongoose from "mongoose";
import crypto from "crypto";

export class MongoStorage {
  toProduct(doc) {
    return {
      id: doc._id.toString(),
      title: doc.title,
      description: doc.description,
      price: doc.price,
      category: doc.category,
      images: doc.images || [],
      sellerName: doc.sellerName,
      contactMethod: doc.contactMethod,
      contactDetails: doc.contactDetails,
      condition: doc.condition,
      createdAt: doc.createdAt,
      status: doc.status || "available",
      soldAt: doc.soldAt || null,
      // ⚠️ Do NOT expose secretKey here
    };
  }

  async getAllProducts() {
    try {
      const products = await ProductModel.find().sort({
        status: 1, // available first
        createdAt: -1, // newest first within each status
      });
      return products.map((doc) => this.toProduct(doc));
    } catch (error) {
      console.error("Error getting all products:", error);
      return [];
    }
  }

  async getProductById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      const product = await ProductModel.findById(id);
      return product ? this.toProduct(product) : undefined;
    } catch (error) {
      console.error("Error getting product by id:", error);
      return undefined;
    }
  }

  async getProductsByCategory(category) {
    try {
      const products = await ProductModel.find({ category }).sort({
        status: 1,
        createdAt: -1,
      });
      return products.map((doc) => this.toProduct(doc));
    } catch (error) {
      console.error("Error getting products by category:", error);
      return [];
    }
  }

  async createProduct(insertProduct) {
    try {
      const secretKey = crypto.randomBytes(6).toString("hex");

      const product = new ProductModel({
        ...insertProduct,
        images: insertProduct.images || [],
        secretKey,
        status: "available",
      });

      const savedProduct = await product.save();

      if (!savedProduct) {
        throw new Error("Product creation failed");
      }

      // Return exactly what frontend expects
      return {
        product: {
          id: savedProduct._id.toString(),
          title: savedProduct.title,
          description: savedProduct.description,
          price: savedProduct.price,
          category: savedProduct.category,
          images: savedProduct.images || [],
          sellerName: savedProduct.sellerName,
          contactMethod: savedProduct.contactMethod,
          contactDetails: savedProduct.contactDetails,
          condition: savedProduct.condition,
          createdAt: savedProduct.createdAt,
          status: savedProduct.status || "available",
          soldAt: savedProduct.soldAt || null,
        },
        secretKey,
      };
    } catch (error) {
      console.error("Error creating product:", error);
      throw new Error("Failed to create product: " + error.message);
    }
  }

  async updateProduct(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;

      const updated = await ProductModel.findByIdAndUpdate(
        id,
        { ...updateData },
        { new: true }
      );

      return updated ? this.toProduct(updated) : undefined;
    } catch (error) {
      console.error("Error updating product:", error);
      return undefined;
    }
  }

  // ❌ Delete is disabled (we only allow mark as sold)
  async deleteProduct(id, secretKey) {
    console.warn("Delete operation is disabled. Use mark as sold instead.");
    return false;
  }
}

export const storage = new MongoStorage();
