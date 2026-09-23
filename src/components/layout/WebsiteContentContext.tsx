/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react'
import { fallbackWebsiteDocument, type WebsiteDocument } from '../../backend/website'
type Value={managed:boolean;document:WebsiteDocument}
const WebsiteContext=createContext<Value>({managed:false,document:fallbackWebsiteDocument()})
export function WebsiteContentProvider({value,children}:{value:Value;children:ReactNode}){return <WebsiteContext.Provider value={value}>{children}</WebsiteContext.Provider>}
export const useWebsiteContent=()=>useContext(WebsiteContext)

