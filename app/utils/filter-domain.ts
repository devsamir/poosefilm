export type FilterType = "grayscale" | "sepia" | "blur" | "brightness" | "hue-rotate" | "saturate" | "opacity" | "contrast" | "invert";

export type FilterValueInput = {
  filterType: string;
  value: string;
};

export type FilterSnapshotInput = {
  filterId: number;
  filterName: string;
  css: string;
  sortOrder: number;
};

type FilterConfig = { defaultValue: string; min: number; max: number; unit: "%" | "px" | "deg" };

export const FILTER_CONFIGS: Record<FilterType, FilterConfig> = {
  grayscale: { defaultValue: "0%", min: 0, max: 100, unit: "%" },
  sepia: { defaultValue: "0%", min: 0, max: 100, unit: "%" },
  blur: { defaultValue: "0px", min: 0, max: 20, unit: "px" },
  brightness: { defaultValue: "100%", min: 0, max: 200, unit: "%" },
  "hue-rotate": { defaultValue: "0deg", min: 0, max: 360, unit: "deg" },
  saturate: { defaultValue: "100%", min: 0, max: 200, unit: "%" },
  opacity: { defaultValue: "100%", min: 0, max: 100, unit: "%" },
  contrast: { defaultValue: "100%", min: 0, max: 200, unit: "%" },
  invert: { defaultValue: "0%", min: 0, max: 100, unit: "%" },
};

export const SUPPORTED_FILTER_TYPES = Object.keys(FILTER_CONFIGS) as FilterType[];

function parseFilterValue(value: string, config: FilterConfig) {
  const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(%|px|deg)$/);
  if (!match) throw new Error("Nilai filter tidak valid.");
  const number = Number(match[1]);
  const unit = match[2];
  if (unit !== config.unit || number < config.min || number > config.max) throw new Error("Nilai filter berada di luar batas.");
  return `${number}${unit}`;
}

export function validateFilterValues(values: FilterValueInput[]) {
  const seen = new Set<FilterType>();
  return values.map((value) => {
    if (!SUPPORTED_FILTER_TYPES.includes(value.filterType as FilterType)) throw new Error("Tipe filter tidak didukung.");
    const filterType = value.filterType as FilterType;
    if (seen.has(filterType)) throw new Error("Tipe filter tidak boleh duplikat.");
    seen.add(filterType);
    return { filterType, value: parseFilterValue(value.value, FILTER_CONFIGS[filterType]) };
  });
}

export function generateFilterCss(values: FilterValueInput[]) {
  const overrides = Object.fromEntries(validateFilterValues(values).map((value) => [value.filterType, value.value])) as Partial<Record<FilterType, string>>;
  return SUPPORTED_FILTER_TYPES.map((type) => `${type}(${overrides[type] || FILTER_CONFIGS[type].defaultValue})`).join(" ");
}

export function expandPackageFilters(filters: Array<{ id: number; name: string; css: string }>): FilterSnapshotInput[] {
  return filters.map((filter, sortOrder) => ({ filterId: filter.id, filterName: filter.name, css: filter.css, sortOrder }));
}
