import { Link } from 'react-router-dom'
import type { Product } from '../../types'

export function ProductCard({ product }: { product: Product }) { const image = product.images[0]; return <Link className="product-card" to={`/product/${product.slug}`}><div className="product-image"><img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" /></div><div className="product-meta"><div><h3>{product.name}</h3><p>${product.price.toFixed(2)}</p></div>{product.totalEditionCount && <span className="edition"><i />{product.soldCount}/{product.totalEditionCount}</span>}</div></Link> }
