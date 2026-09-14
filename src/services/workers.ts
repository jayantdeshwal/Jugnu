import { getSupabaseClient } from '@/lib/supabase'

export interface PublicWorker {
  id: string
  name: string
  avatar: string | null
  bio: string
  experience: number
  rating: number
  reviews: number
  available: boolean
  categories: string[]
  areas: string[]
  verified: true
}

interface DirectoryWorkerRow {
  id: string
  name: string
  avatar: string | null
  bio: string
  experience: number
  rating: number
  reviews: number
  available: boolean
  categories: string[] | null
  areas: string[] | null
}

export async function fetchApprovedWorkers(): Promise<PublicWorker[]> {
  const { data, error } = await getSupabaseClient()
    .from('approved_worker_directory')
    .select('id, name, avatar, bio, experience, rating, reviews, available, categories, areas')
    .order('rating', { ascending: false })

  if (error) throw error

  return (data ?? []).map((worker: any) => ({
    ...worker,
    rating: Number(worker.rating ?? 0),
    reviews: Number(worker.reviews ?? 0),
    experience: Number(worker.experience ?? 0),
    categories: worker.categories ?? [],
    areas: worker.areas ?? [],
    verified: true,
  }))
}

export async function fetchApprovedWorker(workerId: string): Promise<PublicWorker | null> {
  const { data, error } = await getSupabaseClient()
    .from('approved_worker_directory')
    .select('id, name, avatar, bio, experience, rating, reviews, available, categories, areas')
    .eq('id', workerId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const worker = data as unknown as DirectoryWorkerRow

  return {
    ...worker,
    rating: Number(worker.rating ?? 0),
    reviews: Number(worker.reviews ?? 0),
    experience: Number(worker.experience ?? 0),
    categories: worker.categories ?? [],
    areas: worker.areas ?? [],
    verified: true,
  } as PublicWorker
}
