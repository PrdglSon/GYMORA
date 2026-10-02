import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const POST_TAGS = ['Progress', 'Nutrition', 'Questions', 'Announcements', 'Promotions', 'Events'];
export const AUTHOR_MODELS = ['Member', 'Coach', 'StaffAdmin'];

const authorRef = { authorType: { type: String, enum: AUTHOR_MODELS, required: true }, author: { type: ObjectId, refPath: 'authorType', required: true } };

const commentSchema = new mongoose.Schema({ authorType: { type: String, enum: AUTHOR_MODELS, required: true }, author: { type: ObjectId, required: true }, authorName: String, content: { type: String, maxlength: 300 }, datePosted: { type: Date, default: Date.now } });

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    ...authorRef,
    member: { type: ObjectId, ref: 'Member' },
    authorName: String,
    content: { type: String, required: true, maxlength: 1000 },
    image: String,
    tag: { type: String, enum: POST_TAGS, default: 'Progress' },
    likes: [{ type: ObjectId }],
    comments: [commentSchema],
    pinned: { type: Boolean, default: false },
    status: { type: String, enum: ['Visible', 'Hidden'], default: 'Visible' },
    datePosted: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('CommunityPost', schema);
