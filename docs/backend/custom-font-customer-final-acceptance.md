# Final real Customer hosted acceptance

The existing real Firebase Customer session is non-anonymous, Firebase status ready, and Percent session authenticated. Normal get_my_role returns customer with HTTP 200. get_storefront_content and visible product reads return HTTP 200; the complete normal loadCatalog and loadStorefrontWebsite functions succeed. Shop renders both hosted products.

The earlier temporarily-unavailable state was not reproduced. StorefrontBootstrap produces that message on a catalog/content loading failure and gates Sign In as well. Historical HTTP/error details were not captured, so a precise historical root cause cannot be asserted. No application/auth/font architecture changes or SQL were needed. Shop remains outside CustomerRouteGuard.

Normal /login?returnTo=%2Fshop redirects the restored real Customer to /shop. Refresh and direct /shop navigation succeed. Home, Product Details, Blog and protected Profile render normally. Inter remains selected for all roles, heading 700, body 400, letter spacing 0.

Real direct authenticated Edge requests for catalog, valid legal Lora WOFF2 multipart create/upload, family update, enable, disable, delete and preview are denied with HTTP 403 and Admin access required. Service management catalog, service-only delivery resolver, save and delete RPCs deny with 42501. No private font metadata is exposed in Edge errors. No writes succeed or fixtures are created.

Public read-only hosted security checks pass and the entire hosted content matches the original snapshot except its expected update timestamp. Current public custom families are zero. The previously verified service-side cleanup counts remain zero families / zero faces / zero canonical temporary Storage objects; Customer denials cannot recreate them. Private Storage enumeration was not repeated with Customer privileges.

Super Admin lifecycle remains the previous hosted PASS; no auth or Admin code changed. Ordinary Admin remains DEFERRED — no real Admin account exists. TypeScript, ESLint, production build (temporary output directory), and git diff --check all pass again.

Evidence: custom-font-customer-hosted-results.json and custom-font-customer-shop.jpg.
