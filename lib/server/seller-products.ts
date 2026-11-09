import 'server-only'
import { z } from 'zod'
import { kobo, optionalText, text, toIso } from '@/lib/api/guard'
import { UNITS } from '@/lib/server/catalog'

// Seller product management (My Products, Add/Edit Product).

export const productSchema = z.object({
  name: text(80, 2),
  categoryId: text(100),
  priceKobo: kobo.min(100, 'Minimum price is ₦1'),
  compareAtPriceKobo: kobo.nullable().optional(),
  unit: z.enum(UNITS),
  stock: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
  description: optionalText(500),
  photoFileIds: z.array(z.string().max(100)).max(6).optional(),
  menuSectionId: z.string().max(100).nullable().optional(),
  prepMinutes: z.number().int().min(1).max(240).optional(),
  farmType: z.enum(['organic', 'local', 'imported']).optional(),
  highlights: z.array(text(60)).max(6).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
})

export function presentSellerProduct(id: string, p: FirebaseFirestore.DocumentData) {
  const lowStockThreshold = p.lowStockThreshold ?? 3
  return {
    id,
    name: p.name,
    categoryId: p.categoryId,
    priceKobo: p.priceKobo,
    compareAtPriceKobo: p.compareAtPriceKobo ?? null,
    unit: p.unit,
    stock: p.stock,
    lowStockThreshold,
    isLowStock: p.stock <= lowStockThreshold,
    soldCount: p.soldCount ?? 0,
    description: p.description ?? null,
    photos: (p.photos ?? []).map((photo: { url: string; fileId: string }) => ({ fileId: photo.fileId, url: photo.url })),
    menuSectionId: p.menuSectionId ?? null,
    prepMinutes: p.prepMinutes ?? null,
    farmType: p.farmType ?? null,
    highlights: p.highlights ?? [],
    status: p.status,
    rating: p.rating ?? null,
    ratingCount: p.ratingCount ?? 0,
    createdAt: toIso(p.createdAt),
    updatedAt: toIso(p.updatedAt),
  }
}
