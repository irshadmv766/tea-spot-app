import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { supabaseUrl } from "./config";
import { supabase } from "./supabase";

export const PRODUCT_IMAGE_BUCKET = "product-images";

const MAX_WIDTH = 480;
const JPEG_QUALITY = 0.72;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function productImagePublicUrl(
  imagePath: string | null | undefined
): string | null {
  if (!imagePath || !supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${imagePath}`;
}

export async function pickProductImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library permission is required.");
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (picked.canceled || !picked.assets[0]?.uri) {
    return null;
  }

  const manipulated = await ImageManipulator.manipulateAsync(
    picked.assets[0].uri,
    [{ resize: { width: MAX_WIDTH } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return manipulated.uri;
}

export async function uploadProductImage(
  productId: string,
  localUri: string
): Promise<string> {
  const encoded = await ImageManipulator.manipulateAsync(
    localUri,
    [],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!encoded.base64) {
    throw new Error("Could not read image for upload.");
  }

  const body = base64ToArrayBuffer(encoded.base64);
  const path = `products/${productId}-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, body, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }
  return path;
}

export async function deleteProductImageFile(
  imagePath: string | null | undefined
): Promise<void> {
  if (!imagePath) return;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([imagePath]);
  if (error) throw error;
}