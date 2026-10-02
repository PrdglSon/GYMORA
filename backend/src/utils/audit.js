import { AuditLog } from '../models/index.js';

export async function audit(req, module, action, meta) {
  try {
    const a = req.account;
    await AuditLog.create({
      gym: req.gymId || a?.gym,
      actorType: req.accountType,
      actor: a?._id,
      actorName: a ? `${a.firstName} ${a.lastName}` : 'System',
      role: req.role || 'system',
      module,
      action,
      meta,
      ip: req.ip,
    });
  } catch (err) {
    console.error('[audit] failed:', err.message);
  }
}

export async function auditSystem(gym, module, action, meta) {
  try {
    await AuditLog.create({ gym, actorName: 'System', role: 'system', module, action, meta });
  } catch (err) {
    console.error('[audit] failed:', err.message);
  }
}
