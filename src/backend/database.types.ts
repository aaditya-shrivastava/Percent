export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          checkout_key: string | null
          checkout_request: Json | null
          address_line1: string
          address_line2: string
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string
          phone: string
          pin_code: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checkout_key?: string | null
          checkout_request?: Json | null
          address_line1: string
          address_line2?: string
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          label?: string
          phone: string
          pin_code: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checkout_key?: string | null
          checkout_request?: Json | null
          address_line1?: string
          address_line2?: string
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string
          phone?: string
          pin_code?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_images: {
        Row: {
          alt: string
          height: number
          id: string
          post_id: string
          role: string
          url: string
          width: number
        }
        Insert: {
          alt: string
          height: number
          id?: string
          post_id: string
          role: string
          url: string
          width: number
        }
        Update: {
          alt?: string
          height?: number
          id?: string
          post_id?: string
          role?: string
          url?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author: string
          category: string
          created_at: string
          excerpt: string
          featured: boolean
          id: string
          introduction: string
          published_at: string | null
          pull_quote: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author: string
          category: string
          created_at?: string
          excerpt: string
          featured?: boolean
          id?: string
          introduction: string
          published_at?: string | null
          pull_quote?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          category?: string
          created_at?: string
          excerpt?: string
          featured?: boolean
          id?: string
          introduction?: string
          published_at?: string | null
          pull_quote?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_sections: {
        Row: {
          heading: string
          id: string
          paragraphs: Json
          post_id: string
          sort_order: number
        }
        Insert: {
          heading: string
          id?: string
          paragraphs: Json
          post_id: string
          sort_order: number
        }
        Update: {
          heading?: string
          id?: string
          paragraphs?: Json
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_sections_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      colours: {
        Row: {
          created_at: string
          id: string
          label: string
          slug: string
          swatch_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          slug: string
          swatch_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          slug?: string
          swatch_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          amount_paise: number | null
          code: string
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          minimum_subtotal_paise: number
          percent_bps: number | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_paise?: number | null
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          kind: string
          minimum_subtotal_paise?: number
          percent_bps?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_paise?: number | null
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          minimum_subtotal_paise?: number
          percent_bps?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_adjustment_operations: {
        Row: {
          actor_id: string
          after_quantity: number
          before_quantity: number
          created_at: string
          id: string
          internal_note: string | null
          operation: string
          reason: string
          variant_id: string
        }
        Insert: {
          actor_id: string
          after_quantity: number
          before_quantity: number
          created_at?: string
          id?: string
          internal_note?: string | null
          operation: string
          reason: string
          variant_id: string
        }
        Update: {
          actor_id?: string
          after_quantity?: number
          before_quantity?: number
          created_at?: string
          id?: string
          internal_note?: string | null
          operation?: string
          reason?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_operations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_operations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_inventory_summary"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          new_state: Json
          old_state: Json | null
          operation_id: string | null
          reason: string
          unit_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_state: Json
          old_state?: Json | null
          operation_id?: string | null
          reason: string
          unit_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_state?: Json
          old_state?: Json | null
          operation_id?: string | null
          reason?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustment_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_units: {
        Row: {
          created_at: string
          id: string
          piece_number: number
          product_id: string
          sold_at: string | null
          updated_at: string
          variant_id: string
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          piece_number: number
          product_id: string
          sold_at?: string | null
          updated_at?: string
          variant_id: string
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          piece_number?: number
          product_id?: string
          sold_at?: string | null
          updated_at?: string
          variant_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
          {
            foreignKeyName: "inventory_units_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "variant_inventory_summary"
            referencedColumns: ["variant_id", "product_id"]
          },
        ]
      }
      order_addresses: {
        Row: {
          address_line1: string
          address_line2: string
          city: string
          country: string
          created_at: string
          email: string
          full_name: string
          id: string
          kind: string
          order_id: string
          phone: string
          pin_code: string
          state: string
        }
        Insert: {
          address_line1: string
          address_line2?: string
          city: string
          country: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          kind?: string
          order_id: string
          phone: string
          pin_code: string
          state: string
        }
        Update: {
          address_line1?: string
          address_line2?: string
          city?: string
          country?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          kind?: string
          order_id?: string
          phone?: string
          pin_code?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lifecycle_history: {
        Row: { id: string; order_id: string; actor_id: string; dimension: string; previous_value: string; next_value: string; reason: string | null; internal_note: string | null; created_at: string }
        Insert: { id?: string; order_id: string; actor_id: string; dimension: string; previous_value: string; next_value: string; reason?: string | null; internal_note?: string | null; created_at?: string }
        Update: { id?: string; order_id?: string; actor_id?: string; dimension?: string; previous_value?: string; next_value?: string; reason?: string | null; internal_note?: string | null; created_at?: string }
        Relationships: [{ foreignKeyName: "order_lifecycle_history_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }]
      }
      order_items: {
        Row: {
          colour: string
          created_at: string
          id: string
          image_url: string | null
          line_total_paise: number | null
          order_id: string
          product_id: string | null
          product_name: string
          product_slug: string
          quantity: number
          size: string
          sku: string
          unit_price_paise: number
          variant_id: string | null
        }
        Insert: {
          colour: string
          created_at?: string
          id?: string
          image_url?: string | null
          line_total_paise?: number | null
          order_id: string
          product_id?: string | null
          product_name: string
          product_slug: string
          quantity: number
          size: string
          sku: string
          unit_price_paise: number
          variant_id?: string | null
        }
        Update: {
          colour?: string
          created_at?: string
          id?: string
          image_url?: string | null
          line_total_paise?: number | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_slug?: string
          quantity?: number
          size?: string
          sku?: string
          unit_price_paise?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_inventory_summary"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "variant_inventory_summary"
            referencedColumns: ["variant_id", "product_id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code_snapshot: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          discount_paise: number
          estimated_delivery: string | null
          fulfillment_status: string
          id: string
          order_reference: string
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          shipping_paise: number
          shipping_provider: string | null
          status: string
          subtotal_paise: number
          tax_paise: number
          total_paise: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          coupon_code_snapshot?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          discount_paise?: number
          estimated_delivery?: string | null
          fulfillment_status?: string
          id?: string
          order_reference: string
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          shipping_paise?: number
          shipping_provider?: string | null
          status?: string
          subtotal_paise: number
          tax_paise?: number
          total_paise: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          coupon_code_snapshot?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          discount_paise?: number
          estimated_delivery?: string | null
          fulfillment_status?: string
          id?: string
          order_reference?: string
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          shipping_paise?: number
          shipping_provider?: string | null
          status?: string
          subtotal_paise?: number
          tax_paise?: number
          total_paise?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string
          created_at: string
          height: number
          id: string
          product_id: string
          role: string
          sort_order: number
          url: string
          width: number
        }
        Insert: {
          alt: string
          created_at?: string
          height: number
          id?: string
          product_id: string
          role: string
          sort_order: number
          url: string
          width: number
        }
        Update: {
          alt?: string
          created_at?: string
          height?: number
          id?: string
          product_id?: string
          role?: string
          sort_order?: number
          url?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          body: string
          created_at: string
          customer_name: string
          id: string
          product_id: string
          rating: number
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_name: string
          id?: string
          product_id: string
          rating: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_name?: string
          id?: string
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          created_at: string
          product_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          colour_id: string
          compare_at_price_paise: number | null
          created_at: string
          enabled: boolean
          id: string
          legacy_id: string | null
          price_paise: number
          product_id: string
          size: string
          sku: string
          updated_at: string
        }
        Insert: {
          colour_id: string
          compare_at_price_paise?: number | null
          created_at?: string
          enabled?: boolean
          id?: string
          legacy_id?: string | null
          price_paise: number
          product_id: string
          size: string
          sku: string
          updated_at?: string
        }
        Update: {
          colour_id?: string
          compare_at_price_paise?: number | null
          created_at?: string
          enabled?: boolean
          id?: string
          legacy_id?: string | null
          price_paise?: number
          product_id?: string
          size?: string
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_colour_id_fkey"
            columns: ["colour_id"]
            isOneToOne: false
            referencedRelation: "colours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archive_number: string | null
          archived_at: string | null
          care_instructions: string | null
          category_id: string | null
          collaboration_description: string | null
          collaboration_title: string | null
          collaborator_image_url: string | null
          collaborator_name: string | null
          compare_at_price_paise: number | null
          created_at: string
          currency: string
          design_code: string
          display_order: number
          featured: boolean
          fit_type: string
          full_description: string
          id: string
          is_limited: boolean
          is_shop_available: boolean
          is_visible: boolean
          launch_at: string | null
          legacy_id: string | null
          material: string | null
          name: string
          price_paise: number
          production_limit: number
          shipping_and_returns: string | null
          short_description: string
          slug: string
          sold_out_at: string | null
          status: string
          style: string | null
          updated_at: string
        }
        Insert: {
          archive_number?: string | null
          archived_at?: string | null
          care_instructions?: string | null
          category_id?: string | null
          collaboration_description?: string | null
          collaboration_title?: string | null
          collaborator_image_url?: string | null
          collaborator_name?: string | null
          compare_at_price_paise?: number | null
          created_at?: string
          currency?: string
          design_code: string
          display_order?: number
          featured?: boolean
          fit_type: string
          full_description?: string
          id?: string
          is_limited?: boolean
          is_shop_available?: boolean
          is_visible?: boolean
          launch_at?: string | null
          legacy_id?: string | null
          material?: string | null
          name: string
          price_paise: number
          production_limit?: number
          shipping_and_returns?: string | null
          short_description?: string
          slug: string
          sold_out_at?: string | null
          status?: string
          style?: string | null
          updated_at?: string
        }
        Update: {
          archive_number?: string | null
          archived_at?: string | null
          care_instructions?: string | null
          category_id?: string | null
          collaboration_description?: string | null
          collaboration_title?: string | null
          collaborator_image_url?: string | null
          collaborator_name?: string | null
          compare_at_price_paise?: number | null
          created_at?: string
          currency?: string
          design_code?: string
          display_order?: number
          featured?: boolean
          fit_type?: string
          full_description?: string
          id?: string
          is_limited?: boolean
          is_shop_available?: boolean
          is_visible?: boolean
          launch_at?: string | null
          legacy_id?: string | null
          material?: string | null
          name?: string
          price_paise?: number
          production_limit?: number
          shipping_and_returns?: string | null
          short_description?: string
          slug?: string
          sold_out_at?: string | null
          status?: string
          style?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_images: {
        Row: {
          alt: string
          created_at: string
          id: string
          object_path: string
          review_id: string
          slot: number
        }
        Insert: {
          alt?: string
          created_at?: string
          id?: string
          object_path: string
          review_id: string
          slot: number
        }
        Update: {
          alt?: string
          created_at?: string
          id?: string
          object_path?: string
          review_id?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_images_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          group_name: string
          id: string
          is_filterable: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          group_name: string
          id?: string
          is_filterable?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          group_name?: string
          id?: string
          is_filterable?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      variant_images: {
        Row: {
          image_id: string
          product_id: string
          sort_order: number
          variant_id: string
        }
        Insert: {
          image_id: string
          product_id: string
          sort_order: number
          variant_id: string
        }
        Update: {
          image_id?: string
          product_id?: string
          sort_order?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_images_image_id_product_id_fkey"
            columns: ["image_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_images"
            referencedColumns: ["id", "product_id"]
          },
          {
            foreignKeyName: "variant_images_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
          {
            foreignKeyName: "variant_images_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "variant_inventory_summary"
            referencedColumns: ["variant_id", "product_id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_summary: {
        Row: {
          allocated_pieces: number | null
          product_id: string | null
          production_limit: number | null
          remaining_pieces: number | null
          sold_pieces: number | null
          withdrawn_pieces: number | null
        }
        Relationships: []
      }
      variant_inventory_summary: {
        Row: {
          allocated_pieces: number | null
          product_id: string | null
          remaining_pieces: number | null
          sold_pieces: number | null
          variant_id: string | null
          withdrawn_pieces: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_get_customer: {
        Args: { customer_id: string }
        Returns: Json
      }
      admin_list_customers: {
        Args: { search_text?: string; customer_filter?: string; sort_by?: string; page_number?: number; page_size?: number }
        Returns: Json
      }
      adjust_variant_inventory: {
        Args: {
          expected_updated_at: string
          internal_note?: string
          operation: string
          product_id: string
          quantity: number
          reason: string
          variant_id: string
        }
        Returns: Json
      }
      allocate_product_run: {
        Args: {
          allocations: Json
          expected_updated_at: string
          product_id: string
        }
        Returns: Json
      }
      create_checkout_order: {
        Args: { cart_lines: Json; shipping_address_id: string; idempotency_key: string }
        Returns: Json
      }
      catalog_stock: {
        Args: never
        Returns: {
          available_quantity: number
          product_id: string
          sold_quantity: number
          variant_id: string
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      set_product_review_visibility: {
        Args: { review_id: string; visible: boolean; expected_updated_at: string }
        Returns: Json
      }
      publish_product: {
        Args: { expected_updated_at: string; product_id: string }
        Returns: Json
      }
      update_order_lifecycle: {
        Args: { order_id: string; dimension: string; next_status: string; expected_updated_at: string; reason?: string; internal_note?: string }
        Returns: Json
      }
      save_address: {
        Args: { address: Json }
        Returns: {
          address_line1: string
          address_line2: string
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string
          phone: string
          pin_code: string
          state: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "addresses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_product_draft: {
        Args: { draft: Json; expected_updated_at?: string; product_id?: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

