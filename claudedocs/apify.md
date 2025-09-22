// Apify Google Maps Scraper Integration
// Заменяет Firecrawl для более точного парсинга организаций

export interface ApifyResult {
  title: string
  address: string
  website: string
  phone: string
  email?: string
  description: string
  category: string
  placeId: string
  latitude: number
  longitude: number
  isVerified: boolean
  totalScore: number
  reviewsCount: number
}

export interface ApifySearchParams {
  searchStringsArray: string[]
  locationQuery?: string
  maxCrawledPlacesPerSearch: number
  language: string
  exportPlaceUrls: boolean
  scrapeDirectEmailAndPhone: boolean
  skipClosedPlaces: boolean
}

const APIFY_API_KEY = process.env.APIFY_API_TOKEN // Server-side environment variable
const GOOGLE_MAPS_SCRAPER_ID = 'nwua9Gu5YrADL7ZDj' // compass/crawler-google-places

// Запустить Apify Google Maps Scraper
export async function startApifyGoogleMapsScraping(params: ApifySearchParams): Promise<string> {
  console.log(`🚀 Starting Apify Google Maps scraping with ${params.searchStringsArray.length} queries`)
  
  // Debug: log the exact request being made
  const url = `https://api.apify.com/v2/acts/${GOOGLE_MAPS_SCRAPER_ID}/runs?token=${APIFY_API_KEY}`
  console.log(`🔗 Apify URL: ${url}`)
  console.log(`📦 Apify params:`, JSON.stringify(params, null, 2))
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Apify scraping failed: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()
  console.log(`✅ Apify run started with ID: ${data.data.id}`)
  
  return data.data.id
}

// Проверить статус выполнения
export async function checkApifyRunStatus(runId: string): Promise<{ status: string; defaultDatasetId?: string }> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`)

  if (!response.ok) {
    throw new Error(`Failed to check Apify run status: ${response.statusText}`)
  }

  const data = await response.json()
  return {
    status: data.data.status,
    defaultDatasetId: data.data.defaultDatasetId
  }
}

// Получить результаты из датасета
export async function getApifyResults(datasetId: string): Promise<ApifyResult[]> {
  console.log(`📥 Fetching results from dataset: ${datasetId}`)
  
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`)

  if (!response.ok) {
    throw new Error(`Failed to get Apify results: ${response.statusText}`)
  }

  const results = await response.json()
  console.log(`📊 Retrieved ${results.length} results from Apify`)
  
  return results.map((item: any) => ({
    title: item.title || item.name || 'Unknown',
    address: item.address || '',
    website: item.website || item.url || '',
    phone: item.phone || item.phoneNumber || '',
    email: item.email || '',
    description: item.description || item.about || '',
    category: item.categoryName || item.category || '',
    placeId: item.placeId || '',
    latitude: item.latitude || 0,
    longitude: item.longitude || 0,
    isVerified: item.isVerified || false,
    totalScore: item.totalScore || 0,
    reviewsCount: item.reviewsCount || 0
  }))
}

// Ожидать завершения задачи
export async function waitForApifyCompletion(runId: string, maxWaitMinutes: number = 10): Promise<ApifyResult[]> {
  const maxAttempts = maxWaitMinutes * 6 // 10 секунд между проверками
  let attempts = 0

  while (attempts < maxAttempts) {
    const { status, defaultDatasetId } = await checkApifyRunStatus(runId)
    console.log(`⏳ Apify status: ${status} (${attempts}/${maxAttempts})`)
    
    if (status === 'SUCCEEDED' && defaultDatasetId) {
      return await getApifyResults(defaultDatasetId)
    }
    
    if (status === 'FAILED') {
      throw new Error('Apify scraping failed')
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000)) // 10 секунд
    attempts++
  }
  
  throw new Error(`Apify scraping timed out after ${maxWaitMinutes} minutes`)
}

// Главная функция для парсинга организаций через Apify
export async function scrapeOrganizationsWithApify(
  searchQueries: string[],
  location: string,
  maxResults: number = 50
): Promise<ApifyResult[]> {
  
  const params: ApifySearchParams = {
    searchStringsArray: searchQueries,
    locationQuery: location,
    maxCrawledPlacesPerSearch: Math.ceil(maxResults / searchQueries.length * 1.5), // Немного больше для фильтрации
    language: 'en',
    exportPlaceUrls: true,
    scrapeDirectEmailAndPhone: true,
    skipClosedPlaces: true
  }
  
  console.log(`🎯 Apify search: ${searchQueries.length} queries in ${location}`)
  searchQueries.forEach((q, i) => console.log(`   ${i+1}. "${q}"`))
  
  const runId = await startApifyGoogleMapsScraping(params)
  const results = await waitForApifyCompletion(runId, 15) // 15 минут ожидания
  
  // Фильтруем результаты с email адресами
  const resultsWithEmails = results.filter(r => r.email && r.email.includes('@'))
  console.log(`✅ Apify completed: ${resultsWithEmails.length}/${results.length} with emails`)
  
  return resultsWithEmails.slice(0, maxResults)
}