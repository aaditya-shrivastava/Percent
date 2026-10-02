# Storefront small-text typography audit

Repeated page-specific values (including mobile overrides down to 0.48–0.65rem) made labels, metadata and helper copy disproportionately small. Existing body and large-heading rules are retained.

The shared scale in src/index.css is inherited only by storefront main content. Navbar, site footer and Admin (including Admin previews) retain their original typography. The final role groups override audited legacy selectors without changing their layout, spacing, colors, tracking, weights, semantics or handlers. Legacy declarations remain as defaults outside the storefront scope.

| Role | Shared token | Range at 16px root | Leading |
| --- | --- | --- | --- |
| Eyebrow/editorial label | --sf-text-eyebrow | 13–14px | 1.5 |
| Label/metadata/helper | --sf-text-small | 13–14px | 1.5 |
| Subtitle/support | --sf-text-support | 16–18px | 1.6 |
| Audited undersized descriptive copy | --sf-text-copy | 14–16px | 1.6 |
| Compact actions | --sf-text-control | 13–14px | 1.4 |
| Form entry text | --sf-text-field | 16px | 1.5 |
| Feature/card names | --sf-text-feature | 15–16px | 1.4 |
| Numbered identifiers | --sf-text-badge | 12px | 1.5 |

Audited: Home, Shop and filters, Product Details and reviews/size guide, Search, Blog listing/details, About, Contact/Support, FAQ, all four policy pages, Cart, Checkout and reservation states, confirmation styling, Profile, Orders/details/tracking, Addresses, Wishlist, Sign In, Create Account, Forgot Password and Sold Out Designs.

## Intentional exceptions

- Brand lockups, navbar tooltips/count badges and site-footer copy are outside this task's explicit scope.
- The legacy confirmation component's decorative seal caption (.confirmation-seal small, 0.48rem / 7.68px) retains its stamp treatment; the current protected confirmation URL redirects to Orders.
- Inactive carousel previews retain their perspective transform/scaling. Caption fonts now use the shared 13–14px token; the secondary previews may appear smaller after scaling. The selected card/action remains full size.
- Historical hidden .regular-card-info rules remain unused by the current carousel markup. They are not displayed storefront copy.
- Archive identifiers, Promise/Support/FAQ numbered badges and hero slide counters are now readable UI text at 12px, with their existing shapes preserved.
- Mobile order-view links retain their existing font-size:0 icon presentation with their accessible label; the desktop text uses the compact action token.
- Screen-reader-only labels and SVG/icon presentation retain their existing implementation.
- Large approved headings and body copy already at a comfortable size keep their existing rules. Small primary card names use the feature token; metadata uses the small-copy token.

## Verification (initial pass)

Responsive browser validation uses the actual React pages and CSS with deterministic catalog/auth/backend boundary fixtures. Live catalog assets and payment/OAuth services are not invoked by this typography task. Required widths: 1440, 1280, 1024, 834, 768, 600, 426, 425, 390, 375, 360 and 320px.

Results: 26 storefront routes audited at all 12 widths (312 route/viewport cases), then 9 affected/populated routes rechecked at all widths (108 cases). Remaining sub-12px rendered copy was limited to the intentional decorative ornaments/counters above. Large rendered headings and navbar/footer computed typography were compared with the role rules disabled; affected-page follow-up found no changes. Buttons, cards and form controls had no horizontal content overflow. Existing horizontal policy/collaborator/carousel rows remain scrollable.

Additional checks passed at every required width: filter selections and Apply URL persistence; authenticated pending-order/reservation rendering using a mocked order RPC; Google button keyboard focus and mocked callback; 200% browser-zoom viewport equivalence; Admin computed font-size/line-height equality and absence of storefront text tokens. Original semantic markup, labels, colors, weights, tracking and functional code are unchanged.

The browser audit uses fixtures, not live authentication, payment or production order creation. The legacy confirmation component's typography was audited statically; the current protected confirmation route retains its existing redirect.

## Residual override correction

Primary feature/card labels had been placed in the compact-action role along with selector names containing article/address/aside; this kept Promise names and similar titles at 12px. Numbered badges were exempted as decoration, allowing 8–9px local values and mobile reductions to survive. Corrected the role groups so feature names, metadata and action text use the appropriate shared token. Eyebrows and actual action/option/tab labels now use the existing 13–14px small-copy scale.

Feature roles cover Promise names, collaborator names, support-card names, product-card names, order-item names and primary address-card names. Number roles cover Promise, Support, FAQ policy-card, archive and hero slide identifiers. Product size options and carousel hint labels use the small-copy token. Large headings, weights, color, badge dimensions, routes, handlers and layout declarations are unchanged.

Local typography exceptions:

- Single-line Promise names use the feature token with their original 1.05rem line-box leading so the existing compact stacked cards keep their original height. Their names do not wrap at the required widths.
- Shop's two-column Clear All / Apply Filters actions cap the control token at 13px and use 0.02em tracking. This keeps their existing 44px single-line button layout.

Source audit: no storefront JSX inline font sizes or text-size utility overrides were found. All CSS lives in the shared stylesheet; old local numeric defaults remain for the existing Admin previews/out-of-scope contexts, but the storefront role rules override meaningful displayed copy. Remaining sub-12px exceptions are exactly those in the exception list above (chrome/out-of-scope styles, ornamental confirmation stamp, icon-only/screen-reader presentation, unused historical card-info CSS, and perspective-scaled secondary carousel previews).

Residual verification: 24 routes audited at each of the 12 required widths (288 cases), with targeted About/Shop rechecks at every width after the compact-card/action refinements. The final targeted report has zero issues and zero page errors: Promise widths/heights/font weights and circular-badge widths/heights match the pre-change CSS, names are 15–16px, badges are 12px, Shop action buttons remain 44px high and single-line, and large-heading/nav/footer typography matches the baseline. The broad audit found no meaningful rendered text below 12px. Admin computed font-size/line-height comparison, filter URL behavior, and 200% zoom-equivalent layout checks passed.

The residual changes are typography declarations and selector-role assignments only. No source markup, layout/spacing rules, authentication, routes, data or handlers were changed.
