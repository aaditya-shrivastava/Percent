export type InquiryType = 'Order Support' | 'Shipping & Delivery' | 'Returns & Exchanges' | 'Product & Sizing' | 'Payment Question' | 'General Inquiry'
export type FaqCategory = 'Orders' | 'Shipping' | 'Returns' | 'Sizing' | 'Payments' | 'Policies'

export interface FaqItem {
  id: string
  category: FaqCategory
  question: string
  answer: string
}

export const inquiryTypes: InquiryType[] = ['Order Support', 'Shipping & Delivery', 'Returns & Exchanges', 'Product & Sizing', 'Payment Question', 'General Inquiry']

export const supportTopics = [
  { title: 'Order Support', copy: 'Help with your order, tracking, or payment questions.' },
  { title: 'Shipping & Delivery', copy: 'Information about shipping and tracking.' },
  { title: 'Returns & Exchanges', copy: 'Questions about returns or exchange eligibility.' },
  { title: 'Product & Sizing', copy: 'Help with fit, products, and sizing.' },
]

export const faqCategories = ['All', 'Orders', 'Shipping', 'Returns', 'Sizing', 'Payments', 'Policies'] as const

export const faqItems: FaqItem[] = [
  { id: 'place-order', category: 'Orders', question: 'How do I place an order?', answer: 'Choose a product, select an available size and add it to your cart. The current checkout is a frontend preview; final payment processing will be enabled before launch.' },
  { id: 'change-order', category: 'Orders', question: 'Can I cancel or change my order?', answer: 'Cancellation and change eligibility will depend on the order’s fulfillment stage. The final cancellation process and timing will be confirmed before launch.' },
  { id: 'shipping-time', category: 'Shipping', question: 'How long does shipping take?', answer: 'Exact dispatch and delivery estimates will be finalized before launch. A delivery estimate will be shown during checkout when live fulfillment is connected.' },
  { id: 'track-order', category: 'Shipping', question: 'How can I track my order?', answer: 'Signed-in customers can open My Orders and select Track Order. Delhivery is the planned fulfillment partner; live carrier tracking is not connected in this frontend phase.' },
  { id: 'return-policy', category: 'Returns', question: 'What is your return policy?', answer: 'Return and exchange eligibility, windows and conditions will be finalized before launch. Contact support if you need help with a specific frontend demo order.' },
  { id: 'exchange-size', category: 'Returns', question: 'Can I exchange a size?', answer: 'Size exchange details will be finalized before launch and will remain subject to availability. Limited pieces may not always have replacement stock.' },
  { id: 'find-size', category: 'Sizing', question: 'How do I know my size?', answer: 'Open a product page and use its Size Guide before selecting a variant. Product measurements and fit guidance will help compare Standard Fit and Oversized Fit.' },
  { id: 'payment-methods', category: 'Payments', question: 'Which payment methods are accepted?', answer: 'Razorpay is the planned payment provider. Supported payment methods will be confirmed when the real checkout integration is enabled.' },
  { id: 'sold-out', category: 'Policies', question: 'What happens when a design sells out?', answer: 'Every limited Percent design is made in only 100 pieces. Once the 100th piece is sold, that design is permanently retired with no restocks or repeats.' },
]

export const policyCards = [
  { title: 'Shipping & Delivery', copy: 'Planned fulfillment, delivery estimates and tracking information.', href: '/policies/shipping' },
  { title: 'Returns & Exchanges', copy: 'Future-ready guidance for eligibility, returns and size exchanges.', href: '/policies/returns' },
  { title: 'Privacy Policy', copy: 'How Percent intends to handle account, order, payment and usage information.', href: '/policies/privacy' },
  { title: 'Terms & Conditions', copy: 'Plain-language storefront terms prepared for final pre-launch review.', href: '/policies/terms' },
]

export const supportHeroImage = {
  src: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1500&q=85',
  alt: 'Detailed view of premium apparel and fabric',
  width: 1500,
  height: 1000,
}
