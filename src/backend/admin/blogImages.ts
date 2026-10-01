export type BlogImageRole = 'primary' | 'secondary'
export type BlogImageState = { role: BlogImageRole }

export function mergeBlogImagesForSave<T extends BlogImageState>(current: T[], existing: T[], removedRoles: ReadonlySet<BlogImageRole>): T[] {
  const intended = new Map<BlogImageRole, T>()
  for (const image of current) intended.set(image.role, image)
  for (const image of existing) {
    if (!intended.has(image.role) && !removedRoles.has(image.role)) intended.set(image.role, image)
  }
  return (['primary', 'secondary'] as const).flatMap(role => intended.has(role) ? [intended.get(role)!] : [])
}
