import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
const MAX_DIMENSION = 2000;

interface ImageProcessingResult {
  storageId: string;
  originalUrl: string;
  webpUrl: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

export const processAndUploadImage = action({
  args: { 
    configuratorId: v.id("configurators"),
    fileName: v.string(),
    contentType: v.string(),
    base64Data: v.string(),
    variant: v.union(v.literal("dark"), v.literal("light")),
    quality: v.optional(v.number()),
    maxWidth: v.optional(v.number()),
    maxHeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(args.contentType)) {
      throw new Error(`Unsupported file type: ${args.contentType}`);
    }

    // Decode base64
    const buffer = Buffer.from(args.base64Data, "base64");
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error("File too large (max 5MB)");
    }

    // Use Sharp for processing (server-side)
    // Note: In Convex actions, we can't use Sharp directly.
    // This would need to be done via an external service or worker.
    // For now, we'll generate upload URLs and process client-side.
    
    // Return upload URL for client-side processing
    const uploadUrl = await ctx.storage.generateUploadUrl();
    
    return {
      uploadUrl,
      instructions: "Process image client-side with WebP conversion, then upload to the provided URL",
      maxDimension: MAX_DIMENSION,
      quality: args.quality || 85,
      targetFormat: "webp",
    };
  },
});

export const processImageClientSide = internalAction({
  args: {
    configuratorId: v.id("configurators"),
    storageId: v.id("_storage"),
    variant: v.union(v.literal("dark"), v.literal("light")),
  },
  handler: async (ctx, args) => {
    // This would be called after client uploads processed WebP
    // Verify the image and update branding
    const file = await ctx.storage.getMetadata(args.storageId);
    if (!file) throw new Error("File not found");

    // Update branding with the new logo
    await ctx.runMutation(internal.branding.setLogo, {
      configuratorId: args.configuratorId,
      storageId: args.storageId,
      variant: args.variant,
    });

    const url = await ctx.storage.getUrl(args.storageId);
    return { url, storageId: args.storageId };
  },
});

export const deleteImage = internalAction({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});

export const generateOptimizedImageUrls = internalAction({
  args: { storageId: v.id("_storage"), widths: v.array(v.number()) },
  handler: async (ctx, args) => {
    // Generate responsive image URLs
    // Convex storage doesn't support automatic resizing
    // This would need an external image CDN like Cloudinary or Imgix
    const baseUrl = await ctx.storage.getUrl(args.storageId);
    
    return {
      original: baseUrl,
      responsive: args.widths.map(w => ({
        width: w,
        url: `${baseUrl}?w=${w}&auto=format,compress`,
      })),
    };
  },
});

// Client-side image processing utilities (to be used in React components)
export const clientImageProcessor = {
  // Convert any image to WebP using canvas
  async convertToWebP(file: File, options: { quality?: number; maxWidth?: number; maxHeight?: number } = {}): Promise<Blob> {
    const { quality = 0.85, maxWidth = 2000, maxHeight = 2000 } = options;
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context not available"));
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("WebP conversion failed"));
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  },

  // Validate image file
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: `Unsupported file type. Allowed: ${ALLOWED_TYPES.join(", ")}` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true };
  },

  // Get image dimensions
  async getDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  },
};