import { supabase } from '../client'
import { getAdminAccess } from './role'
import { customerPageSize,validCustomerId,type CustomerDetail,type CustomerFilters,type CustomerListResult } from './customer-model'

const fail=()=>new Error('Customers unavailable')
async function assertAdmin(userId:string){if((await getAdminAccess(userId)).status!=='allowed')throw fail()}

export async function listAdminCustomers(userId:string,filters:CustomerFilters,page:number,signal:AbortSignal){
 await assertAdmin(userId)
 const {data,error}=await supabase.rpc('admin_list_customers',{search_text:filters.search.trim().slice(0,120)||undefined,customer_filter:filters.filter,sort_by:filters.sort,page_number:Math.max(1,page),page_size:customerPageSize}).abortSignal(signal)
 if(error||!data)throw fail()
 return data as unknown as CustomerListResult
}

export async function loadAdminCustomer(userId:string,id:string,signal:AbortSignal){
 if(!validCustomerId(id))return null
 await assertAdmin(userId)
 const {data,error}=await supabase.rpc('admin_get_customer',{customer_id:id}).abortSignal(signal)
 if(error)throw fail()
 return data as unknown as CustomerDetail|null
}
