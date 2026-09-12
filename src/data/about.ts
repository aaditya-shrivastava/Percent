const aboutImage = (id: string, alt: string, width = 1600, height = 1000) => ({
  src: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`,
  alt,
  width,
  height,
})

export const aboutValues = ['Exclusivity', 'Uniqueness', 'Quality', 'Rarity']

export const aboutCollaborators = [
  '% North',
  'Studio 27',
  'Form / 01',
  'Atelier Rare',
  'Common Ground',
]

export const aboutImages = {
  live: aboutImage('photo-1515886657613-9f3515b0c78f', 'Percent fashion campaign in the city', 1800, 1100),
  craft: aboutImage('photo-1521572163474-6864f9cf17ab', 'Premium t-shirts prepared with care', 1800, 850),
  identity: aboutImage('photo-1496747611176-843222e1e57c', 'Editorial Percent lifestyle portrait', 1200, 1400),
}
