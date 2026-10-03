import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import {
  Gym, PlatformAdmin, StaffAdmin, Member, Coach, CoachSpecialization, MembershipPlan, Membership, Payment, WalkInGuest, Attendance,
  FitnessProgram, ProgramSchedule, Enrollment, FitnessProgress, Achievement, NutritionRule, IncidentReport, Inquiry, Notification,
  CommunityPost, Message, Product, Inventory, PosTransaction, PosItem, Equipment, AuditLog, Counter, nextCode,
} from '../models/index.js';
import { createGymWithOwner } from '../utils/gymSetup.js';
import { evaluateBadges, bmi } from '../utils/rules.js';
import { startOfDay, addDays } from '../utils/dates.js';

const DEMO_SLUG = 'magalona-be-fitness';
const PASSWORD = 'Demo1234!';
const reset = process.argv.includes('--reset');

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const choose = (a) => a[Math.floor(rand() * a.length)];
const at = (dayOffset, h, m = 0) => {
  const d = addDays(startOfDay(), dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};
const backdate = (Model, _id, date) => Model.collection.updateOne({ _id }, { $set: { createdAt: date } });

const GYM_MODELS = [StaffAdmin, Member, Coach, CoachSpecialization, MembershipPlan, Membership, Payment, WalkInGuest, Attendance, FitnessProgram, ProgramSchedule, Enrollment, FitnessProgress, Achievement, NutritionRule, IncidentReport, Inquiry, Notification, CommunityPost, Message, Product, Inventory, PosTransaction, PosItem, Equipment, AuditLog, Counter];

async function wipe(gymId) {
  await Promise.all(GYM_MODELS.map((M) => M.deleteMany({ gym: gymId })));
  await Gym.deleteOne({ _id: gymId });
}

async function main() {
  await connectDB();

  if (env.platformAdminEmail && env.platformAdminPassword) {
    const email = env.platformAdminEmail.toLowerCase().trim();
    const existingAdmin = await PlatformAdmin.findOne({ email });
    if (existingAdmin) {
      existingAdmin.password = env.platformAdminPassword;
      existingAdmin.status = 'active';
      await existingAdmin.save();
      console.log(`Platform admin password reset from .env: ${email}`);
    } else {
      await PlatformAdmin.create({ email, password: env.platformAdminPassword, firstName: 'Platform', lastName: 'Admin' });
      console.log(`Platform admin created: ${email}`);
    }
  } else {
    console.log('PLATFORM_ADMIN_EMAIL or PLATFORM_ADMIN_PASSWORD is missing in backend/.env, so no platform admin was created.');
  }

  if (process.argv.includes('--owner-only')) {
    console.log('Owner account ready. No demo gym was created.');
    return;
  }

  const existing = await Gym.findOne({ slug: DEMO_SLUG });
  if (existing && !reset) {
    console.log('Demo gym already exists. Run "npm run seed -- --reset" to rebuild it.');
    return;
  }
  if (existing) await wipe(existing._id);

  const { gym, admin } = await createGymWithOwner({
    slug: DEMO_SLUG,
    gym: { name: 'Magalona Be Fitness Gym', city: 'Naga City', address: 'Naga City, Camarines Sur', phoneNumber: '0917 555 0100', email: 'admin@gymora.ph', tagline: 'Strengthening fitness through technology.', about: 'A community gym in Naga City with strength, cardio, combat and mind-body programs.' },
    owner: { email: 'admin@gymora.ph', password: PASSWORD, firstName: 'Rhea', lastName: 'Santos', phoneNumber: '0917 555 0100' },
  });
  const G = gym._id;

  const frontDesk = await StaffAdmin.create({ gym: G, role: 'receptionist', email: 'frontdesk@gymora.ph', password: PASSWORD, firstName: 'Joy', lastName: 'Bautista', phoneNumber: '0917 555 0110' });

  const coachData = [
    ['Mike', 'Dela Cruz', 'coach@gymora.ph', ['Strength Training', 'HIIT', 'Weight Loss'], 6, 'NASM-CPT', 'Available'],
    ['Anna', 'Reyes', 'anna@gymora.ph', ['Yoga', 'Mobility', 'Pilates'], 4, 'RYT-200', 'In Session'],
    ['Jason', 'Cruz', 'jason@gymora.ph', ['Muay Thai', 'Functional Fitness'], 8, 'PMTA Level 2', 'Available'],
    ['Riza', 'Santos', 'riza@gymora.ph', ['Zumba', 'Weight Loss', 'Functional Fitness'], 3, 'Zumba ZIN', 'Unavailable'],
    ['Carlo', 'Mendoza', 'carlo@gymora.ph', ['Bodybuilding', 'Strength Training', 'Personal Coaching'], 10, 'ISSA-CFT', 'Available'],
  ];
  const coaches = [];
  for (const [firstName, lastName, email, specs, experience, certification, availabilityStatus] of coachData) {
    const c = await Coach.create({ gym: G, email, password: PASSWORD, firstName, lastName, phoneNumber: `0917 555 01${20 + coaches.length}`, experience, certification, availabilityStatus, availabilityUpdatedAt: new Date(), bio: `${firstName} has ${experience} years of coaching experience.` });
    await CoachSpecialization.insertMany(specs.map((specializationName) => ({ gym: G, coach: c._id, specializationName })));
    coaches.push(c);
  }

  const progData = [
    ['HIIT Training', 'HIIT', 0, [1, 3, 5], '18:00', '18:45', 20, 'Interval circuits that build conditioning and burn fat.', 'All Levels'],
    ['Strength Split', 'Strength Training', 4, [1, 2, 4, 5], '07:00', '08:00', 12, '12-week progressive overload program.', 'Intermediate'],
    ['Yoga Flow', 'Yoga', 1, [2, 4, 6], '07:15', '08:15', 18, 'Vinyasa flow for mobility and recovery.', 'All Levels'],
    ['Muay Thai Basics', 'Muay Thai', 2, [2, 4], '19:00', '20:15', 14, 'Stance, strikes, pad work and clinch basics.', 'Beginner'],
    ['Zumba Party', 'Zumba', 3, [1, 3, 6], '08:00', '08:50', 25, 'Dance cardio for all fitness levels.', 'All Levels'],
    ['Functional Fitness', 'Functional Fitness', 2, [6], '09:00', '10:00', 16, 'Kettlebells, sleds and carries for everyday strength.', 'All Levels'],
  ];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const to12h = (t) => {
    const [h, m] = t.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const programs = [];
  for (const [programName, category, ci, days, startTime, endTime, capacity, description, level] of progData) {
    const p = await FitnessProgram.create({ gym: G, programName, category, coach: coaches[ci]._id, capacity, description, level, durationWeeks: programName === 'Strength Split' ? 12 : undefined, schedule: `${days.map((d) => DOW[d]).join('/')} · ${to12h(startTime)}–${to12h(endTime)}` });
    const sessions = [];
    for (let i = -14; i < 28; i++) {
      const d = addDays(startOfDay(), i);
      if (days.includes(d.getDay())) sessions.push({ gym: G, program: p._id, coach: p.coach, scheduleDate: d, startTime, endTime });
    }
    await ProgramSchedule.insertMany(sessions);
    programs.push(p);
  }

  const plans = await MembershipPlan.find({ gym: G }).sort({ sortOrder: 1 });
  const [basic, elite, student, quarterly] = plans;
  const first = ['Paolo', 'Andrea', 'Miguel', 'Bea', 'Carlo', 'Patricia', 'Josh', 'Kim', 'Rafael', 'Trisha', 'Mark', 'Alyssa', 'James', 'Sarah', 'Kevin', 'Nicole', 'Ivan', 'Camille', 'Luis', 'Hannah', 'Gab', 'Ella', 'Renz', 'Mika', 'Dan'];
  const last = ['Reyes', 'Santos', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Ramos', 'Villanueva', 'Aquino', 'Navarro', 'Castillo', 'Flores', 'Tan', 'Lim', 'Rivera'];
  const goals = ['Weight Loss', 'Muscle Gain', 'Strength', 'General Fitness', 'Endurance', 'Flexibility'];
  const members = [];
  for (let i = 0; i < first.length; i++) {
    const firstName = first[i];
    const lastName = i === 0 ? 'Reyes' : choose(last);
    const joined = i < 20 ? at(-(30 + Math.floor(rand() * 300)), 9) : at(-Math.floor(rand() * 25), 10);
    const isStudent = i % 6 === 3;
    const m = await Member.create({
      gym: G,
      email: i === 0 ? 'member@gymora.ph' : `${firstName}.${lastName}${i}@mail.com`.toLowerCase(),
      password: PASSWORD,
      firstName,
      lastName,
      phoneNumber: `09${17 + (i % 10)} ${100 + Math.floor(rand() * 899)} ${1000 + Math.floor(rand() * 8999)}`,
      memberCode: await nextCode(G, 'member'),
      gender: i % 2 ? 'Female' : 'Male',
      fitnessGoal: i === 0 ? 'Muscle Gain' : choose(goals),
      heightCm: 155 + Math.floor(rand() * 30),
      address: 'Naga City, Camarines Sur',
      assignedCoach: i === 0 ? coaches[0]._id : rand() < 0.4 ? choose(coaches)._id : undefined,
      student: isStudent ? { isStudent: true, status: i === 9 ? 'pending' : 'verified', school: 'Ateneo de Naga University' } : undefined,
      registrationDate: joined,
    });
    await backdate(Member, m._id, joined);
    const plan = isStudent && i !== 9 ? student : i === 0 ? elite : choose([basic, elite, elite, quarterly]);
    let endOffset = i === 0 ? 24 : Math.floor(rand() * (Math.min(plan.duration, 70) - 1)) - 15;
    if (i === 5) endOffset = 3;
    if (i === 12) endOffset = -5;
    const endDate = addDays(startOfDay(), endOffset);
    const startDate = addDays(endDate, -(plan.duration - 1));
    const ms = await Membership.create({ gym: G, member: m._id, plan: plan._id, planName: plan.planName, price: plan.price, startDate, endDate, status: 'Active', createdBy: admin._id });
    const paymentDate = new Date(Math.min(startDate.getTime() + 9 * 3600e3, Date.now()));
    const pay = await Payment.create({ gym: G, receiptNo: await nextCode(G, 'receipt'), paymentType: 'Membership', membership: ms._id, member: m._id, payerName: `${firstName} ${lastName}`, description: `${plan.planName} membership`, amount: plan.price, paymentMethod: choose(['Cash', 'GCash', 'GCash', 'Card']), status: 'Paid', paymentDate, recordedBy: frontDesk._id });
    await backdate(Payment, pay._id, paymentDate);
    m.current = { membership: ms._id, plan: plan._id, planName: plan.planName, startDate, endDate };
    await m.save();
    members.push(m);
  }

  {
    const m = await Member.create({ gym: G, email: 'newbie@mail.com', password: PASSWORD, firstName: 'Aira', lastName: 'Flores', phoneNumber: '0918 222 3344', memberCode: await nextCode(G, 'member'), fitnessGoal: 'Weight Loss', heightCm: 160 });
    const ms = await Membership.create({ gym: G, member: m._id, plan: basic._id, planName: basic.planName, price: basic.price, status: 'Pending' });
    await Payment.create({ gym: G, receiptNo: await nextCode(G, 'receipt'), paymentType: 'Membership', membership: ms._id, member: m._id, payerName: 'Aira Flores', description: `${basic.planName} membership`, amount: basic.price, paymentMethod: 'Unpaid', status: 'Unpaid' });
  }

  await Enrollment.create({ gym: G, program: programs[1]._id, member: members[0]._id });
  await Enrollment.create({ gym: G, program: programs[0]._id, member: members[0]._id });
  for (const m of members.slice(1)) {
    const p = choose(programs);
    if ((await Enrollment.countDocuments({ program: p._id })) < p.capacity) await Enrollment.create({ gym: G, program: p._id, member: m._id }).catch(() => {});
  }

  const methods = ['QR Kiosk', 'QR Kiosk', 'QR Kiosk', 'Front Desk', 'Front Desk'];
  const hours = [6, 6, 7, 7, 8, 9, 10, 12, 16, 17, 17, 18, 18, 18, 19, 19, 20];
  const now = new Date();
  const att = [];
  const visit = (m, timeIn, timeOut, method) => att.push({ gym: G, attendeeType: 'Member', member: m._id, name: `${m.firstName} ${m.lastName}`, date: startOfDay(timeIn), timeIn, timeOut, method, status: timeOut ? 'Checked Out' : 'Checked In', recordedBy: method === 'Front Desk' ? frontDesk._id : undefined });
  for (let d = -29; d <= 0; d++) {
    const n = 8 + Math.floor(rand() * 9);
    for (let k = 0; k < n; k++) {
      const m = choose(members);
      if (new Date(m.current.endDate) < addDays(startOfDay(), d)) continue;
      const tin = at(d, choose(hours), Math.floor(rand() * 59));
      if (tin > now) continue;
      let tout = new Date(tin.getTime() + (55 + Math.floor(rand() * 60)) * 60000);
      if (tout > now) tout = undefined;
      visit(m, tin, tout, choose(methods));
    }
  }
  for (let d = -20; d < 0; d++) if (d % 2 === 0 || d % 3 === 0) visit(members[0], at(d, 18, 5), at(d, 19, 20), 'QR Kiosk');
  await Attendance.insertMany(att);
  for (const m of members) {
    const visits = att.filter((a) => String(a.member) === String(m._id));
    m.totalVisits = visits.length;
    m.lastVisitAt = visits.length ? new Date(Math.max(...visits.map((v) => v.timeIn))) : undefined;
    await m.save();
  }

  const guestNames = ['Jessa Lopez', 'Arnel Cruz', 'Bryan Sy', 'Lea Ocampo', 'Toni Gomez', 'Rey Abad'];
  for (let d = -14; d <= 0; d++) {
    for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) {
      const tin = at(d, choose([7, 9, 16, 17, 18]), Math.floor(rand() * 59));
      if (tin > now) continue;
      const fullName = choose(guestNames);
      let guest = await WalkInGuest.findOne({ gym: G, fullName });
      if (!guest) guest = await WalkInGuest.create({ gym: G, fullName, phoneNumber: `0919 ${100 + guestNames.indexOf(fullName)} 0000` });
      guest.visits++;
      guest.lastVisitAt = tin;
      await guest.save();
      const p = await Payment.create({ gym: G, receiptNo: await nextCode(G, 'receipt'), paymentType: 'Walk-in', walkInGuest: guest._id, payerName: fullName, description: 'Walk-in day pass', amount: gym.settings.walkInFee, paymentMethod: 'Cash', status: 'Paid', paymentDate: tin, recordedBy: frontDesk._id });
      await backdate(Payment, p._id, tin);
      const out = new Date(tin.getTime() + 70 * 60000);
      await Attendance.create({ gym: G, attendeeType: 'Walk-in', walkInGuest: guest._id, name: fullName, date: startOfDay(tin), method: 'Front Desk', timeIn: tin, timeOut: out > now ? undefined : out, status: out > now ? 'Checked In' : 'Checked Out', payment: p._id, recordedBy: frontDesk._id });
    }
  }

  const pr = [[-84, 74.0, 22.5], [-70, 73.4, 21.9], [-56, 72.6, 21.0], [-42, 72.9, 20.4], [-28, 72.1, 19.6], [-14, 71.6, 19.0], [-3, 71.2, 18.4]];
  for (const [d, w, bf] of pr) await FitnessProgress.create({ gym: G, member: members[0]._id, coach: coaches[0]._id, program: programs[1]._id, recordDate: at(d, 18), weight: w, bodyFat: bf, bmi: bmi(w, members[0].heightCm), remarks: d === -3 ? 'Bench 5x5 at 70 kg, form is solid.' : '', recordedByType: 'Coach', recordedBy: coaches[0]._id });
  for (const m of members.slice(1, 12)) {
    for (let k = 3; k >= 0; k--) {
      const w = Math.round((58 + rand() * 30 - k * 0.4) * 10) / 10;
      await FitnessProgress.create({ gym: G, member: m._id, recordDate: at(-k * 14 - 2, 18), weight: w, bodyFat: Math.round((15 + rand() * 12) * 10) / 10, bmi: bmi(w, m.heightCm), recordedByType: 'Member', recordedBy: m._id });
    }
  }

  const productData = [
    ['Whey Protein 2lb', 'Optimum Nutrition', 'Supplements', 2100, 25], ['Pre-Workout 300g', 'Cellucor C4', 'Supplements', 1250, 18], ['BCAA 30 Servings', 'MuscleTech', 'Supplements', 1100, 4],
    ['Protein Bar', 'Quest Nutrition', 'Snacks', 120, 30], ['Shaker Bottle', 'GYMORA', 'Accessories', 250, 40], ['Gym T-Shirt', 'GYMORA', 'Apparel', 650, 16], ['Gym Bag', 'GYMORA', 'Accessories', 950, 12],
    ['Water Bottle 1L', 'GYMORA', 'Accessories', 350, 20], ['Multivitamins', 'Now Foods', 'Vitamins', 780, 28], ['Peanut Butter', 'MyProtein', 'Snacks', 380, 3], ['Protein Chips', 'Quest Nutrition', 'Snacks', 180, 24],
    ['Energy Drink', 'Monster', 'Drinks', 150, 36], ['Bottled Water 500ml', 'Wilkins', 'Drinks', 25, 80], ['Electrolyte Drink', 'Gatorade', 'Drinks', 65, 42], ['Creatine 300g', 'MuscleTech', 'Supplements', 1450, 9], ['Lifting Straps', 'GYMORA', 'Accessories', 300, 2],
  ];
  const products = [];
  for (const [productName, brand, category, price, stock] of productData) {
    const p = await Product.create({ gym: G, sku: await nextCode(G, 'sku'), productName, brand, category, price, cost: Math.round(price * 0.6), stockQuantity: stock, reorderLevel: 5 });
    await Inventory.create({ gym: G, product: p._id, quantity: stock, stockAfter: stock, status: 'Initial', note: 'Opening stock', updatedBy: admin._id, lastUpdated: at(-30, 8) });
    products.push(p);
  }
  for (let d = -29; d <= 0; d++) {
    for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) {
      const when = at(d, 9 + Math.floor(rand() * 10));
      if (when > now) continue;
      const p = choose(products.filter((x) => x.price < 1500 && x.stockQuantity > 3));
      if (!p) continue;
      const quantity = 1 + Math.floor(rand() * 2);
      const total = p.price * quantity;
      const method = choose(['Cash', 'GCash']);
      const t = await PosTransaction.create({ gym: G, transactionNo: await nextCode(G, 'pos'), customerName: 'Walk-in', transactionDate: when, subtotal: total, totalAmount: total, productAmount: total, paymentMethod: method, amountTendered: total, change: 0, cashier: frontDesk._id });
      await PosItem.create({ gym: G, transaction: t._id, itemType: 'Product', product: p._id, itemName: p.productName, quantity, price: p.price });
      p.stockQuantity -= quantity;
      await p.save();
      await Inventory.create({ gym: G, product: p._id, quantity: -quantity, stockAfter: p.stockQuantity, status: 'Sale', posTransaction: t._id, updatedBy: frontDesk._id, lastUpdated: when });
      await backdate(PosTransaction, t._id, when);
    }
  }

  const eq = [['Treadmill', 'TM-01', 'Cardio', 'Operational'], ['Treadmill', 'TM-02', 'Cardio', 'Operational'], ['Treadmill', 'TM-03', 'Cardio', 'Needs Maintenance'], ['Rowing Machine', 'RW-01', 'Cardio', 'Operational'], ['Smith Machine', 'SM-01', 'Strength', 'Operational'], ['Cable Crossover', 'CC-01', 'Strength', 'Under Repair'], ['Leg Press', 'LP-01', 'Strength', 'Operational'], ['Spin Bike', 'SB-01', 'Cardio', 'Operational']];
  const equipment = [];
  for (const [equipmentName, code, category, status] of eq) equipment.push(await Equipment.create({ gym: G, equipmentName, code, category, status, location: category === 'Cardio' ? 'Cardio area' : 'Weights area', lastServicedAt: addDays(new Date(), -60), nextServiceAt: addDays(new Date(), code === 'RW-01' ? 2 : 30), maintenanceLog: [{ action: 'Added to equipment list', byName: 'Rhea Santos' }] }));

  const incident = async (data) => IncidentReport.create({ gym: G, reportNo: await nextCode(G, 'incident'), ...data });
  const nameOf = (m) => `${m.firstName} ${m.lastName}`;
  await incident({ reporterType: 'Member', reporter: members[0]._id, member: members[0]._id, reporterName: nameOf(members[0]), category: 'Equipment', subject: 'Treadmill #3 belt slipping', description: 'The belt slips above 10 km/h.', equipment: equipment[2]._id, priority: 'High', status: 'In Progress', history: [{ status: 'Open', byName: nameOf(members[0]), note: 'Submitted' }, { status: 'In Progress', byName: 'Joy Bautista', note: 'Technician scheduled.' }] });
  await incident({ reporterType: 'Member', reporter: members[3]._id, member: members[3]._id, reporterName: nameOf(members[3]), category: 'Facility', subject: 'Locker key lost', description: 'Lost the key for locker 14.', status: 'Open', history: [{ status: 'Open', byName: nameOf(members[3]), note: 'Submitted' }] });
  await incident({ reporterType: 'Coach', reporter: coaches[2]._id, reporterName: nameOf(coaches[2]), category: 'Safety', subject: 'Loose mat in the combat area', description: 'One floor mat near the heavy bags keeps sliding.', priority: 'High', status: 'Open', history: [{ status: 'Open', byName: nameOf(coaches[2]), note: 'Submitted' }] });
  await incident({ reporterType: 'Member', reporter: members[10]._id, member: members[10]._id, reporterName: nameOf(members[10]), category: 'Billing', subject: 'Double charge on GCash', description: 'Charged twice for renewal.', status: 'Resolved', resolution: 'Refunded ₱2,499 via GCash.', resolvedAt: addDays(new Date(), -3), history: [{ status: 'Resolved', byName: 'Rhea Santos', note: 'Refunded ₱2,499 via GCash.' }] });

  const inquiry = async (data) => Inquiry.create({ gym: G, inquiryNo: await nextCode(G, 'inquiry'), ...data });
  await inquiry({ inquiryType: 'Membership', senderType: 'Guest', fullName: 'Lea Ocampo', contact: '0919 103 0000', subject: 'Student rate', message: 'Is the student plan available for senior high students?' });
  await inquiry({ inquiryType: 'Inquiry', senderType: 'Guest', fullName: 'Marco Villar', contact: 'marco.v@mail.com', subject: 'Opening hours on holidays', message: 'Are you open on Rizal Day?', status: 'Resolved', response: 'Yes, from 8 AM to 6 PM.', respondedBy: frontDesk._id, respondedAt: addDays(new Date(), -2) });
  await inquiry({ inquiryType: 'Coach Application', senderType: 'Guest', fullName: 'Paula Dizon', contact: 'paula.dizon@mail.com', subject: 'Coach application: Pilates', message: 'Certified Pilates instructor, 3 years of experience.' });
  await inquiry({ inquiryType: 'Support Request', senderType: 'Member', sender: members[1]._id, senderModel: 'Member', fullName: nameOf(members[1]), contact: members[1].email, subject: 'Cannot see my QR code', message: 'The QR on my profile does not load on my phone.', status: 'In Progress' });

  await CommunityPost.create({ gym: G, authorType: 'Coach', author: coaches[0]._id, authorName: `Coach ${coaches[0].firstName}`, tag: 'Announcements', pinned: true, content: 'HIIT moves to 6:30 PM next Friday because of the Muay Thai belt test. Bring a towel and extra water!', likes: members.slice(0, 18).map((m) => m._id), comments: [{ authorType: 'Member', author: members[3]._id, authorName: nameOf(members[3]), content: 'Noted, coach!' }] });
  await CommunityPost.create({ gym: G, authorType: 'Member', author: members[1]._id, member: members[1]._id, authorName: nameOf(members[1]), tag: 'Progress', content: 'Hit a new deadlift PR today: 100 kg! Consistency is the key.', likes: members.slice(2, 20).map((m) => m._id), comments: [{ authorType: 'Coach', author: coaches[0]._id, authorName: `Coach ${coaches[0].firstName}`, content: 'Huge! Next stop 110.' }] });
  await CommunityPost.create({ gym: G, authorType: 'Coach', author: coaches[1]._id, authorName: `Coach ${coaches[1].firstName}`, tag: 'Nutrition', content: 'What is your go-to pre-workout meal? Mine is oats, banana and peanut butter 90 minutes before.', likes: members.slice(5, 12).map((m) => m._id) });
  await CommunityPost.create({ gym: G, authorType: 'StaffAdmin', author: admin._id, authorName: gym.name, tag: 'Promotions', content: 'Refer a friend this month and get 1 week free on your next renewal.', likes: members.slice(0, 9).map((m) => m._id) });

  const m1 = await Message.create({ gym: G, coach: coaches[0]._id, member: members[0]._id, senderType: 'Member', content: 'Coach, can I move my Friday session to Saturday?', readAt: at(-1, 20, 30) });
  await backdate(Message, m1._id, at(-1, 20, 15));
  const m2 = await Message.create({ gym: G, coach: coaches[0]._id, member: members[0]._id, senderType: 'Coach', content: 'Sure, join Functional Fitness at 9 AM on Saturday.' });
  await backdate(Message, m2._id, at(-1, 20, 40));

  for (const m of members) await evaluateBadges(m).catch(() => {});
  await Notification.deleteMany({ gym: G, notificationType: 'Achievement' });
  await Notification.create({ gym: G, recipientType: 'Member', recipient: members[0]._id, notificationType: 'Schedule', title: 'Session reminder', message: 'HIIT Training with Coach Mike today at 6:00 PM.', link: '/member/programs' });
  await Notification.create({ gym: G, recipientType: 'Coach', recipient: coaches[0]._id, notificationType: 'Client', title: 'New client assigned', message: 'Paolo Reyes chose you as their coach.', link: '/coach/clients' });
  await Notification.create({ gym: G, recipientType: 'StaffAdmin', recipient: admin._id, notificationType: 'Incident', title: 'New incident report', message: 'Loose mat in the combat area (Safety).', link: '/admin/incidents' });

  console.log(`
Demo gym ready: ${gym.name}  (slug: ${DEMO_SLUG})
Password for every demo account: ${PASSWORD}
  Admin login    /admin/login    admin@gymora.ph
  Staff login    /staff/login    frontdesk@gymora.ph
  Coach login    /coach/login    coach@gymora.ph
  Member login   /member/login   member@gymora.ph
Kiosk key: ${gym.settings.kioskKey}  (open /kiosk/${DEMO_SLUG})
Platform admin (/platform/login): ${env.platformAdminEmail || '(set PLATFORM_ADMIN_EMAIL in .env)'}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
