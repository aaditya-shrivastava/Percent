import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePercentSession, type PercentSessionUser } from '../../hooks/usePercentSession'
import type { ProductImage, ProductReview } from '../../types'

const MAX_IMAGES = 3
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_TITLE_LENGTH = 100
const MAX_REVIEW_LENGTH = 1200
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const submittedReviewKeys = new Set<string>()

interface SelectedImage {
  file: File
  previewUrl: string
}

interface ReviewErrors {
  rating?: string
  comment?: string
  images?: string
}

interface ProductReviewsProps {
  productSlug: string
  initialReviews: ProductReview[]
  onSummaryChange?: (summary: { averageRating: number; reviewCount: number }) => void
}

function Stars({ rating }: { rating: number }) {
  return <span className="pdp-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < Math.round(rating) ? 'currentColor' : 'none'} />)}</span>
}

function reviewDateLabel(date: string) {
  const parsed = new Date(date)
  if (Date.now() - parsed.getTime() < 60_000) return 'Just now'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}

function RatingSelector({ value, error, onChange }: { value: number; error?: string; onChange: (rating: number) => void }) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const choose = (rating: number) => {
    onChange(rating)
    buttons.current[rating - 1]?.focus()
  }
  return <fieldset className="review-rating-field" aria-invalid={Boolean(error)} aria-describedby={error ? 'review-rating-error' : undefined}>
    <legend>Rating <span>Required</span></legend>
    <div className="review-rating-selector">
      {Array.from({ length: 5 }, (_, index) => {
        const rating = index + 1
        return <button ref={(element) => { buttons.current[index] = element }} key={rating} type="button" className={rating <= value ? 'is-selected' : ''} aria-label={`${rating} ${rating === 1 ? 'star' : 'stars'}`} aria-pressed={rating === value} onClick={() => choose(rating)} onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); choose(value >= 5 ? 1 : Math.max(1, value + 1)) }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); choose(value <= 1 ? 5 : value - 1) }
        }}><Star /></button>
      })}
    </div>
    {error && <span className="review-field-error" id="review-rating-error" role="alert">{error}</span>}
  </fieldset>
}

function ReviewForm({ productSlug, user, onSubmitted, onClose }: { productSlug: string; user: PercentSessionUser; onSubmitted: (review: ProductReview) => void; onClose: () => void }) {
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [images, setImages] = useState<SelectedImage[]>([])
  const [errors, setErrors] = useState<ReviewErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const generatedUrls = useRef(new Set<string>())

  useEffect(() => () => { generatedUrls.current.forEach((url) => URL.revokeObjectURL(url)) }, [])

  const removeImage = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl)
    generatedUrls.current.delete(previewUrl)
    setImages((current) => current.filter((image) => image.previewUrl !== previewUrl))
    setErrors((current) => ({ ...current, images: undefined }))
  }

  const selectImages = (files: FileList | null) => {
    if (!files) return
    const nextFiles = Array.from(files)
    let imageError: string | undefined
    if (images.length + nextFiles.length > MAX_IMAGES) imageError = `Choose up to ${MAX_IMAGES} images per review.`
    const remainingSlots = Math.max(0, MAX_IMAGES - images.length)
    const valid = nextFiles.slice(0, remainingSlots).filter((file) => {
      if (!acceptedImageTypes.has(file.type)) { imageError = 'Use JPG, PNG, or WEBP images only.'; return false }
      if (file.size > MAX_IMAGE_SIZE) { imageError = `${file.name} is larger than 5 MB.`; return false }
      return true
    }).map((file) => {
      const previewUrl = URL.createObjectURL(file)
      generatedUrls.current.add(previewUrl)
      return { file, previewUrl }
    })
    setImages((current) => [...current, ...valid])
    setErrors((current) => ({ ...current, images: imageError }))
    if (fileInput.current) fileInput.current.value = ''
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors: ReviewErrors = {}
    if (!rating) nextErrors.rating = 'Choose a rating from 1 to 5 stars.'
    if (!comment.trim()) nextErrors.comment = 'Tell us what you think about this piece.'
    if (comment.trim().length > MAX_REVIEW_LENGTH) nextErrors.comment = `Keep your review under ${MAX_REVIEW_LENGTH} characters.`
    if (Object.keys(nextErrors).length) { setErrors((current) => ({ ...current, ...nextErrors })); return }

    const reviewKey = `${user.id}:${productSlug}`
    if (submittedReviewKeys.has(reviewKey)) { setErrors({ comment: 'You’ve already reviewed this product.' }); return }
    setSubmitting(true)
    await new Promise((resolve) => window.setTimeout(resolve, 520))
    const reviewImages: ProductImage[] = images.map(({ previewUrl }, index) => ({ id: `local-review-image-${index}`, src: previewUrl, alt: `${user.displayName}'s review image ${index + 1}`, width: 800, height: 800 }))
    const review: ProductReview = { id: `local-review-${Date.now()}`, rating, title: title.trim() || undefined, customerName: user.displayName, text: comment.trim(), date: new Date().toISOString(), images: reviewImages, status: 'published' }
    submittedReviewKeys.add(reviewKey)
    setSubmitting(false)
    onSubmitted(review)
  }

  return <form className="review-form" onSubmit={submit} noValidate>
    <header><div><p>Share your experience</p><h3>Write a Review</h3></div><button type="button" aria-label="Close review form" onClick={onClose}><X /></button></header>
    <RatingSelector value={rating} error={errors.rating} onChange={(nextRating) => { setRating(nextRating); setErrors((current) => ({ ...current, rating: undefined })) }} />
    <label className="review-field"><span>Review title <small>Optional</small></span><input type="text" value={title} maxLength={MAX_TITLE_LENGTH} placeholder="Great fit and fabric" onChange={(event) => setTitle(event.target.value)} /></label>
    <label className="review-field"><span>Review <small>Required</small></span><textarea value={comment} maxLength={MAX_REVIEW_LENGTH} rows={6} aria-invalid={Boolean(errors.comment)} aria-describedby={errors.comment ? 'review-comment-error' : 'review-comment-count'} placeholder="Tell us what you think about this piece…" onChange={(event) => { setComment(event.target.value); setErrors((current) => ({ ...current, comment: undefined })) }} />{errors.comment && <em className="review-field-error" id="review-comment-error" role="alert">{errors.comment}</em>}<small className="review-character-count" id="review-comment-count">{comment.length}/{MAX_REVIEW_LENGTH}</small></label>
    <div className="review-upload-field"><div><span>Product photos <small>Optional</small></span><p>Up to {MAX_IMAGES} JPG, PNG, or WEBP images · 5 MB each</p></div><input ref={fileInput} id="review-images" className="review-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => selectImages(event.target.files)} /><label className="review-upload-trigger" htmlFor="review-images"><ImagePlus /> Add photos</label>{errors.images && <span className="review-field-error" role="alert">{errors.images}</span>}</div>
    {images.length > 0 && <div className="review-image-previews" aria-label="Selected review images">{images.map((image) => <figure key={image.previewUrl}><img src={image.previewUrl} alt={`Preview of ${image.file.name}`} /><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removeImage(image.previewUrl)}><X /></button></figure>)}</div>}
    <footer><button type="button" className="review-cancel" onClick={onClose} disabled={submitting}>Cancel</button><button type="submit" className="review-submit-button" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Review'}</button></footer>
  </form>
}

