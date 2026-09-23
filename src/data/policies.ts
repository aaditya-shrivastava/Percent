export type PolicyId = 'shipping' | 'returns' | 'privacy' | 'terms'

export interface PolicySection {
  id: string
  title: string
  paragraphs: string[]
}

export interface PolicyDocument {
  id: PolicyId
  title: string
  shortTitle: string
  introduction: string
  sections: PolicySection[]
}

export const policies: PolicyDocument[] = [
  {
    id: 'shipping',
    title: 'Shipping & Delivery',
    shortTitle: 'Shipping & Delivery',
    introduction: 'This policy explains the planned order-processing, fulfillment, delivery, and support experience for Percent. Final commercial timelines and charges will be confirmed before store launch.',
    sections: [
      {
        id: 'processing',
        title: 'Order Processing',
        paragraphs: [
          'Orders will enter processing after a successful order confirmation. The final dispatch workflow and processing timelines are still being prepared and will be published before launch.',
          'Submitting an order does not by itself guarantee fulfillment. Customers will receive a clear confirmation when an order has been accepted for processing.',
        ],
      },
      {
        id: 'shipping-partner',
        title: 'Shipping Partner',
        paragraphs: [
          'Orders are planned to be fulfilled through Delhivery. Live carrier services and API-based fulfillment are not connected during the current frontend-only phase.',
          'The shipping partner shown for an order will be confirmed when live fulfillment is enabled.',
        ],
      },
      {
        id: 'delivery-estimates',
        title: 'Delivery Estimates',
        paragraphs: [
          'Estimated delivery timelines will be shown during checkout once live shipping integration is enabled. Any estimate is intended as guidance rather than a guaranteed delivery date.',
          'Delivery availability and timing may depend on the destination and the fulfillment information available when an order is placed.',
        ],
      },
      {
        id: 'shipping-charges',
        title: 'Shipping Charges',
        paragraphs: [
          'Any applicable shipping charge will be displayed before the customer confirms an order. Shipping thresholds, location-based charges, and related commercial rules are to be finalized before launch.',
        ],
      },
      {
        id: 'tracking',
        title: 'Tracking',
        paragraphs: [
          'When live fulfillment is available, dispatched orders are intended to include tracking information in the customer account and relevant order communications.',
          'Tracking events are supplied by the fulfillment partner and may take time to update after dispatch.',
        ],
      },
      {
        id: 'address-accuracy',
        title: 'Address Accuracy',
        paragraphs: [
          'Customers should review the recipient name, phone number, postal code, and complete delivery address before confirming an order.',
          'Address corrections may not be possible after fulfillment begins. Contact Support as soon as possible if submitted details are incorrect.',
        ],
      },
      {
        id: 'delivery-delays',
        title: 'Delivery Delays',
        paragraphs: [
          'Carrier conditions, weather, destination access, address issues, and other circumstances may affect estimated delivery timing. Percent will share available updates without presenting an estimate as a guarantee.',
        ],
      },
      {
        id: 'failed-delivery',
        title: 'Failed Delivery Attempts',
        paragraphs: [
          'The fulfillment partner may use the submitted contact details when delivery cannot be completed. Reattempt and return-to-origin rules will be finalized with the live shipping process before launch.',
        ],
      },
      {
        id: 'lost-damaged',
        title: 'Lost or Damaged Shipments',
        paragraphs: [
          'If an order appears lost or arrives with shipping damage, contact Support with the order reference and clear supporting details. Percent will review the available carrier information and explain the applicable next step.',
          'Resolution options depend on the verified circumstances and, for limited designs, the remaining stock available.',
        ],
      },
      {
        id: 'shipping-support',
        title: 'Contact Support',
        paragraphs: [
          'For delivery questions, use the Percent Contact page and include the relevant order reference where available. Never post personal address or payment information in a public review.',
        ],
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns & Exchanges',
    shortTitle: 'Returns & Exchanges',
    introduction: 'This policy outlines the planned return and exchange experience. Final eligibility windows, condition requirements, and refund timing will be published before store launch.',
    sections: [
      {
        id: 'return-eligibility',
        title: 'Return Eligibility',
        paragraphs: [
          'Final return eligibility and request timelines are to be finalized before launch. The live policy will clearly explain which orders and circumstances qualify before customers purchase.',
          'A return request will require the relevant order information and must follow the instructions provided by Percent Support.',
        ],
      },
      {
        id: 'exchange-eligibility',
        title: 'Exchange Eligibility',
        paragraphs: [
          'Exchange eligibility will depend on the final policy and available inventory. Because Percent designs are produced in limited quantities, replacement sizes or exchanges may not always be available.',
        ],
      },
      {
        id: 'product-condition',
        title: 'Product Condition',
        paragraphs: [
          'The final policy will define the condition in which an item must be returned, including requirements related to wear, washing, original tags, and packaging.',
          'Customers should keep the product and its original materials in good condition while a support request is being reviewed.',
        ],
      },
      {
        id: 'incorrect-damaged',
        title: 'Incorrect or Damaged Items',
        paragraphs: [
          'If an incorrect item is delivered or a product arrives damaged, contact Support promptly with the order reference and clear photographs of the item and packaging.',
          'Percent will review the submitted information before confirming the available resolution. Replacement remains subject to verified circumstances and available stock.',
        ],
      },
      {
        id: 'return-process',
        title: 'Return Process',
        paragraphs: [
          'When returns are enabled, customers will begin through Percent Support and receive the applicable instructions after eligibility is reviewed. Products should not be sent without those instructions.',
          'Collection, shipping-label, and return-address details are to be finalized before launch.',
        ],
      },
      {
        id: 'refund-process',
        title: 'Refund Process',
        paragraphs: [
          'Approved refund methods and processing timelines are to be finalized before launch. The final policy will explain when a refund begins and how customers are notified.',
          'This frontend preview does not issue or process real refunds.',
        ],
      },
      {
        id: 'exchange-process',
        title: 'Exchange Process',
        paragraphs: [
          'If an exchange is approved and the requested item is available, Support will provide the next steps. An alternative resolution may be offered when the requested size or design is no longer available.',
        ],
      },
      {
        id: 'non-returnable',
        title: 'Non-Returnable Items',
        paragraphs: [
          'The categories and conditions that make an item non-returnable have not yet been finalized. Any exclusions will be stated clearly in the final policy before launch.',
        ],
      },
      {
        id: 'limited-designs',
        title: 'Sold Out & Limited Designs',
        paragraphs: [
          'Every limited Percent design has its own production limit. Once sold out, the design is permanently retired with no restock, repeat, or reproduction.',
          'A returned unit does not cause another unit to be manufactured. Exchange or replacement availability depends only on remaining eligible stock.',
        ],
      },
      {
        id: 'returns-support',
        title: 'Support',
        paragraphs: [
          'Use the Contact page for return, exchange, incorrect-item, or damage questions. Include the order reference and avoid sharing payment credentials in the message.',
        ],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy Policy',
    introduction: 'This frontend-ready policy describes the categories of information Percent expects to use when the live store launches. Infrastructure, retention schedules, and final operational details remain subject to pre-launch review.',
    sections: [
      {
        id: 'information-collected',
        title: 'Information We Collect',
        paragraphs: [
          'Percent may collect information that customers provide directly, information required to complete an order, and limited technical information generated while the website is used.',
          'The exact production data flows will be documented when the final account, payment, fulfillment, and analytics systems are connected.',
        ],
      },
      {
        id: 'account-information',
        title: 'Account Information',
        paragraphs: [
          'Account information may include a name, email address, phone number, authentication details, saved preferences, and account activity. The current demo account experience is frontend-only and does not create a production customer account.',
        ],
      },
      {
        id: 'order-information',
        title: 'Order Information',
        paragraphs: [
          'Order information may include purchased items, selected sizes, prices, order status, and related support history. This information is intended to help fulfill orders and provide customer service.',
        ],
      },
      {
        id: 'payment-information',
        title: 'Payment Information',
        paragraphs: [
          'Payments are intended to be processed securely through Razorpay. Percent does not intend to directly store full payment-card credentials.',
          'The final payment integration and its provider notices will be documented before real transactions are enabled.',
        ],
      },
      {
        id: 'shipping-information',
        title: 'Shipping Information',
        paragraphs: [
          'Shipping information may include the recipient name, delivery address, phone number, postal code, and fulfillment updates.',
          'Delivery information may be shared with fulfillment partners such as Delhivery when required to complete an order. This integration is planned and is not active in the current frontend phase.',
        ],
      },
      {
        id: 'website-usage',
        title: 'Website Usage',
        paragraphs: [
          'Percent may use limited device, browser, page-interaction, and diagnostic information to operate, secure, and improve the website. The production analytics configuration is to be finalized before launch.',
        ],
      },
      {
        id: 'cookies',
        title: 'Cookies',
        paragraphs: [
          'Cookies or similar browser storage may be used for essential website functions, preferences, cart continuity, security, and consented analytics. Final cookie categories and controls will be published before launch.',
        ],
      },
      {
        id: 'information-use',
        title: 'How Information Is Used',
        paragraphs: [
          'Information may be used to provide requested services, process and fulfill orders, maintain accounts, respond to support enquiries, prevent misuse, improve the website, and meet applicable obligations.',
          'Percent does not intend to use personal information for unrelated purposes without an appropriate reason or notice.',
        ],
      },
      {
        id: 'service-providers',
        title: 'Service Providers',
        paragraphs: [
          'Selected service providers may process only the information reasonably needed to provide payment, fulfillment, hosting, communication, security, or support services.',
          'Final providers and production data-processing arrangements will be reviewed before launch.',
        ],
      },
      {
        id: 'data-security',
        title: 'Data Security',
        paragraphs: [
          'Percent intends to use reasonable technical and organizational safeguards appropriate to the live service. No online system can be represented as completely risk-free.',
        ],
      },
      {
        id: 'data-retention',
        title: 'Data Retention',
        paragraphs: [
          'Final retention periods are to be established before launch. Information is intended to be kept only for as long as reasonably needed for the stated purpose, applicable obligations, dispute handling, or security.',
        ],
      },
      {
        id: 'user-rights',
        title: 'User Rights',
        paragraphs: [
          'Customers may be able to request access, correction, deletion, or another applicable privacy action. Available rights and exceptions depend on applicable law and the final production system.',
        ],
      },
      {
        id: 'privacy-contact',
        title: 'Contact',
        paragraphs: [
          'Use the Percent Contact page for privacy questions. Verified request procedures and any required legal contact details will be finalized before launch.',
        ],
      },
    ],
  },
  {
    id: 'terms',
    title: 'Terms & Conditions',
    shortTitle: 'Terms & Conditions',
    introduction: 'These plain-language terms describe the intended use of the Percent storefront. Final legally operative terms, commercial rules, and jurisdiction details require review before production launch.',
    sections: [
      {
        id: 'website-use',
        title: 'Website Use',
        paragraphs: [
          'Visitors may use the website to explore Percent, view products and editorial content, and use the storefront features made available to them. Users should provide accurate information and interact with the website lawfully.',
        ],
      },
      {
        id: 'account-responsibility',
        title: 'Account Responsibility',
        paragraphs: [
          'When real accounts are enabled, users will be responsible for maintaining the confidentiality of their access details and for information submitted through their account. Suspected unauthorized access should be reported to Support.',
        ],
      },
      {
        id: 'product-information',
        title: 'Product Information',
        paragraphs: [
          'Percent aims to present product descriptions, images, availability, and sizing guidance clearly. Product colors and appearance may vary slightly depending on screen or device display.',
          'Customers should review available measurements and sizing information before purchase.',
        ],
      },
      {
        id: 'pricing',
        title: 'Pricing',
        paragraphs: [
          'Prices and any applicable charges will be shown before an order is confirmed. Final tax, shipping, promotion, and correction rules will be published before launch.',
        ],
      },
      {
        id: 'limited-availability',
        title: 'Limited Availability',
        paragraphs: [
          'Each limited design has its own production limit. Once a design reaches that configured limit, it is permanently retired with no restock, repeat, or reproduction.',
          'Availability is not guaranteed until checkout and order confirmation are successfully completed.',
        ],
      },
      {
        id: 'orders',
        title: 'Orders',
        paragraphs: [
          'An order request may be reviewed for availability, payment confirmation, accuracy, and misuse prevention before it is accepted. The final order acceptance and cancellation rules are to be finalized before launch.',
        ],
      },
      {
        id: 'payments',
        title: 'Payments',
        paragraphs: [
          'Razorpay is the planned payment provider. Live payment processing is not connected in the current frontend-only phase, and available payment methods will be confirmed before launch.',
        ],
      },
      {
        id: 'shipping',
        title: 'Shipping',
        paragraphs: [
          'Shipping is subject to the Shipping & Delivery Policy presented at the time of purchase. Delhivery is the planned fulfillment partner, but live carrier integration is not currently enabled.',
        ],
      },
      {
        id: 'returns',
        title: 'Returns',
        paragraphs: [
          'Returns and exchanges are subject to the policy presented at the time of purchase. Final eligibility windows, condition requirements, and processing details will be published before launch.',
        ],
      },
      {
        id: 'intellectual-property',
        title: 'Intellectual Property',
        paragraphs: [
          'Percent branding, original artwork, product designs, written content, and website materials may not be copied, reproduced, distributed, or commercially exploited without appropriate permission.',
        ],
      },
      {
        id: 'user-content',
        title: 'User Content & Reviews',
        paragraphs: [
          'Users are intended to be signed in before submitting reviews when the real account system is connected. Reviews must not include abusive or illegal material, impersonation, unrelated spam, or content that violates another person’s rights.',
          'Percent may moderate submitted content under the final review rules published before launch.',
        ],
      },
      {
        id: 'prohibited-use',
        title: 'Prohibited Use',
        paragraphs: [
          'Users must not interfere with the website, attempt unauthorized access, misuse automated systems, submit fraudulent information, infringe rights, or use the service for unlawful activity.',
        ],
      },
      {
        id: 'liability',
        title: 'Liability',
        paragraphs: [
          'The final liability provisions will be reviewed before launch and will operate only to the extent permitted by applicable law. Nothing in this frontend preview creates a warranty period, delivery guarantee, or finalized commercial commitment.',
        ],
      },
      {
        id: 'changes',
        title: 'Changes to Terms',
        paragraphs: [
          'Percent may update the production terms when the storefront, providers, or legal requirements change. The effective version and appropriate notice process will be established before launch.',
        ],
      },
      {
        id: 'terms-contact',
        title: 'Contact',
        paragraphs: [
          'Use the Percent Contact page for questions about these terms. Formal legal contact details, if required, will be included after pre-launch review.',
        ],
      },
    ],
  },
]

export const policyById = Object.fromEntries(policies.map((policy) => [policy.id, policy])) as Record<PolicyId, PolicyDocument>
