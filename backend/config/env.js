import { z } from "zod"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()
dotenv.config({ path: path.join(__dirname, "../.env") })

const envSchema = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("5000"),
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .default("mongodb://127.0.0.1:27017/yatrahub"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  TOTP_ENC_KEY: z
    .string()
    .min(32, "TOTP_ENC_KEY must be at least 32 characters long")
    .optional(),
  DATA_ENC_KEY: z
    .string()
    .min(32, "DATA_ENC_KEY must be at least 32 characters long")
    .optional(),
  FRONTEND_URL: z
    .string()
    .url()
    .default("http://localhost:5173"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  EMAIL_SERVICE: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
})

const insecureSecrets = [
  "secret",
  "your_jwt_secret",
  "your_jwt_secret_key_here",
  "changeme",
  "default_secret",
  "12345678",
  "secretkey",
]

export function validateEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n  - ")
    console.error(`FATAL: Environment configuration validation failed:\n  - ${errorDetails}`)
    process.exit(1)
  }

  if (insecureSecrets.includes(result.data.JWT_SECRET.toLowerCase())) {
    console.error("FATAL: JWT_SECRET is set to an insecure default value.")
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()
export default env
