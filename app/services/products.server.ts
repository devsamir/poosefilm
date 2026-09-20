import { Prisma } from "@prisma/client";

import { prisma } from "~/services/prisma.server";
import { isProductKind, type ProductKind } from "~/utils/product-kind";

export const PRODUCT_DESCRIPTION_MAX_LENGTH = 255;

export type ProductInput = { name: string; price: string; kind: string; description?: string; isActive?: boolean };

export function validateProductPrice(value: string) {
  if (!/^\d+$/.test(value.trim()) || Number(value) <= 0) {
    throw new Error("Harga harus berupa bilangan bulat positif.");
  }
  return Number(value);
}

export function normalizeProductInput(input: ProductInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Nama wajib diisi.");
  if (!isProductKind(input.kind)) throw new Error("Tipe product tidak valid.");
  const description = (input.description ?? "").trim();
  if (description.length > PRODUCT_DESCRIPTION_MAX_LENGTH) throw new Error(`Keterangan maksimal ${PRODUCT_DESCRIPTION_MAX_LENGTH} karakter.`);
  return { name, price: validateProductPrice(input.price), kind: input.kind, description: description || null, isActive: input.isActive ?? true };
}

function serializeProduct(product: { id: number; name: string; price: Prisma.Decimal; kind: ProductKind; description: string | null; isActive: boolean }) {
  return { id: product.id, name: product.name, price: Number(product.price), kind: product.kind, description: product.description, isActive: product.isActive };
}

function rethrowDuplicateName(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("Nama product sudah dipakai.");
  throw error;
}

export async function listProducts() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return products.map(serializeProduct);
}

export async function listActiveProducts() {
  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return products.map(serializeProduct);
}

export type ProductFilters = { q: string; kind: string; status: string };

/** Builds the Prisma where for the master list; an unknown kind or status means no filter. */
export function buildProductsWhere({ q, kind, status }: ProductFilters) {
  const search = q.trim();
  return {
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { description: { contains: search, mode: "insensitive" as const } }] } : {}),
    ...(isProductKind(kind) ? { kind } : {}),
    ...(status === "ACTIVE" ? { isActive: true } : status === "INACTIVE" ? { isActive: false } : {}),
  };
}

export async function searchProducts(filters: ProductFilters) {
  const products = await prisma.product.findMany({ where: buildProductsWhere(filters), orderBy: { name: "asc" } });
  return products.map(serializeProduct);
}

export async function createProduct(input: ProductInput) {
  const data = normalizeProductInput(input);
  try {
    return serializeProduct(await prisma.product.create({ data }));
  } catch (error) {
    return rethrowDuplicateName(error);
  }
}

export async function updateProduct(id: number, input: ProductInput) {
  const data = normalizeProductInput(input);
  try {
    return serializeProduct(await prisma.product.update({ where: { id }, data }));
  } catch (error) {
    return rethrowDuplicateName(error);
  }
}

export async function setProductActive(id: number, isActive: boolean) {
  return serializeProduct(await prisma.product.update({ where: { id }, data: { isActive } }));
}
