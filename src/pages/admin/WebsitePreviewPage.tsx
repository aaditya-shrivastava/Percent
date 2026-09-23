import { useEffect, useState, type MouseEvent } from 'react'
import { StorefrontBootstrap } from '../../components/layout/StorefrontBootstrap'
import { WebsiteContentProvider, useWebsiteContent } from '../../components/layout/WebsiteContentContext'
import { Header } from '../../components/layout/Header'
import { Footer } from '../../components/layout/Footer'
import { HomePage } from '../HomePage'
import type { WebsiteDocument } from '../../backend/website'
import { pageKeys, type PageDocument, type PageKey } from '../../backend/websitePages'
import { WebsitePageDraftProvider } from '../../components/layout/WebsitePageContext'
import { hostedProducts } from '../../backend/catalog'
import { ShopPage } from '../ShopPage'
import { ProductDetailsPage } from '../ProductDetailsPage'
import { SoldOutDesignsPage } from '../SoldOutDesignsPage'
import { AboutPage } from '../AboutPage'
import { ContactPage } from '../ContactPage'
import { FaqPage } from '../FaqPage'
import { PolicyPage } from '../PolicyPage'
import './website-preview.css'

const previewMessage = 'percent-website-preview-draft'

export default function WebsitePreviewPage() {
  useEffect(() => {
    document.documentElement.classList.add('website-preview-document')
    document.body.classList.add('website-preview-body')
    return () => {
      document.documentElement.classList.remove('website-preview-document')
      document.body.classList.remove('website-preview-body')
    }
  }, [])
  return <StorefrontBootstrap><PreviewBridge /></StorefrontBootstrap>
}

function PreviewBridge() {
  const saved = useWebsiteContent()
  const [draft, setDraft] = useState<WebsiteDocument>()
  const [draftPage, setDraftPage] = useState<PageDocument | null>(null)
  const params = new URLSearchParams(window.location.search)
  const requested = params.get('page')
  const page: PageKey | 'home' = pageKeys.includes(requested as PageKey) ? requested as PageKey : 'home'
  const previewSlug = params.get('product') || hostedProducts.find(product => product.active)?.slug
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const data = event.data as { type?: string; document?: WebsiteDocument; pageDocument?: PageDocument }
      if (data.type === previewMessage && data.document) setDraft(data.document)
      if (data.type === 'percent-website-preview-page-draft' && data.pageDocument?.page_key === page) setDraftPage(data.pageDocument)
    }
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: 'percent-website-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [page])
  const value = { managed: true, document: draft ?? saved.document }
  const containNavigation = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a')) event.preventDefault()
  }
  const selected = page === 'home' ? <HomePage /> : page === 'shop' ? <ShopPage /> : page === 'product_details' ? <ProductDetailsPage previewSlug={previewSlug} /> : page === 'sold_out' ? <SoldOutDesignsPage /> : page === 'about' ? <AboutPage /> : page === 'contact' ? <ContactPage /> : page === 'faq' ? <FaqPage /> : <PolicyPage policyId={page.replace('policy_', '') as 'shipping' | 'returns' | 'privacy' | 'terms'} />
  return <WebsiteContentProvider value={value}><WebsitePageDraftProvider document={draftPage}><div className="website-storefront-preview" onClickCapture={containNavigation}><Header />{selected}<Footer /></div></WebsitePageDraftProvider></WebsiteContentProvider>
}
