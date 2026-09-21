import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Star } from 'lucide-react'
import { Avatar, Card, RatingStars } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchWorkerReviews, ReviewItem } from '@/services/reviews'

export default function WorkerReviews() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isWorker, isLoading: authLoading } = useAuth()
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [rating, setRating] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !isWorker) return
    let mounted = true
    const load = async () => {
      const supabase = getSupabaseClient()
      const [reviewItems, profileResult] = await Promise.all([
        fetchWorkerReviews(user.id),
        (supabase.from('worker_profiles') as any)
          .select('rating, review_count')
          .eq('id', user.id)
          .maybeSingle(),
      ])
      if (!mounted) return
      setReviews(reviewItems)
      setRating(Number(profileResult.data?.rating ?? 0))
      setReviewCount(Number(profileResult.data?.review_count ?? reviewItems.length))
      setIsLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [user?.id, isWorker])

  if (authLoading) return null
  if (!isWorker) return <Navigate to="/profile" replace />

  return (
    <div className="min-h-screen bg-semantic-bg-primary text-semantic-text-primary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="inline-flex items-center gap-1.5 text-sm text-semantic-text-secondary hover:text-semantic-text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back', 'Back')}
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400" />
            {t('profile.reviewsRatings', 'My Ratings & Reviews')}
          </h1>
          <div className="mt-3 flex items-center gap-4 text-sm text-semantic-text-secondary">
            {rating > 0 ? <RatingStars rating={rating} size="sm" showValue /> : <span>{t('profile.noRatingsYet', 'No ratings yet')}</span>}
            <span>{reviewCount} {t('common.reviews', 'Reviews')}</span>
          </div>
        </div>

        {isLoading ? (
          <p className="text-semantic-text-secondary">{t('common.loading', 'Loading...')}</p>
        ) : reviews.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-semantic-text-secondary">{t('profile.noReviewsYet', 'No ratings or reviews yet')}</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <Card key={review.id} className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={review.customer_name} src={review.customer_avatar ?? undefined} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold truncate">{review.customer_name}</p>
                      <span className="text-xs text-semantic-text-tertiary">
                        {new Date(review.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <RatingStars rating={review.rating} size="sm" />
                    {review.comment && <p className="mt-3 text-sm text-semantic-text-secondary">{review.comment}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
