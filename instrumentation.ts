export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast on startup if the environment is misconfigured.
    await import("./lib/env");
  }
}
