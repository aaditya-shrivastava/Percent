/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fallbackPageDocument, loadStorefrontPage, type PageDocument, type PageKey } from '../../backend/websitePages'

const DraftContext = createContext<PageDocument | null>(null)
export function WebsitePageDraftProvider({ document, children }: { document: PageDocument | null; children: ReactNode }) { return <DraftContext.Provider value={document}>{children}</DraftContext.Provider> }

export function useWebsitePage(key: PageKey) {
  const draft = useContext(DraftContext)
  const [document, setDocument] = useState<PageDocument>(() => fallbackPageDocument(key))
  const [error, setError] = useState(false)
  useEffect(() => {
    if (draft?.page_key === key) return
    let active = true
    void loadStorefrontPage(key).then(result => { if (active) { setDocument(result.document); setError(false) } }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [draft?.page_key, key])
  return { page: draft?.page_key === key ? draft : document, error: draft?.page_key === key ? false : error }
}

export function WebsitePageError() { return <main role="alert" className="website-page-error"><h1>Page content is temporarily unavailable</h1><p>Please try again shortly.</p></main> }

export function pageSection(document: PageDocument, key: string) { return document.sections.find(item => item.section_key === key && item.enabled) }
