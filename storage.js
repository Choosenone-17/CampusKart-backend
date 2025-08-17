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
      // ⚠️ Don't expose deleteKey here (keep it private)
    };
  }

  async getAllProducts() {
    try {
      const products = await ProductModel.find().sort({ createdAt: -1 });
      return products.map((doc) => this.toProduct(doc));
    } catch (error) {
      console.error("Error getting all products:", error);
      return [];
    }
  }

  async getProductById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
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
      // generate random deleteKey
      const deleteKey = crypto.randomBytes(6).toString("hex");

      const product = new ProductModel({
        ...insertProduct,
        images: insertProduct.images || [],
        deleteKey,
      });

      const savedProduct = await product.save();
      // return both product and deleteKey (so frontend can show it to user)
      return { ...this.toProduct(savedProduct), deleteKey };
    } catch (error) {
      console.error("Error creating product:", error);
      throw new Error("Failed to create product");
    }
  }

  async updateProduct(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return undefined;
      }
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

  async deleteProduct(id, deleteKey) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return false;
      }
      const product = await ProductModel.findById(id);
      if (!product) return false;

      if (product.deleteKey !== deleteKey) {
        return false; // wrong key
      }

      await ProductModel.findByIdAndDelete(id);
      return true;
    } catch (error) {
      console.error("Error deleting product:", error);
      return false;
    }
  }
}

export const storage = new MongoStorage();
