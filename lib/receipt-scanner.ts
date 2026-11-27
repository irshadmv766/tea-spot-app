import { recognizeText } from "@infinitered/react-native-mlkit-text-recognition";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { parseReceiptText, type ParsedReceipt } from "./receipt-parser";

export type ReceiptImageSource = "camera" | "library";

const OCR_MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.85;

async function ensurePermission(source: ReceiptImageSource): Promise<void> {
  if (source === "camera") {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      throw new Error("Camera permission is required to scan a receipt.");
    }
    return;
  }
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) {
    throw new Error("Photo library permission is required to select a receipt.");
  }
}

async function pickImageUri(source: ReceiptImageSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 1,
    allowsEditing: false,
  };

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }
  return result.assets[0].uri;
}

async function prepareImageForOcr(localUri: string): Promise<string> {
  const prepared = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: OCR_MAX_WIDTH } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return prepared.uri;
}

export async function scanReceiptFromImage(
  source: ReceiptImageSource
): Promise<ParsedReceipt | null> {
  await ensurePermission(source);
  const uri = await pickImageUri(source);
  if (!uri) return null;

  const ocrUri = await prepareImageForOcr(uri);
  const recognized = await recognizeText(ocrUri);
  const text = recognized.text?.trim() ?? "";

  if (!text) {
    throw new Error(
      "No readable text found on this image. Try a clearer, well-lit photo."
    );
  }

  return parseReceiptText(text);
}