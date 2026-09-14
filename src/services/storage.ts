import { getSupabaseClient } from '@/lib/supabase'

export interface FileValidationOptions {
  maxSizeMb?: number
  allowedTypes?: string[]
}

const DEFAULT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const DEFAULT_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/**
 * Validates a file against allowed MIME types and maximum size in MB.
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  const maxSizeMb = options.maxSizeMb ?? 5
  const allowedTypes = options.allowedTypes ?? DEFAULT_IMAGE_TYPES

  if (file.size > maxSizeMb * 1024 * 1024) {
    return {
      valid: false,
      error: `File size must be under ${maxSizeMb} MB (selected: ${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    }
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    const extensions = allowedTypes
      .map(t => t.split('/')[1]?.toUpperCase() || t)
      .join(', ')
    return {
      valid: false,
      error: `Invalid file format. Allowed types: ${extensions}`,
    }
  }

  return { valid: true }
}

/**
 * Uploads a profile avatar to the public 'avatars' storage bucket.
 * Returns the public CDN URL of the uploaded image.
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const validation = validateFile(file, { maxSizeMb: 5, allowedTypes: DEFAULT_IMAGE_TYPES })
  if (!validation.valid) throw new Error(validation.error)

  const supabase = getSupabaseClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filePath = `${userId}/avatar-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) {
    throw new Error(`Failed to upload avatar: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
  return data.publicUrl
}

/**
 * Uploads a sensitive ID verification document to the private 'worker-documents' bucket.
 * Returns the storage path reference for secure signed access.
 */
export async function uploadIdProof(file: File, userId: string): Promise<string> {
  const validation = validateFile(file, { maxSizeMb: 10, allowedTypes: DEFAULT_DOCUMENT_TYPES })
  if (!validation.valid) throw new Error(validation.error)

  const supabase = getSupabaseClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filePath = `${userId}/id-proof-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('worker-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) {
    throw new Error(`Failed to upload ID proof: ${uploadError.message}`)
  }

  return filePath
}

/**
 * Generates a short-lived signed URL for an administrator or document owner
 * to securely view a private document from the 'worker-documents' bucket.
 */
export async function getIdProofSignedUrl(
  pathOrUrl: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  if (!pathOrUrl) return null

  // If already a full signed URL or blob, return directly
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    if (pathOrUrl.includes('token=')) return pathOrUrl
  }

  const supabase = getSupabaseClient()
  // Clean path in case full storage URL was stored
  const cleanPath = pathOrUrl.replace(/^.*\/worker-documents\//, '')

  const { data, error } = await supabase.storage
    .from('worker-documents')
    .createSignedUrl(cleanPath, expiresInSeconds)

  if (error) {
    console.warn('Error generating signed URL for worker document:', error.message)
    return null
  }

  return data.signedUrl
}
