import { useCallback, useEffect, useState } from 'react'
import { supabase, checkError } from '../backend/client'
import { usePercentSession } from './usePercentSession'
import type { AccountAddress } from '../data/account'

export function useAccountAddresses() {
 const {user}=usePercentSession()
 const [state,setState]=useState<{owner?:string;items:AccountAddress[]}>({items:[]})
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const refresh=useCallback(async()=>{
  if(!user){setLoading(false);return}
  const {data,error}=await supabase.from('addresses').select('*').eq('user_id',user.id).order('created_at')
  checkError(error)
  setState({owner:user.id,items:(data??[]).map(a=>({id:a.id,label:a.label,isDefault:a.is_default,fullName:a.full_name,phone:a.phone,addressLine1:a.address_line1,addressLine2:a.address_line2,city:a.city,state:a.state,pinCode:a.pin_code,country:'India'}))});setLoading(false)
 },[user])
 useEffect(()=>{void Promise.resolve().then(refresh).catch(e=>setError(e.message))},[refresh])
 const saveAddress=async(a:AccountAddress)=>{
  setError('')
  try {
   const {error}=await supabase.rpc('save_address',{address:{id:a.id.startsWith('address-')?null:a.id,label:a.label,is_default:a.isDefault,full_name:a.fullName,phone:a.phone,address_line1:a.addressLine1,address_line2:a.addressLine2,city:a.city,state:a.state,pin_code:a.pinCode}})
   checkError(error);await refresh();return true
  } catch(e){setError(e instanceof Error?e.message:'Unable to save address');return false}
 }
 const removeAddress=async(id:string)=>{
  try {const {error}=await supabase.from('addresses').delete().eq('id',id);checkError(error);await refresh()}catch(e){setError(e instanceof Error?e.message:'Unable to remove address')}
 }
 return {addresses:state.owner===user?.id?state.items:[],saveAddress,removeAddress,error,loading}
}
