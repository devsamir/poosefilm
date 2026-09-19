import { Prisma } from "@prisma/client";

import { prisma } from "~/services/prisma.server";
import type { ProductKind } from "~/utils/product-kind";

export type ProductInput = { name: string; price: string; isActive?: boolean };

export function validateProductPrice(value: string) {
  if (!/^\d+$/.test(value.trim()) || Number(value) <= 0) {
    throw new Error("Harga harus berupa bilangan bulat positif.");
  }
  return Number(value);
}

export function normalizeProductInput(input: ProductInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Nama wajib diisi.");
  return { name, price: validateProductPrice(input.price), isActive: input.isActive ?? true };
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
