const assertPaise = (valuePaise: number) => {
  if (!Number.isSafeInteger(valuePaise)) throw new TypeError('Paise value must be a safe integer')
  return valuePaise
}

export function formatInrFromPaise(valuePaise: number, currency = 'INR') {
  const paise = assertPaise(valuePaise)
  const fractionDigits = Math.abs(paise % 100) === 0 ? 0 : 2
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(paise / 100)
}
