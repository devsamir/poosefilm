import { prisma } from "~/services/prisma.server";
import { expandPackageFilters, generateFilterCss, validateFilterValues, type FilterValueInput } from "~/utils/filter-domain";

export type FilterTemplateInput = { name: string; previewColor?: string; values: FilterValueInput[]; isActive?: boolean };
export type FilterPackageInput = { name: string; filterTemplateIds: number[]; isActive?: boolean };

function normalizeName(name: string) {
  const normalized = name.trim();
  if (!normalized) throw new Error("Nama wajib diisi.");
  return normalized;
}

export function normalizePackageFilterIds(ids: number[]) {
  const normalized = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (!normalized.length) throw new Error("Paket harus memiliki minimal satu filter.");
  if (new Set(normalized).size !== normalized.length) throw new Error("Filter paket tidak boleh duplikat.");
  return normalized;
}

function serializeFilterTemplate(template: { id: number; name: string; previewColor: string | null; isActive: boolean; values: Array<{ filterType: string; value: string }> }) {
  const values = validateFilterValues(template.values.map((value) => ({ filterType: value.filterType, value: value.value })));
  return { ...template, values, css: generateFilterCss(values) };
}

export async function listFilterTemplates() {
  const templates = await prisma.filterTemplate.findMany({ include: { values: true }, orderBy: { createdAt: "desc" } });
  return templates.map(serializeFilterTemplate);
}

export async function createFilterTemplate(input: FilterTemplateInput) {
  const name = normalizeName(input.name);
  const values = validateFilterValues(input.values);
  return prisma.filterTemplate.create({ data: { name, previewColor: input.previewColor || "#FFFFFF", isActive: input.isActive ?? true, values: { create: values.map((value) => ({ filterType: value.filterType, value: value.value })) } }, include: { values: true } });
}

export async function updateFilterTemplate(id: number, input: FilterTemplateInput) {
  const name = normalizeName(input.name);
  const values = validateFilterValues(input.values);
  return prisma.$transaction(async (transaction) => {
    await transaction.filterTemplateValue.deleteMany({ where: { templateId: id } });
    return transaction.filterTemplate.update({ where: { id }, data: { name, previewColor: input.previewColor || "#FFFFFF", isActive: input.isActive ?? true, values: { create: values.map((value) => ({ filterType: value.filterType, value: value.value })) } }, include: { values: true } });
  });
}

export async function deleteFilterTemplate(id: number) {
  const [packageCount, snapshotCount] = await Promise.all([
    prisma.filterPackageItem.count({ where: { filterTemplateId: id } }),
    prisma.orderFilterSnapshot.count({ where: { filterTemplateId: id } }),
  ]);
  if (packageCount || snapshotCount) throw new Error("Filter sudah dipakai dan tidak dapat dihapus. Nonaktifkan filter ini saja.");
  return prisma.filterTemplate.delete({ where: { id } });
}

function serializeFilterPackage(packageData: { id: number; name: string; isActive: boolean; items: Array<{ sortOrder: number; filterTemplate: { id: number; name: string; values: Array<{ filterType: string; value: string }> } }> }) {
  const filters = packageData.items.sort((left, right) => left.sortOrder - right.sortOrder).map((item) => ({ id: item.filterTemplate.id, name: item.filterTemplate.name, css: generateFilterCss(validateFilterValues(item.filterTemplate.values.map((value) => ({ filterType: value.filterType, value: value.value })))) }));
  return { id: packageData.id, name: packageData.name, isActive: packageData.isActive, filters, snapshots: expandPackageFilters(filters) };
}

const packageInclude = { items: { include: { filterTemplate: { include: { values: true } }, }, orderBy: { sortOrder: "asc" as const } } };

export async function listFilterPackages() {
  const packages = await prisma.filterPackage.findMany({ include: packageInclude, orderBy: { createdAt: "desc" } });
  return packages.map(serializeFilterPackage);
}

export async function getActiveFilterPackages() {
  const packages = await prisma.filterPackage.findMany({ where: { isActive: true }, include: packageInclude, orderBy: { name: "asc" } });
  return packages.map(serializeFilterPackage);
}

export async function createFilterPackage(input: FilterPackageInput) {
  const name = normalizeName(input.name);
  const filterTemplateIds = normalizePackageFilterIds(input.filterTemplateIds);
  return prisma.filterPackage.create({ data: { name, isActive: input.isActive ?? true, items: { create: filterTemplateIds.map((filterTemplateId, sortOrder) => ({ filterTemplateId, sortOrder })) } }, include: packageInclude });
}

export async function updateFilterPackage(id: number, input: FilterPackageInput) {
  const name = normalizeName(input.name);
  const filterTemplateIds = normalizePackageFilterIds(input.filterTemplateIds);
  return prisma.$transaction(async (transaction) => {
    await transaction.filterPackageItem.deleteMany({ where: { packageId: id } });
    return transaction.filterPackage.update({ where: { id }, data: { name, isActive: input.isActive ?? true, items: { create: filterTemplateIds.map((filterTemplateId, sortOrder) => ({ filterTemplateId, sortOrder })) } }, include: packageInclude });
  });
}

export async function deleteFilterPackage(id: number) {
  const orderCount = await prisma.order.count({ where: { filterPackageId: id } });
  if (orderCount) throw new Error("Paket sudah dipakai oleh order. Nonaktifkan paket ini saja.");
  return prisma.filterPackage.delete({ where: { id } });
}
