// Résout le vendor accessible à l'utilisateur courant.
// Cherche d'abord `vendors.auth_user_id = userId` (propriétaire historique),
// puis retombe sur `account_memberships` (kind=vendor, status=active) pour
// couvrir les comptes multi-utilisateurs (membres non propriétaires).
//
// Si `preferredVendorId` est fourni et accessible, il est renvoyé en priorité.
// Renvoie `null` si aucun vendor n'est accessible.

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface ResolvedVendor {
  id: string;
  name: string | null;
  company_name: string | null;
  vat_number: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
}

const VENDOR_COLUMNS =
  "id, name, company_name, vat_number, address_line1, postal_code, city, country_code, phone, email, bank_name, iban, bic";

export async function resolveVendorForUser(
  admin: Admin,
  userId: string,
  preferredVendorId?: string | null,
): Promise<ResolvedVendor | null> {
  // 1) Owner path
  const ownerQuery = admin.from("vendors").select(VENDOR_COLUMNS).eq("auth_user_id", userId);
  const { data: ownerRows } = await ownerQuery;
  const ownerIds = new Set<string>((ownerRows ?? []).map((r: any) => r.id));

  // 2) Membership path
  const { data: memberships } = await admin
    .from("account_memberships")
    .select("account_id")
    .eq("user_id", userId)
    .eq("account_kind", "vendor")
    .eq("status", "active");
  const memberIds = new Set<string>((memberships ?? []).map((r: any) => r.account_id));

  const accessibleIds = new Set<string>([...ownerIds, ...memberIds]);
  if (accessibleIds.size === 0) return null;

  // Preferred vendor wins if accessible
  if (preferredVendorId && accessibleIds.has(preferredVendorId)) {
    const { data } = await admin
      .from("vendors")
      .select(VENDOR_COLUMNS)
      .eq("id", preferredVendorId)
      .maybeSingle();
    if (data) return data as ResolvedVendor;
  }

  // Otherwise return the first accessible vendor (owner-first)
  const firstOwner = (ownerRows ?? [])[0];
  if (firstOwner) return firstOwner as ResolvedVendor;

  const firstMemberId = [...memberIds][0];
  const { data } = await admin
    .from("vendors")
    .select(VENDOR_COLUMNS)
    .eq("id", firstMemberId)
    .maybeSingle();
  return (data as ResolvedVendor) ?? null;
}
