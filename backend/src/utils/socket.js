let io = null;

export function setIO(instance) {
  io = instance;
}
export const rooms = {
  gym: (id) => `gym:${id}`,
  staff: (id) => `staff:${id}`,
  account: (type, id) => `acct:${type}:${id}`,
};
export function emitToGym(gymId, event, payload = {}) {
  if (io && gymId) io.to(rooms.gym(gymId)).emit(event, payload);
}
export function emitToStaff(gymId, event, payload = {}) {
  if (io && gymId) io.to(rooms.staff(gymId)).emit(event, payload);
}
export function emitToAccount(type, id, event, payload = {}) {
  if (io && id) io.to(rooms.account(type, id)).emit(event, payload);
}
