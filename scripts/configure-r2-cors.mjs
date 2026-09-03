import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const requiredKeys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
const missingKeys = requiredKeys.filter((key) => !process.env[key]);
if (missingKeys.length) throw new Error(`Missing R2 configuration: ${missingKeys.join(", ")}`);

const origins = (process.env.R2_CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,https://pos.poosebox.id")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

await client.send(new PutBucketCorsCommand({
  Bucket: process.env.R2_BUCKET_NAME,
  CORSConfiguration: {
    CORSRules: [{ AllowedOrigins: origins, AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 }],
  },
}));

console.log(`R2 CORS configured for ${origins.join(", ")}`);
