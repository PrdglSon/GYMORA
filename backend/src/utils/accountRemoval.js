import {
  Member, Coach, CoachSpecialization, Payment, Attendance, PosTransaction, Booking, Enrollment, FitnessProgress, Achievement,
  Notification, Message, StaffAdmin, CommunityPost, IncidentReport, Inquiry, FitnessProgram, ProgramSchedule, OPEN_BOOKING,
} from '../models/index.js';
import { notify, toMember } from './notify.js';
import { startOfDay } from './dates.js';

const DELETED_MEMBER = 'Deleted member';
const DELETED_COACH = 'Deleted coach';
const DELETED_STAFF = 'Deleted staff';

async function renameAuthor(gym, id, label) {
  await CommunityPost.updateMany({ gym, author: id }, { $set: { authorName: label } });
  await CommunityPost.updateMany({ gym, 'comments.author': id }, { $set: { 'comments.$[c].authorName': label } }, { arrayFilters: [{ 'c.author': id }] });
  await IncidentReport.updateMany({ gym, reporter: id }, { $set: { reporterName: label } });
  await Inquiry.updateMany({ gym, sender: id }, { $set: { fullName: label, contact: '—' } });
  await Notification.deleteMany({ recipient: id });
}

export async function removeMember(member) {
  const gym = member.gym;
  const id = member._id;
  await Payment.updateMany({ gym, member: id }, { $set: { payerName: DELETED_MEMBER } });
  await Attendance.updateMany({ gym, member: id }, { $set: { name: DELETED_MEMBER } });
  await PosTransaction.updateMany({ gym, member: id }, { $set: { customerName: DELETED_MEMBER } });
  await Booking.updateMany({ gym, member: id, status: { $in: OPEN_BOOKING } }, { $set: { status: 'Cancelled', cancelledBy: 'StaffAdmin', cancelReason: 'Member account deleted', cancelledAt: new Date() } });
  await Enrollment.deleteMany({ gym, member: id });
  await FitnessProgress.deleteMany({ member: id });
  await Achievement.deleteMany({ member: id });
  await Message.deleteMany({ gym, member: id });
  await renameAuthor(gym, id, DELETED_MEMBER);
  await Member.deleteOne({ _id: id });
}

export async function removeCoach(coach) {
  const gym = coach.gym;
  const id = coach._id;
  const open = await Booking.find({ gym, coach: id, status: { $in: OPEN_BOOKING }, sessionDate: { $gte: startOfDay() } });
  for (const b of open) {
    b.status = 'Cancelled';
    b.cancelledBy = 'StaffAdmin';
    b.cancelReason = 'The coach is no longer with the gym';
    b.cancelledAt = new Date();
    await b.save();
    await notify(toMember(b.member), { gym, type: 'Booking', title: 'Booking cancelled', message: `Your session on ${new Date(b.sessionDate).toDateString()} ${b.startTime} was cancelled because the coach is no longer with the gym. Please book another coach.`, link: '/member/bookings', email: true });
  }
  await Member.updateMany({ gym, assignedCoach: id }, { $unset: { assignedCoach: 1 } });
  await FitnessProgram.updateMany({ gym, coach: id }, { $unset: { coach: 1 } });
  await ProgramSchedule.updateMany({ gym, coach: id, scheduleDate: { $gte: startOfDay() } }, { $unset: { coach: 1 } });
  await CoachSpecialization.deleteMany({ coach: id });
  await Message.deleteMany({ gym, coach: id });
  await renameAuthor(gym, id, DELETED_COACH);
  await Coach.deleteOne({ _id: id });
}

export async function removeStaff(staff) {
  const gym = staff.gym;
  const id = staff._id;
  await renameAuthor(gym, id, DELETED_STAFF);
  await StaffAdmin.deleteOne({ _id: id });
}
