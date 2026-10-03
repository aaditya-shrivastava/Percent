/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { fallbackWebsiteDocument, type WebsiteDocument } from '../../backend/website'
import { fontStack } from '../../typography/fontRegistry'
import { useFontRules } from '../../typography/useFontRules'
import '../../typography/storefront-fonts.css'
import type { FontFamilyRecord } from '../../typography/fontRegistry'
const emptyFontFamilies:FontFamilyRecord[]=[]
type Value={managed:boolean;document:WebsiteDocument}
const WebsiteContext=createContext<Value>({managed:false,document:fallbackWebsiteDocument()})
export function WebsiteContentProvider({value,children}:{value:Value;children:ReactNode}){return <WebsiteContext.Provider value={value}>{children}</WebsiteContext.Provider>}
export const useWebsiteContent=()=>useContext(WebsiteContext)
export function StorefrontTheme(){
 const {document}=useWebsiteContent(),t=document.settings.typography,families=document.font_families??emptyFontFamilies
 useFontRules([t.display_family,t.heading_family,t.body_family,t.ui_family],families,window.location.pathname==='/admin/website/preview',[t.heading_weight,t.body_weight,400,600])
 useEffect(()=>{
  const root=window.document.documentElement,c=document.settings.colors
  const values:Record<string,string>={'--bg':c.background,'--surface':c.surface,'--ink':c.text,'--muted':c.muted,'--accent':c.accent,'--accent-hover':c.accent_hover,'--border':c.border,'--highlight':c.highlight}
  const previous=Object.fromEntries(Object.keys(values).map(key=>[key,root.style.getPropertyValue(key)]))
  Object.entries(values).forEach(([key,value])=>root.style.setProperty(key,value))
  const shell=window.document.querySelector<HTMLElement>('.storefront-shell,.website-storefront-preview')
  const fonts:Record<string,string>={'--font-display':fontStack(t.display_family,families),'--font-heading':fontStack(t.heading_family,families),'--font-body':fontStack(t.body_family,families),'--font-ui':fontStack(t.ui_family,families),'--heading-weight':String(t.heading_weight),'--body-weight':String(t.body_weight),'--global-letter-spacing':`${t.letter_spacing}em`}
  const oldFonts=Object.fromEntries(Object.keys(fonts).map(key=>[key,shell?.style.getPropertyValue(key)??'']))
  Object.entries(fonts).forEach(([key,value])=>shell?.style.setProperty(key,value))
  let icon=window.document.querySelector<HTMLLinkElement>('link[rel="icon"]');const original=icon?.href
  if(document.settings.branding.favicon_url){if(!icon){icon=window.document.createElement('link');icon.rel='icon';window.document.head.append(icon)}icon.href=document.settings.branding.favicon_url}
  return()=>{Object.entries(previous).forEach(([key,value])=>value?root.style.setProperty(key,value):root.style.removeProperty(key));Object.entries(oldFonts).forEach(([key,value])=>value?shell?.style.setProperty(key,value):shell?.style.removeProperty(key));if(icon&&original)icon.href=original;else if(icon&&!original&&document.settings.branding.favicon_url)icon.remove()}
 },[document.settings,t,families])
 return null
}

