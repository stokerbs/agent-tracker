export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEncryptionKeys } = await import("./lib/security/encryption");
    validateEncryptionKeys();
  }
}
