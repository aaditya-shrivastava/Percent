import { useCallback, useState } from 'react'
import { demoAccountAddress, type AccountAddress } from '../data/account'

const addressKey = 'percent-profile-addresses'

const readAddresses = (): AccountAddress[] => {
  try {
    const stored = localStorage.getItem(addressKey)
    if (stored) {
      const parsed = JSON.parse(stored) as AccountAddress[]
      return Array.isArray(parsed) ? parsed : []
    }
    const checkoutAddress = JSON.parse(localStorage.getItem('percent-checkout-address') ?? 'null') as Partial<AccountAddress> | null
    if (checkoutAddress?.fullName && checkoutAddress.addressLine1) return [{ ...demoAccountAddress, ...checkoutAddress, id: 'checkout-address', label: 'Default', isDefault: true }]
  } catch {
    return [demoAccountAddress]
  }
  return [demoAccountAddress]
}

const saveAddresses = (addresses: AccountAddress[]) => {
  localStorage.setItem(addressKey, JSON.stringify(addresses))
  window.dispatchEvent(new CustomEvent('percent:addresses-changed'))
}

export function useAccountAddresses() {
  const [addresses, setAddresses] = useState<AccountAddress[]>(readAddresses)
  const commit = useCallback((next: AccountAddress[]) => { saveAddresses(next); setAddresses(next) }, [])
  const saveAddress = useCallback((address: AccountAddress) => {
    const current = readAddresses()
    const exists = current.some((item) => item.id === address.id)
    let next = exists ? current.map((item) => item.id === address.id ? address : item) : [...current, address]
    if (address.isDefault) next = next.map((item) => ({ ...item, isDefault: item.id === address.id }))
    else if (!next.some((item) => item.isDefault) && next.length) next = next.map((item, index) => ({ ...item, isDefault: index === 0 }))
    commit(next)
  }, [commit])
  const removeAddress = useCallback((addressId: string) => {
    const remaining = readAddresses().filter((address) => address.id !== addressId)
    commit(remaining.some((address) => address.isDefault) ? remaining : remaining.map((address, index) => ({ ...address, isDefault: index === 0 })))
  }, [commit])
  return { addresses, saveAddress, removeAddress }
}
