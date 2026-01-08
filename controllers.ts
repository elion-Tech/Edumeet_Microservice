import { User, Course, Progress, Notification } from './models';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import ResetToken from './resetTokenModel';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify SMTP connection configuration on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP Connection Error:', error);
    } else {
        console.log('✅ SMTP Server is ready to take our messages');
    }
});

// Controller for Course related operations
export const CourseController = {
  async getAll(req: any, res: any) {
    try {
      const courses = await Course.find({ published: true } as any).sort({ createdAt: -1 });
      res.status(200).json(courses);
    } catch (e) {
      console.error("Course.getAll error:", e);
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  },

  async getById(req: any, res: any) {
    try {
      const course = await Course.findOne({ _id: req.params.id } as any);
      if (!course) return res.status(404).json({ error: "Course not found" });
      res.status(200).json(course);
    } catch (e) {
      console.error("Course.getById error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  
  async create(req: any, res: any) {
    try {
      const courseData = req.body;
      const course = await Course.findOneAndUpdate(
          { _id: courseData._id } as any, 
          { $set: courseData }, 
          { upsert: true, new: true, runValidators: true }
      );
      res.status(201).json(course);
    } catch (e: any) {
      console.error("Course Create Error:", e);
      res.status(400).json({ error: e.message || "Validation failed during course architecture" });
    }
  },

  async delete(req: any, res: any) {
      try {
          await Course.findOneAndDelete({ _id: req.params.id } as any);
          res.status(204).send();
      } catch (e) {
          console.error("Course.delete error:", e);
          res.status(500).json({ error: "Deletion failed" });
      }
  },

  async getEnrolledStudents(req: any, res: any) {
    try {
      const { id: courseId } = req.params;
      const progressDocs = await Progress.find({ courseId } as any);
      const results = await Promise.all(progressDocs.map(async (p) => {
        const user = await User.findOne({ _id: p.userId } as any).select('-password');
        return { user, progress: p };
      }));
      res.json(results);
    } catch (e) {
      console.error("Course.getEnrolledStudents error:", e);
      res.status(500).json({ error: "Failed to fetch student data" });
    }
  },

  async scheduleLive(req: any, res: any) {
    try {
      const { courseId } = req.params;
      const session = req.body;
      const course = await Course.findOneAndUpdate({ _id: courseId } as any, { liveSession: session }, { new: true } as any);
      res.json(course);
    } catch (e) {
      console.error("Course.scheduleLive error:", e);
      res.status(500).json({ error: "Failed to schedule live session" });
    }
  }
};

// Controller for User related operations
export const UserController = {
    async getAll(req: any, res: any) {
        try {
            const users = await User.find({} as any).select('-password');
            res.json(users);
        } catch (e) {
            console.error("User.getAll error:", e);
            res.status(500).json({ error: "Failed to fetch users" });
        }
    },

    async login(req: any, res: any) {
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email } as any);
            
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials." });
            }

            if (user.isSuspended) {
                return res.status(403).json({ error: "This account has been administratively suspended." });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: "Invalid credentials." });
            }

            const userObj = user.toObject();
            delete userObj.password;
            res.json(userObj);
        } catch (e) {
            console.error("User.login error:", e);
            res.status(500).json({ error: "Authentication service error." });
        }
    },

    async save(req: any, res: any) {
      try {
        const userData = req.body;
        if (!userData.email || !userData.password || !userData._id) {
            return res.status(400).json({ error: "Identity parameters (ID, Email, Password) are required." });
        }

        const { _id, ...updateData } = userData;
        
        let user = await User.findOne({ 
            $or: [{ _id: _id }, { email: userData.email }]
        } as any);

        if (user) {
            if (user._id !== _id && user.email === userData.email) {
                return res.status(400).json({ error: "Email already registered." });
            }
            if (updateData.password && updateData.password !== user.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }
            Object.assign(user, updateData);
            await user.save();
        } else {
            userData.password = await bcrypt.hash(userData.password, 10);
            user = new User(userData);
            await user.save();
        }

        const result = user.toObject();
        delete result.password;
        res.status(201).json(result);
      } catch (e: any) {
        console.error("User Save Technical Error:", e);
        if (e.code === 11000) {
            return res.status(400).json({ error: "Email address already exists." });
        }
        res.status(400).json({ error: `Failed to create user: ${e.message || "Constraint violation."}` });
      }
    },

    async enroll(req: any, res: any) {
        const { userId } = req.params;
        const { courseId } = req.body;
        try {
            const user = await User.findOne({ _id: userId } as any);
            if (!user) return res.status(404).json({ error: "User not found" });
            
            if (!user.enrolledCourseIds.includes(courseId)) {
                user.enrolledCourseIds.push(courseId);
                await user.save();
                
                const progressId = `p_${Date.now()}_${userId.slice(-4)}`;
                const progress = new Progress({
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
        } catch (e: any) {
            console.error("User.enroll error:", e);
            res.status(500).json({ error: "Enrollment error." });
        }
    },

    async toggleSuspension(req: any, res: any) {
        try {
            const { userId } = req.params;
            const { isSuspended } = req.body;
            const user = await User.findOneAndUpdate({ _id: userId } as any, { isSuspended }, { new: true } as any).select('-password');
            if (!user) return res.status(404).json({ error: "User not found" });
            res.json(user);
        } catch (e) {
            console.error("User.toggleSuspension error:", e);
            res.status(500).json({ error: "Suspension update failed" });
        }
    },

    async delete(req: any, res: any) {
        try {
            const { userId } = req.params;
            const user = await User.findOneAndDelete({ _id: userId } as any);
            if (!user) return res.status(404).json({ error: "User not found" });
            await Progress.deleteMany({ userId } as any);
            await Notification.deleteMany({ userId } as any);
            res.status(204).send();
        } catch (e) {
            console.error("User.delete error:", e);
            res.status(500).json({ error: "Deletion failed" });
        }
    },

    async requestPasswordReset(req: any, res: any) {
        try {
            const { email } = req.body;
            const user = await User.findOne({ email } as any);
    
            if (!user) {
                // Return success even if user not found to prevent email enumeration
                return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
            }
    
            // Clear any existing reset tokens for this user
            await ResetToken.findOneAndDelete({ userId: user._id } as any);
    
            // Generate a secure random token
            const resetToken = crypto.randomBytes(32).toString('hex');
    
            // Save token to database
            await new ResetToken({
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
        } catch (error) {
            console.error('Password Reset Request Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async resetPassword(req: any, res: any) {
        try {
            const { token, newPassword } = req.body;
    
            const passwordResetToken = await ResetToken.findOne({ token } as any);
            if (!passwordResetToken) return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    
            const user = await User.findById(passwordResetToken.userId as any);
            if (!user) return res.status(400).json({ error: 'User not found.' });
    
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
            await user.save();
    
            await passwordResetToken.deleteOne();
    
            res.status(200).json({ message: 'Password has been reset successfully.' });
        } catch (error) {
            console.error('Reset Password Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

// Controller for Progress tracking
export const ProgressController = {
  async get(req: any, res: any) {
    try {
      const { userId, courseId } = req.params;
      const progress = await Progress.findOne({ userId, courseId } as any);
      if (!progress) return res.status(404).json({ error: "Progress not found" });
      res.status(200).json(progress);
    } catch (e) {
      console.error("Progress.get error:", e);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  },

  async update(req: any, res: any) {
    try {
      const progressData = req.body;
      const progress = await Progress.findOneAndUpdate(
        { _id: progressData._id } as any,
        { $set: progressData },
        { new: true, upsert: true }
      );
      res.status(200).json(progress);
    } catch (e: any) {
      console.error("Progress.update error:", e);
      res.status(400).json({ error: "Progress update failed" });
    }
  },

  async gradeCapstone(req: any, res: any) {
    try {
      const { id } = req.params;
      const { score, feedback } = req.body;
      const progress = await Progress.findOneAndUpdate(
        { _id: id } as any,
        { 
          $set: { 
            capstoneGrade: score, 
            capstoneFeedback: feedback, 
            capstoneStatus: 'graded',
            lastUpdated: new Date()
          } 
        },
        { new: true } as any
      );
      if (!progress) return res.status(404).json({ error: "Progress not found" });
      res.status(200).json(progress);
    } catch (e) {
      console.error("Progress.gradeCapstone error:", e);
      res.status(500).json({ error: "Grading failed" });
    }
  }
};

// Controller for Notifications
export const NotificationController = {
  async getByUser(req: any, res: any) {
    try {
      const { userId } = req.params;
      const notifications = await Notification.find({ userId } as any).sort({ date: -1 });
      res.status(200).json(notifications);
    } catch (e) {
      console.error("Notification.getByUser error:", e);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  },

  async send(req: any, res: any) {
    try {
      const notifData = req.body;
      const notification = new Notification({
        _id: `n_${Date.now()}`,
        ...notifData,
        date: new Date(),
        read: false
      });
      await notification.save();
      res.status(201).json(notification);
    } catch (e) {
      console.error("Notification.send error:", e);
      res.status(400).json({ error: "Failed to send notification" });
    }
  },

  async markRead(req: any, res: any) {
    try {
      const { id } = req.params;
      const notification = await Notification.findOneAndUpdate(
        { _id: id } as any,
        { $set: { read: true } },
        { new: true } as any
      );
      if (!notification) return res.status(404).json({ error: "Notification not found" });
      res.status(200).json(notification);
    } catch (e) {
      console.error("Notification.markRead error:", e);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  }
};