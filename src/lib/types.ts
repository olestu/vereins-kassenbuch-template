export type CategoryType = "income" | "expense";
export type PaymentMethod = "cash" | "bank" | "other";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  is_active: boolean;
  /** EÜR-Zeilengruppe (nur Kleinunternehmer-Profil) */
  euer_line: string | null;
  /** Privatentnahme/-einlage: zählt für den Kassenbestand, nicht für die EÜR */
  is_private: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string;
  amount_cents: number;
  occurred_on: string;
  payment_method: PaymentMethod;
  payee: string | null;
  description: string | null;
  receipt_path: string | null;
  ocr_raw_text: string | null;
  receipt_filename: string | null;
  receipt_size_bytes: number | null;
  receipt_mime: string | null;
  extracted_data: unknown | null;
  /** Storno-Zeitpunkt — storniert statt gelöscht (GoBD) */
  voided_at: string | null;
  /** Fortlaufende Belegnummer */
  voucher_no: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithCategory extends Transaction {
  category: Category;
}

export type ReimbursementStatus = "submitted" | "accepted" | "rejected";

export interface ReimbursementLink {
  id: string;
  user_id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ReimbursementRequest {
  id: string;
  link_id: string | null;
  owner_user_id: string;
  status_token: string;
  submitter_name: string;
  submitter_contact: string | null;
  amount_cents: number;
  occurred_on: string;
  category_id: string | null;
  description: string | null;
  iban: string | null;
  receipt_path: string | null;
  extracted_data: unknown | null;
  status: ReimbursementStatus;
  review_comment: string | null;
  transaction_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface ReimbursementRequestWithCategory extends ReimbursementRequest {
  category: Category | null;
}

export interface CategoryInsert {
  id?: string;
  user_id?: string;
  name: string;
  type: CategoryType;
  is_active?: boolean;
  euer_line?: string | null;
  is_private?: boolean;
  created_at?: string;
}

export interface TransactionInsert {
  id?: string;
  user_id?: string;
  category_id: string;
  amount_cents: number;
  occurred_on: string;
  payment_method?: PaymentMethod;
  payee?: string | null;
  description?: string | null;
  receipt_path?: string | null;
  ocr_raw_text?: string | null;
  receipt_filename?: string | null;
  receipt_size_bytes?: number | null;
  receipt_mime?: string | null;
  extracted_data?: unknown | null;
  created_at?: string;
  updated_at?: string;
}
