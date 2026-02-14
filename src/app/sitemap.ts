import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cxo-letter.jp'

  return [
    {
      url: baseUrl,
      lastModified: new Date('2025-02-14'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/new`,
      lastModified: new Date('2025-02-14'),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date('2025-01-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date('2024-12-01'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2024-12-01'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/tokusho`,
      lastModified: new Date('2024-12-01'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ]
}
