"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = exports.Progress = exports.Course = exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const UserSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    phoneNumber: String,
    role: { type: String, enum: ['student', 'tutor', 'admin'], default: 'student' },
    enrolledCourseIds: { type: [String], default: [] },
    isSuspended: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });
const CourseSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    title: { type: String, required: true, index: true },
    description: String,
    thumbnailUrl: String,
    price: { type: Number, default: 0 },
    tutorId: { type: String, index: true },
    tutorName: String,
    modules: [{
            _id: String,
            title: String,
            order: Number,
            videoUrl: String,
            lessonContent: String,
            transcript: String
        }],
    quizzes: [{
            _id: String,
            title: String,
            questions: [{
                    id: String,
                    text: String,
                    options: [String],
                    correctIndex: Number
                }]
        }],
    capstone: {
        _id: String,
        instructions: String,
        type: { type: String, enum: ['project', 'final_exam'] }
    },
    liveSession: {
        topic: String,
        date: Date,
        meetingLink: String,
        isActive: { type: Boolean, default: false }
    },
    published: { type: Boolean, default: true, index: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });
const ProgressSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    completedModuleIds: { type: [String], default: [] },
    quizResults: [{ quizId: String, score: Number, passed: Boolean, attemptedAt: Date }],
    capstoneStatus: { type: String, enum: ['pending', 'submitted', 'graded'], default: 'pending' },
    capstoneSubmissionText: String,
    capstoneGrade: Number,
    capstoneFeedback: String,
    lastUpdated: { type: Date, default: Date.now }
}, { _id: false });
const NotificationSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    fromName: String,
    message: String,
    type: { type: String, enum: ['info', 'grade', 'announcement', 'live'], default: 'info' },
    read: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
}, { _id: false });
exports.User = mongoose_1.default.models.User || mongoose_1.default.model('User', UserSchema);
exports.Course = mongoose_1.default.models.Course || mongoose_1.default.model('Course', CourseSchema);
exports.Progress = mongoose_1.default.models.Progress || mongoose_1.default.model('Progress', ProgressSchema);
exports.Notification = mongoose_1.default.models.Notification || mongoose_1.default.model('Notification', NotificationSchema);
