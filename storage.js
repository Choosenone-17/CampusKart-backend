import { ProductModel } from "./shared/schema.js";
import mongoose from "mongoose";

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
      const product = new ProductModel({
        ...insertProduct,
        images: insertProduct.images || [], // store array of image URLs
      });
      const savedProduct = await product.save();
      return this.toProduct(savedProduct);
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

  async deleteProduct(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return false;
      }
      const result = await ProductModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error("Error deleting product:", error);
      return false;
    }
  }
}

export const storage = new MongoStorage();
