import { blogCategories, type BlogCategory } from '../../data/blog'

export type BlogCategorySelection = 'All' | BlogCategory

export function BlogCategoryFilter({ selected, onSelect }: { selected: BlogCategorySelection; onSelect: (category: BlogCategorySelection) => void }) {
  return <div className="journal-filters" role="group" aria-label="Filter stories by category">{blogCategories.map((category) => <button className={selected === category ? 'is-active' : ''} type="button" key={category} aria-pressed={selected === category} onClick={() => onSelect(category)}>{category}</button>)}</div>
}
