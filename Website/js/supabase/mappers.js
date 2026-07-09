export function profileToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone || '',
    address: row.address || '',
    userType: row.user_type || 'employed',
    campusId: row.campus_id || '',
    twoFactorEnabled: row.two_factor_enabled ?? false,
  };
}

export function userToProfile(user) {
  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    address: user.address || '',
    user_type: user.userType || 'employed',
    campus_id: user.campusId || '',
    two_factor_enabled: user.twoFactorEnabled ?? false,
  };
}

export function propertyFromRow(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    address: row.address,
    city: row.city,
    type: row.type,
    rentPrice: Number(row.rent_price),
    deposit: Number(row.deposit),
    rooms: row.rooms,
    bathrooms: row.bathrooms,
    area: Number(row.area),
    status: row.status,
    occupied: row.occupied,
    nearCampus: row.near_campus || '',
    photos: row.photos || [],
    amenities: row.amenities || {},
    description: row.description || '',
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function propertyToRow(prop) {
  return {
    id: prop.id,
    owner_id: prop.ownerId,
    title: prop.title,
    address: prop.address,
    city: prop.city,
    type: prop.type,
    rent_price: prop.rentPrice,
    deposit: prop.deposit,
    rooms: prop.rooms,
    bathrooms: prop.bathrooms,
    area: prop.area,
    status: prop.status,
    occupied: prop.occupied,
    near_campus: prop.nearCampus || '',
    photos: prop.photos || [],
    amenities: prop.amenities || {},
    description: prop.description || '',
    reject_reason: prop.rejectReason || null,
    created_at: prop.createdAt,
    updated_at: prop.updatedAt || null,
  };
}

export function contractRequestFromRow(row) {
  return {
    id: row.id,
    propertyId: row.property_id,
    tenantId: row.tenant_id,
    landlordId: row.landlord_id,
    status: row.status,
    contractId: row.contract_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function contractRequestToRow(req) {
  return {
    id: req.id,
    property_id: req.propertyId,
    tenant_id: req.tenantId,
    landlord_id: req.landlordId,
    status: req.status,
    contract_id: req.contractId || null,
    created_at: req.createdAt,
    resolved_at: req.resolvedAt || null,
  };
}

export function contractFromRow(row) {
  return {
    id: row.id,
    propertyId: row.property_id,
    landlordId: row.landlord_id,
    tenantId: row.tenant_id,
    requestId: row.request_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    contractNumber: row.contract_number ?? null,
    signedAt: row.signed_at,
    pdfGeneratedAt: row.pdf_generated_at,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at,
    signature: row.signature,
    landlordSignature: row.landlord_signature,
    partiesSummary: row.parties_summary,
  };
}

export function contractToRow(c) {
  return {
    id: c.id,
    property_id: c.propertyId,
    landlord_id: c.landlordId,
    tenant_id: c.tenantId,
    request_id: c.requestId || null,
    start_date: c.startDate,
    end_date: c.endDate,
    status: c.status,
    contract_number: c.contractNumber ?? null,
    signed_at: c.signedAt || null,
    pdf_generated_at: c.pdfGeneratedAt || null,
    pdf_url: c.pdfUrl || null,
    created_at: c.createdAt,
    signature: c.signature || null,
    landlord_signature: c.landlordSignature || null,
    parties_summary: c.partiesSummary || null,
  };
}

export function paymentFromRow(row) {
  return {
    id: row.id,
    contractId: row.contract_id,
    propertyId: row.property_id,
    tenantId: row.tenant_id,
    landlordId: row.landlord_id,
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    type: row.type,
    month: row.month,
    paidAt: row.paid_at,
    verifiedBy: row.verified_by,
    disputeReason: row.dispute_reason,
    proof: row.proof,
    createdAt: row.created_at,
  };
}

export function paymentToRow(p) {
  return {
    id: p.id,
    contract_id: p.contractId || null,
    property_id: p.propertyId,
    tenant_id: p.tenantId,
    landlord_id: p.landlordId,
    amount: p.amount,
    due_date: p.dueDate,
    status: p.status,
    type: p.type,
    month: p.month,
    paid_at: p.paidAt || null,
    verified_by: p.verifiedBy || null,
    dispute_reason: p.disputeReason || null,
    proof: p.proof || null,
    created_at: p.createdAt,
  };
}

export function notificationFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    read: row.read,
    sentAt: row.sent_at,
  };
}

export function notificationToRow(n) {
  return {
    id: n.id,
    user_id: n.userId,
    type: n.type,
    message: n.message,
    read: n.read,
    sent_at: n.sentAt,
  };
}

export function auditFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    details: row.details,
    timestamp: row.created_at,
  };
}

export function auditToRow(log) {
  return {
    id: log.id,
    user_id: log.userId,
    action: log.action,
    details: log.details,
    created_at: log.timestamp,
  };
}

export function favoriteFromRow(row) {
  return {
    userId: row.user_id,
    propertyId: row.property_id,
    savedAt: row.saved_at,
  };
}

export function favoriteToRow(f) {
  return {
    user_id: f.userId,
    property_id: f.propertyId,
    saved_at: f.savedAt,
  };
}
