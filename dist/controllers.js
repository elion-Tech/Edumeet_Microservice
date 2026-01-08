"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = exports.ProgressController = exports.UserController = exports.CourseController = void 0;
const models_1 = require("./models");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const resetTokenModel_1 = __importDefault(require("./resetTokenModel"));
const transporter = nodemailer_1.default.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    logger: true,
    debug: true,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    family: 4,
});
// Verify SMTP connection configuration on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP Connection Error:', error);
    }
    else {
        console.log('✅ SMTP Server is ready to take our messages');
    }
});
// Controller for Course related operations
exports.CourseController = {
    async getAll(req, res) {
        try {
            const courses = await models_1.Course.find({ published: true }).sort({ createdAt: -1 });
            res.status(200).json(courses);
        }
        catch (e) {
            console.error("Course.getAll error:", e);
            res.status(500).json({ error: "Failed to fetch courses" });
        }
    },
    async getById(req, res) {
        try {
            const course = await models_1.Course.findOne({ _id: req.params.id });
            if (!course)
                return res.status(404).json({ error: "Course not found" });
            res.status(200).json(course);
        }
        catch (e) {
            console.error("Course.getById error:", e);
            res.status(500).json({ error: "Internal server error" });
        }
    },
    async create(req, res) {
        try {
            const courseData = req.body;
            const course = await models_1.Course.findOneAndUpdate({ _id: courseData._id }, { $set: courseData }, { upsert: true, new: true, runValidators: true });
            res.status(201).json(course);
        }
        catch (e) {
            console.error("Course Create Error:", e);
            res.status(400).json({ error: e.message || "Validation failed during course architecture" });
        }
    },
    async delete(req, res) {
        try {
            await models_1.Course.findOneAndDelete({ _id: req.params.id });
            res.status(204).send();
        }
        catch (e) {
            console.error("Course.delete error:", e);
            res.status(500).json({ error: "Deletion failed" });
        }
    },
    async getEnrolledStudents(req, res) {
        try {
            const { id: courseId } = req.params;
            const progressDocs = await models_1.Progress.find({ courseId });
            const results = await Promise.all(progressDocs.map(async (p) => {
                const user = await models_1.User.findOne({ _id: p.userId }).select('-password');
                return { user, progress: p };
            }));
            res.json(results);
        }
        catch (e) {
            console.error("Course.getEnrolledStudents error:", e);
            res.status(500).json({ error: "Failed to fetch student data" });
        }
    },
    async scheduleLive(req, res) {
        try {
            const { courseId } = req.params;
            const session = req.body;
            const course = await models_1.Course.findOneAndUpdate({ _id: courseId }, { liveSession: session }, { new: true });
            res.json(course);
        }
        catch (e) {
            console.error("Course.scheduleLive error:", e);
            res.status(500).json({ error: "Failed to schedule live session" });
        }
    }
};
// Controller for User related operations
exports.UserController = {
    async getAll(req, res) {
        try {
            const users = await models_1.User.find({}).select('-password');
            res.json(users);
        }
        catch (e) {
            console.error("User.getAll error:", e);
            res.status(500).json({ error: "Failed to fetch users" });
        }
    },
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const user = await models_1.User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials." });
            }
            if (user.isSuspended) {
                return res.status(403).json({ error: "This account has been administratively suspended." });
            }
            const isMatch = await bcryptjs_1.default.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: "Invalid credentials." });
            }
            const userObj = user.toObject();
            delete userObj.password;
            res.json(userObj);
        }
        catch (e) {
            console.error("User.login error:", e);
            res.status(500).json({ error: "Authentication service error." });
        }
    },
    async save(req, res) {
        try {
            const userData = req.body;
            if (!userData.email || !userData.password || !userData._id) {
                return res.status(400).json({ error: "Identity parameters (ID, Email, Password) are required." });
            }
            const { _id, ...updateData } = userData;
            let user = await models_1.User.findOne({
                $or: [{ _id: _id }, { email: userData.email }]
            });
            if (user) {
                if (user._id !== _id && user.email === userData.email) {
                    return res.status(400).json({ error: "Email already registered." });
                }
                if (updateData.password && updateData.password !== user.password) {
                    updateData.password = await bcryptjs_1.default.hash(updateData.password, 10);
                }
                Object.assign(user, updateData);
                await user.save();
            }
            else {
                userData.password = await bcryptjs_1.default.hash(userData.password, 10);
                user = new models_1.User(userData);
                await user.save();
            }
            const result = user.toObject();
            delete result.password;
            res.status(201).json(result);
        }
        catch (e) {
            console.error("User Save Technical Error:", e);
            if (e.code === 11000) {
                return res.status(400).json({ error: "Email address already exists." });
            }
            res.status(400).json({ error: `Failed to create user: ${e.message || "Constraint violation."}` });
        }
    },
    async enroll(req, res) {
        const { userId } = req.params;
        const { courseId } = req.body;
        try {
            const user = await models_1.User.findOne({ _id: userId });
            if (!user)
                return res.status(404).json({ error: "User not found" });
            if (!user.enrolledCourseIds.includes(courseId)) {
                user.enrolledCourseIds.push(courseId);
                await user.save();
                const progressId = `p_${Date.now()}_${userId.slice(-4)}`;
                const progress = new models_1.Progress({
                    _id: progressId,
                    userId,
                    courseId,
                    completedModuleIds: [],
                    quizResults: [],
                    capstoneStatus: 'pending',
                    lastUpdated: new Date()
                });
                await progress.save();
            }
            const result = user.toObject();
            delete result.password;
            res.json(result);
        }
        catch (e) {
            console.error("User.enroll error:", e);
            res.status(500).json({ error: "Enrollment error." });
        }
    },
    async toggleSuspension(req, res) {
        try {
            const { userId } = req.params;
            const { isSuspended } = req.body;
            const user = await models_1.User.findOneAndUpdate({ _id: userId }, { isSuspended }, { new: true }).select('-password');
            if (!user)
                return res.status(404).json({ error: "User not found" });
            res.json(user);
        }
        catch (e) {
            console.error("User.toggleSuspension error:", e);
            res.status(500).json({ error: "Suspension update failed" });
        }
    },
    async delete(req, res) {
        try {
            const { userId } = req.params;
            const user = await models_1.User.findOneAndDelete({ _id: userId });
            if (!user)
                return res.status(404).json({ error: "User not found" });
            await models_1.Progress.deleteMany({ userId });
            await models_1.Notification.deleteMany({ userId });
            res.status(204).send();
        }
        catch (e) {
            console.error("User.delete error:", e);
            res.status(500).json({ error: "Deletion failed" });
        }
    },
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            const user = await models_1.User.findOne({ email });
            if (!user) {
                // Return success even if user not found to prevent email enumeration
                return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
            }
            // Clear any existing reset tokens for this user
            await resetTokenModel_1.default.findOneAndDelete({ userId: user._id });
            // Generate a secure random token
            const resetToken = crypto_1.default.randomBytes(32).toString('hex');
            // Save token to database
            await new resetTokenModel_1.default({
                userId: user._id,
                token: resetToken,
            }).save();
            // Construct Reset Link
            const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
            const link = `${clientUrl}/reset-password?token=${resetToken}`;
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Edumeet Password Reset Request',
                html: `<p>You requested a password reset. Click <a href="${link}">here</a> to reset your password.</p><p>This link expires in 1 hour.</p>`
            });
            res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }
        catch (error) {
            console.error('Password Reset Request Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            const passwordResetToken = await resetTokenModel_1.default.findOne({ token });
            if (!passwordResetToken)
                return res.status(400).json({ error: 'Invalid or expired password reset token.' });
            const user = await models_1.User.findById(passwordResetToken.userId);
            if (!user)
                return res.status(400).json({ error: 'User not found.' });
            const salt = await bcryptjs_1.default.genSalt(10);
            user.password = await bcryptjs_1.default.hash(newPassword, salt);
            await user.save();
            await passwordResetToken.deleteOne();
            res.status(200).json({ message: 'Password has been reset successfully.' });
        }
        catch (error) {
            console.error('Reset Password Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};
// Controller for Progress tracking
exports.ProgressController = {
    async get(req, res) {
        try {
            const { userId, courseId } = req.params;
            const progress = await models_1.Progress.findOne({ userId, courseId });
            if (!progress)
                return res.status(404).json({ error: "Progress not found" });
            res.status(200).json(progress);
        }
        catch (e) {
            console.error("Progress.get error:", e);
            res.status(500).json({ error: "Failed to fetch progress" });
        }
    },
    async update(req, res) {
        try {
            const progressData = req.body;
            const progress = await models_1.Progress.findOneAndUpdate({ _id: progressData._id }, { $set: progressData }, { new: true, upsert: true });
            res.status(200).json(progress);
        }
        catch (e) {
            console.error("Progress.update error:", e);
            res.status(400).json({ error: "Progress update failed" });
        }
    },
    async gradeCapstone(req, res) {
        try {
            const { id } = req.params;
            const { score, feedback } = req.body;
            const progress = await models_1.Progress.findOneAndUpdate({ _id: id }, {
                $set: {
                    capstoneGrade: score,
                    capstoneFeedback: feedback,
                    capstoneStatus: 'graded',
                    lastUpdated: new Date()
                }
            }, { new: true });
            if (!progress)
                return res.status(404).json({ error: "Progress not found" });
            res.status(200).json(progress);
        }
        catch (e) {
            console.error("Progress.gradeCapstone error:", e);
            res.status(500).json({ error: "Grading failed" });
        }
    }
};
// Controller for Notifications
exports.NotificationController = {
    async getByUser(req, res) {
        try {
            const { userId } = req.params;
            const notifications = await models_1.Notification.find({ userId }).sort({ date: -1 });
            res.status(200).json(notifications);
        }
        catch (e) {
            console.error("Notification.getByUser error:", e);
            res.status(500).json({ error: "Failed to fetch notifications" });
        }
    },
    async send(req, res) {
        try {
            const notifData = req.body;
            const notification = new models_1.Notification({
                _id: `n_${Date.now()}`,
                ...notifData,
                date: new Date(),
                read: false
            });
            await notification.save();
            res.status(201).json(notification);
        }
        catch (e) {
            console.error("Notification.send error:", e);
            res.status(400).json({ error: "Failed to send notification" });
        }
    },
    async markRead(req, res) {
        try {
            const { id } = req.params;
            const notification = await models_1.Notification.findOneAndUpdate({ _id: id }, { $set: { read: true } }, { new: true });
            if (!notification)
                return res.status(404).json({ error: "Notification not found" });
            res.status(200).json(notification);
        }
        catch (e) {
            console.error("Notification.markRead error:", e);
            res.status(500).json({ error: "Failed to mark as read" });
        }
    }
};
