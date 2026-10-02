import { membershipStatus, daysLeft } from './membership.js';

export const fullName = (a) => (a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : '');

export function memberDTO(m, settings) {
  if (!m) return null;
  return {
    _id: m._id,
    memberCode: m.memberCode,
    firstName: m.firstName,
    lastName: m.lastName,
    name: fullName(m),
    email: m.email,
    phoneNumber: m.phoneNumber,
    avatarUrl: m.avatarUrl,
    gender: m.gender,
    birthdate: m.birthdate,
    address: m.address,
    emergencyContact: m.emergencyContact,
    fitnessGoal: m.fitnessGoal,
    heightCm: m.heightCm,
    assignedCoach: m.assignedCoach,
    student: m.student,
    current: m.current,
    accountStatus: m.status,
    status: membershipStatus(m.current?.endDate, settings),
    daysLeft: daysLeft(m.current?.endDate),
    registrationDate: m.registrationDate,
    lastVisitAt: m.lastVisitAt,
    totalVisits: m.totalVisits,
  };
}

export function coachDTO(c, specs) {
  if (!c) return null;
  const list = specs || (c.specializationDocs || []).map((s) => s.specializationName);
  return {
    _id: c._id,
    firstName: c.firstName,
    lastName: c.lastName,
    name: fullName(c),
    email: c.email,
    phoneNumber: c.phoneNumber,
    avatarUrl: c.avatarUrl,
    specializations: list,
    certification: c.certification,
    experience: c.experience,
    bio: c.bio,
    availabilityStatus: c.availabilityStatus,
    availabilityUpdatedAt: c.availabilityUpdatedAt,
    activeStatus: c.activeStatus,
    status: c.status,
  };
}

export function staffDTO(s) {
  if (!s) return null;
  return { _id: s._id, firstName: s.firstName, lastName: s.lastName, name: fullName(s), email: s.email, phoneNumber: s.phoneNumber, avatarUrl: s.avatarUrl, role: s.role, status: s.status, lastLoginAt: s.lastLoginAt };
}
