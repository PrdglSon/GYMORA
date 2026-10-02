import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  if (mongoose.connection.name === 'test') console.warn('Warning: using the default "test" database. Add a database name to MONGODB_URI, e.g. ...mongodb.net/gymora?...');
}
