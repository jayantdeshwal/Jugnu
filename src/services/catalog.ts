import { CATEGORIES, MUZAFFARNAGAR_PINCODES } from '@kaamgar/shared'
import { getSupabaseClient } from '@/lib/supabase'

export interface CatalogCategory {
  id: string
  name_en: string
  name_hi: string
  icon: string
  sort_order: number
}

export interface ServiceArea {
  id: string
  district: string
  locality: string
  pincode: string
}

export interface PublicCatalog {
  categories: CatalogCategory[]
  serviceAreas: ServiceArea[]
}

export const fallbackCatalog: PublicCatalog = {
  categories: CATEGORIES.map((category, index) => ({
    ...category,
    sort_order: index + 1,
  })),
  serviceAreas: MUZAFFARNAGAR_PINCODES.map((pincode, index) => ({
    id: `fallback-${pincode}`,
    district: 'Muzaffarnagar',
    locality: index === 0 ? 'City' : 'Cantt',
    pincode,
  })),
}

export async function fetchPublicCatalog(): Promise<PublicCatalog> {
  const supabase = getSupabaseClient()
  const [{ data: categories, error: categoriesError }, { data: serviceAreas, error: areasError }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('id, name_en, name_hi, icon, sort_order')
        .order('sort_order'),
      supabase
        .from('service_areas')
        .select('id, district, locality, pincode')
        .order('pincode'),
    ])

  if (categoriesError) throw categoriesError
  if (areasError) throw areasError

  // Merge database categories with fallback list so new categories appear immediately
  const dbCategories = categories ?? []
  const existingIds = new Set(dbCategories.map((c: any) => c.id))
  const mergedCategories = [
    ...dbCategories,
    ...fallbackCatalog.categories.filter(c => !existingIds.has(c.id)),
  ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return {
    categories: mergedCategories,
    serviceAreas: serviceAreas ?? fallbackCatalog.serviceAreas,
  }
}
