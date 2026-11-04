
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "addresses": {
                  Row: {
                    "address1": string,"address2": string,"created_at": string,"id": string,"is_default": boolean,"label": string,"phone": string,"postal_code": string,"recipient": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address1": string,"address2"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: string,"phone": string,"postal_code": string,"recipient": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "address1"?: string,"address2"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: string,"phone"?: string,"postal_code"?: string,"recipient"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"admins": {
                  Row: {
                    "created_at": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"id": number,"row_id": string,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"id"?: never,"row_id": string,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"id"?: never,"row_id"?: string,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"id": string,"image_path": string | null,"is_active": boolean,"name": string,"parent_id": string | null,"slug": string,"sort": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_path"?: string | null,"is_active"?: boolean,"name": string,"parent_id"?: string | null,"slug": string,"sort"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_path"?: string | null,"is_active"?: boolean,"name"?: string,"parent_id"?: string | null,"slug"?: string,"sort"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"home_sections": {
                  Row: {
                    "category_id": string | null,"created_at": string,"id": string,"image_path": string | null,"image_path_2": string | null,"is_active": boolean,"items": NonNullable<Json>,"kind": Database["public"]['Enums']["home_section_kind"],"link_href": string,"link_label": string,"product_ids": (string)[],"sort": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"image_path_2"?: string | null,"is_active"?: boolean,"items"?: NonNullable<Json>,"kind": Database["public"]['Enums']["home_section_kind"],"link_href"?: string,"link_label"?: string,"product_ids"?: (string)[],"sort"?: number,"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"image_path_2"?: string | null,"is_active"?: boolean,"items"?: NonNullable<Json>,"kind"?: Database["public"]['Enums']["home_section_kind"],"link_href"?: string,"link_label"?: string,"product_ids"?: (string)[],"sort"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "home_sections_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"order_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"from_status": Database["public"]['Enums']["order_status"] | null,"id": number,"note": string,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string,"order_id"?: string,"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"image_path": string | null,"line_total": number | null,"order_id": string,"product_id": string | null,"product_name": string,"quantity": number,"sku": string,"unit_price": number,"variant_id": string | null,"variant_label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"image_path"?: string | null,"line_total"?: never,"order_id": string,"product_id"?: string | null,"product_name": string,"quantity": number,"sku": string,"unit_price": number,"variant_id"?: string | null,"variant_label": string
                  }
                  Update: {
                    "id"?: string,"image_path"?: string | null,"line_total"?: never,"order_id"?: string,"product_id"?: string | null,"product_name"?: string,"quantity"?: number,"sku"?: string,"unit_price"?: number,"variant_id"?: string | null,"variant_label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address1": string,"address2": string,"admin_note": string,"bank_account": string,"bank_holder": string,"bank_name": string,"cancel_reason": string | null,"cancel_requested_at": string | null,"cancelled_at": string | null,"carrier": string | null,"created_at": string,"delivered_at": string | null,"depositor_name": string,"id": string,"memo": string,"order_no": string,"paid_at": string | null,"payment_due_at": string,"payment_method": string,"phone": string,"postal_code": string,"recipient": string,"refunded_at": string | null,"shipped_at": string | null,"shipping_fee": number,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"tracking_no": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address1": string,"address2"?: string,"admin_note"?: string,"bank_account": string,"bank_holder": string,"bank_name": string,"cancel_reason"?: string | null,"cancel_requested_at"?: string | null,"cancelled_at"?: string | null,"carrier"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"depositor_name": string,"id"?: string,"memo"?: string,"order_no": string,"paid_at"?: string | null,"payment_due_at": string,"payment_method"?: string,"phone": string,"postal_code": string,"recipient": string,"refunded_at"?: string | null,"shipped_at"?: string | null,"shipping_fee": number,"status"?: Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"tracking_no"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "address1"?: string,"address2"?: string,"admin_note"?: string,"bank_account"?: string,"bank_holder"?: string,"bank_name"?: string,"cancel_reason"?: string | null,"cancel_requested_at"?: string | null,"cancelled_at"?: string | null,"carrier"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"depositor_name"?: string,"id"?: string,"memo"?: string,"order_no"?: string,"paid_at"?: string | null,"payment_due_at"?: string,"payment_method"?: string,"phone"?: string,"postal_code"?: string,"recipient"?: string,"refunded_at"?: string | null,"shipped_at"?: string | null,"shipping_fee"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"tracking_no"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "alt": string,"color": string | null,"created_at": string,"id": string,"product_id": string,"sort": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string,"color"?: string | null,"created_at"?: string,"id"?: string,"product_id": string,"sort"?: number,"storage_path": string
                  }
                  Update: {
                    "alt"?: string,"color"?: string | null,"created_at"?: string,"id"?: string,"product_id"?: string,"sort"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"is_active": boolean,"price_delta": number,"product_id": string,"size": string,"sku": string,"sort": number,"stock": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"price_delta"?: number,"product_id": string,"size"?: string,"sku": string,"sort"?: number,"stock"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"price_delta"?: number,"product_id"?: string,"size"?: string,"sku"?: string,"sort"?: number,"stock"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "care": string,"category_id": string | null,"compare_at_price": number | null,"created_at": string,"description": string,"id": string,"is_featured": boolean,"material": string,"name": string,"price": number,"published_at": string | null,"slug": string,"status": Database["public"]['Enums']["product_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "care"?: string,"category_id"?: string | null,"compare_at_price"?: number | null,"created_at"?: string,"description"?: string,"id"?: string,"is_featured"?: boolean,"material"?: string,"name": string,"price": number,"published_at"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["product_status"],"updated_at"?: string
                  }
                  Update: {
                    "care"?: string,"category_id"?: string | null,"compare_at_price"?: number | null,"created_at"?: string,"description"?: string,"id"?: string,"is_featured"?: boolean,"material"?: string,"name"?: string,"price"?: number,"published_at"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["product_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "age_confirmed_at": string,"created_at": string,"email": string,"id": string,"marketing_agreed_at": string | null,"name": string,"phone": string | null,"privacy_agreed_at": string,"terms_agreed_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "age_confirmed_at": string,"created_at"?: string,"email": string,"id": string,"marketing_agreed_at"?: string | null,"name": string,"phone"?: string | null,"privacy_agreed_at": string,"terms_agreed_at": string,"updated_at"?: string
                  }
                  Update: {
                    "age_confirmed_at"?: string,"created_at"?: string,"email"?: string,"id"?: string,"marketing_agreed_at"?: string | null,"name"?: string,"phone"?: string | null,"privacy_agreed_at"?: string,"terms_agreed_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"site_settings": {
                  Row: {
                    "bank_account": string,"bank_holder": string,"bank_name": string,"free_shipping_threshold": number | null,"id": number,"payment_due_hours": number,"shipping_fee": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_account"?: string,"bank_holder"?: string,"bank_name"?: string,"free_shipping_threshold"?: number | null,"id"?: number,"payment_due_hours"?: number,"shipping_fee"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "bank_account"?: string,"bank_holder"?: string,"bank_name"?: string,"free_shipping_threshold"?: number | null,"id"?: number,"payment_due_hours"?: number,"shipping_fee"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"wishlist_items": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlist_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_set_tracking":
{ Args: { "p_carrier": string,"p_order_id": string,"p_tracking_no": string }; Returns: undefined
                           },
"admin_update_order_status":
{ Args: { "p_note": string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"cancel_my_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: undefined
                           },
"create_order":
{ Args: { "p_address": Json,"p_depositor_name": string,"p_items": Json,"p_memo": string }; Returns: Json
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"expire_unpaid_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"generate_order_no":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"reorder_product_images":
{ Args: { "p_image_ids": (string)[],"p_product_id": string }; Returns: undefined
                           },
"restore_order_stock":
{ Args: { "p_order_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "home_section_kind": "hero"|"split"|"collection"|"lookbook","order_status": "pending_payment"|"paid"|"preparing"|"shipped"|"delivered"|"cancelled"|"refunded","product_status": "draft"|"active"|"archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "home_section_kind": ["hero", "split", "collection", "lookbook"],"order_status": ["pending_payment", "paid", "preparing", "shipped", "delivered", "cancelled", "refunded"],"product_status": ["draft", "active", "archived"]
          }
        }
} as const
