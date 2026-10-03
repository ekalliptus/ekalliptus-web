export function initCategoryFilter(doc: Document = document): void {
  const buttons = doc.querySelectorAll<HTMLButtonElement>('.category-btn')
  const cards = doc.querySelectorAll<HTMLElement>('.blog-card')
  const emptyState = doc.getElementById('blog-empty-state')
  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)))
    let visible = 0
    cards.forEach(card => {
      card.hidden = button.dataset.category !== 'all' && card.dataset.category !== button.dataset.category
      if (!card.hidden) visible += 1
    })
    if (emptyState) emptyState.hidden = visible > 0
    doc.querySelectorAll<HTMLElement>('.ad-in-feed').forEach(ad => { ad.hidden = button.dataset.category !== 'all' })
  }))
}
