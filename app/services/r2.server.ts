import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

let client: S3Client | undefined;

function getConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error("Cloudflare R2 belum dikonfigurasi.");
  return { bucket, accountId, accessKeyId, secretAccessKey };
}

function getClient() {
  const config = getConfig();
  client ||= new S3Client({ endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`, region: "auto", credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  return { client, bucket: config.bucket };
}

export async function createPresignedPutUrl(input: { key: string; contentType: string; expiresIn?: number }) {
  const { client: r2Client, bucket } = getClient();
  const expiresIn = input.expiresIn || 900;
  const command = new PutObjectCommand({ Bucket: bucket, Key: input.key, ContentType: input.contentType });
  return { uploadUrl: await getSignedUrl(r2Client, command, { expiresIn }), expiresIn };
}

export async function assertObjectExists(key: string) {
  const { client: r2Client, bucket } = getClient();
  await r2Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getObjectBuffer(key: string) {
  const { client: r2Client, bucket } = getClient();
  const response = await r2Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error("Object R2 tidak memiliki isi.");
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function getObjectStream(key: string) {
  const { client: r2Client, bucket } = getClient();
  const response = await r2Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error("Object R2 tidak memiliki isi.");
  // Body is a Node Readable because getClient() uses the default NodeHttpHandler (no custom requestHandler configured).
  return response.Body as Readable;
}

export async function putObject(input: { key: string; body: Buffer; contentType: string }) {
  const { client: r2Client, bucket } = getClient();
  await r2Client.send(new PutObjectCommand({ Bucket: bucket, Key: input.key, Body: input.body, ContentType: input.contentType, ContentLength: input.body.byteLength }));
}

export async function deleteObject(key: string) {
  const { client: r2Client, bucket } = getClient();
  await r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function isMissingObjectError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown; Code?: unknown; statusCode?: unknown; $metadata?: { httpStatusCode?: unknown } };
  const names = [candidate.name, candidate.code, candidate.Code].filter(Boolean).map(String);
  return names.includes("NoSuchKey") || names.includes("NotFound") || candidate.statusCode === 404 || candidate.$metadata?.httpStatusCode === 404;
}

export async function deleteObjectIfPresent(key: string) {
  try {
    await deleteObject(key);
  } catch (error) {
    if (!isMissingObjectError(error)) throw error;
  }
}

export async function createPresignedGetUrl(input: { key: string; contentType: string; originalName: string; download?: boolean }) {
  const { client: r2Client, bucket } = getClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: input.key, ResponseContentType: input.contentType, ...(input.download ? { ResponseContentDisposition: `attachment; filename="${input.originalName.replace(/[^a-zA-Z0-9._-]/g, "-")}"` } : {}) });
  return getSignedUrl(r2Client, command, { expiresIn: 300 });
}