export function ProductReviews({ productSlug, initialReviews, onSummaryChange }: ProductReviewsProps) {
  const location = useLocation()
  const { user, isAuthenticated } = usePercentSession()
  const [reviews, setReviews] = useState(initialReviews)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [success, setSuccess] = useState('')
  const reviewKey = user ? `${user.id}:${productSlug}` : ''
  const alreadyReviewed = Boolean(reviewKey && submittedReviewKeys.has(reviewKey))
  const averageRating = useMemo(() => reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0, [reviews])
  const currentReview = reviews[reviewIndex]
  const returnTo = `${location.pathname}#customer-reviews`

  const addReview = (review: ProductReview) => {
    setReviews((current) => {
      const next = [review, ...current]
      onSummaryChange?.({ averageRating: next.reduce((total, item) => total + item.rating, 0) / next.length, reviewCount: next.length })
      return next
    })
    setReviewIndex(0)
    setFormOpen(false)
    setSuccess('Thanks for your review.')
  }

  return <section className="pdp-reviews" id="customer-reviews">
    <header className="reviews-header"><div><p>Customer Reviews</p><h2 className="reviews-headline">Worn, lived in, remembered.</h2></div>{isAuthenticated ? <button className="reviews-submit" type="button" onClick={() => { setSuccess(''); setFormOpen(true) }} disabled={alreadyReviewed}>{alreadyReviewed ? 'Review Submitted' : 'Write a Review'}</button> : <Link className="reviews-submit" to={`/profile?returnTo=${encodeURIComponent(returnTo)}`}>Log in to write a review</Link>}</header>
    {success && <p className="review-success" role="status">{success}</p>}
    {alreadyReviewed && !success && <p className="review-duplicate" role="status">You’ve already reviewed this product.</p>}
    {formOpen && user && !alreadyReviewed && <ReviewForm productSlug={productSlug} user={user} onSubmitted={addReview} onClose={() => setFormOpen(false)} />}
    {reviews.length && currentReview ? <><div className="pdp-review-summary reviews-summary"><strong className="reviews-average">{averageRating.toFixed(1)}</strong><div><Stars rating={averageRating} /><span className="reviews-count">Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span></div></div><article className="pdp-review-card review-card"><Stars rating={currentReview.rating} />{currentReview.title && <h3 className="review-card-title">{currentReview.title}</h3>}<blockquote className="review-card-quote">“{currentReview.text}”</blockquote>{currentReview.images?.length ? <div className="review-card-images">{currentReview.images.map((image) => <a key={image.id ?? image.src} href={image.src} target="_blank" rel="noreferrer" aria-label={`Open ${image.alt}`}><img src={image.src} alt={image.alt} /></a>)}</div> : null}<div className="pdp-review-author review-card-author"><strong>{currentReview.customerName}</strong><time className="review-card-date" dateTime={currentReview.date}>{reviewDateLabel(currentReview.date)}</time></div></article>{reviews.length > 1 && <div className="pdp-review-controls reviews-controls"><button type="button" aria-label="Previous review" onClick={() => setReviewIndex((index) => (index - 1 + reviews.length) % reviews.length)}><ChevronLeft /></button><div>{reviews.map((review, index) => <button key={review.id} type="button" className={index === reviewIndex ? 'is-active' : ''} aria-label={`Show review ${index + 1}`} aria-pressed={index === reviewIndex} onClick={() => setReviewIndex(index)} />)}</div><button type="button" aria-label="Next review" onClick={() => setReviewIndex((index) => (index + 1) % reviews.length)}><ChevronRight /></button></div>}</> : <div className="pdp-no-reviews"><p>Be the first to review this design.</p>{isAuthenticated ? <button type="button" onClick={() => setFormOpen(true)}>Write a Review</button> : <Link to={`/profile?returnTo=${encodeURIComponent(returnTo)}`}>Log in to write a review</Link>}</div>}
  </section>
}
