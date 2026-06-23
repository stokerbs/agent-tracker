import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export interface CapturedPhoto {
  file: File;
  previewUrl: string;
}

/**
 * Capture a photo with the native camera (or pick from the library) and return
 * it as a File ready for the existing evidence upload path. Native only — call
 * behind isNative(). Returns null if the user cancels.
 *
 * @param source "camera" to open the camera, "photos" to pick from the library.
 */
export async function capturePhoto(source: "camera" | "photos" = "camera"): Promise<CapturedPhoto | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
      saveToGallery: false,
      promptLabelHeader: "Evidence photo",
    });

    if (!photo.webPath) return null;

    // Read the captured file back as a Blob → File for upload.
    const res = await fetch(photo.webPath);
    const blob = await res.blob();
    const ext = (photo.format || "jpeg").replace("jpg", "jpeg");
    const mime = blob.type || `image/${ext}`;
    const file = new File([blob], `evidence-${Date.now()}.${ext === "jpeg" ? "jpg" : ext}`, { type: mime });

    return { file, previewUrl: photo.webPath };
  } catch (err) {
    // User cancelled or permission denied — caller treats null as "no photo".
    if (err && typeof err === "object" && "message" in err) {
      const msg = String((err as { message: unknown }).message);
      if (/cancel/i.test(msg)) return null;
    }
    return null;
  }
}
