export interface CustomerNameProfile {
 display_name: string | null
 first_name: string | null
 last_name: string | null
}

export function parseCustomerName(value: string | null | undefined) {
 const display_name=(value??'').trim().replace(/\s+/g,' ')
 if(!display_name||display_name.length>120)return null
 const [first_name,...remaining]=display_name.split(' ')
 return {display_name,first_name,last_name:remaining.join(' ')}
}

export function isUninitializedCustomerName(profile:CustomerNameProfile) {
 return (!profile.display_name?.trim()||profile.display_name==='Percent Customer')&&!profile.first_name?.trim()&&!profile.last_name?.trim()
}

export function customerDisplayName(profile:CustomerNameProfile,firebaseName?:string|null) {
 const stored=profile.display_name?.trim()
 if(stored&&stored!=='Percent Customer')return stored
 const parts=parseCustomerName([profile.first_name,profile.last_name].filter(Boolean).join(' '))
 return parts?.display_name??parseCustomerName(firebaseName)?.display_name??(stored||'Percent Customer')
}
