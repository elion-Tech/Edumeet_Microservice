import { User, Course, Progress, Notification, LiveClass } from './models';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';
import ResetToken from './resetTokenModel';

const resend = new Resend(process.env.RESEND_API_KEY);

// Log Resend API Key status on startup for debugging
if (!process.env.RESEND_API_KEY || !process.env.RESEND_SENDER_EMAIL || !process.env.FRONTEND_URL) {
    console.error('❌ FATAL: Critical environment variables (RESEND_API_KEY, RESEND_SENDER_EMAIL, or FRONTEND_URL) are missing.');
} else {
    console.log('✅ Resend service is initialized.');
}

// Controller for Course related operations
export const CourseController = {
  async getAll(req: Request, res: Response) {
    try {
      // Admins/Tutors can see all courses (e.g., ?view=all), students only see published ones.
      const filter: any = req.query.view === 'all' ? {} : { published: true };
      
      const courses = await Course.find(filter).sort({ createdAt: -1 });
      res.status(200).json(courses);
    } catch (e) {
      console.error("Course.getAll error:", e);
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const course = await Course.findOne({ _id: req.params.id } as any);
      if (!course) return res.status(404).json({ error: "Course not found" });
      res.status(200).json(course);
    } catch (e) {
      console.error("Course.getById error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  
  async create(req: Request, res: Response) {
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

  async togglePublish(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const course = await Course.findOne({ _id: id } as any);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      // Toggle the published status
      course.published = !course.published;
      await course.save();
      res.status(200).json(course);
    } catch (e) {
      console.error("Course.togglePublish error:", e);
      res.status(500).json({ error: "Failed to update publish status" });
    }
  },

  async delete(req: Request, res: Response) {
      try {
          await Course.findOneAndDelete({ _id: req.params.id } as any);
          res.status(204).send();
      } catch (e) {
          console.error("Course.delete error:", e);
          res.status(500).json({ error: "Deletion failed" });
      }
  },

  async getEnrolledStudents(req: Request, res: Response) {
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

  async scheduleLive(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const sessionData = req.body; // This will contain _id, topic, date, meetingLink, isActive

      if (!sessionData.topic || !sessionData.date || !sessionData.meetingLink) {
        return res.status(400).json({ error: "Topic, date, and meeting link are required." });
      }

      let liveClass;

      if (sessionData._id) {
        // Update/Toggle existing session
        liveClass = await LiveClass.findOneAndUpdate(
          { _id: sessionData._id, courseId: courseId } as any,
          { $set: sessionData },
          { new: true, runValidators: true }
        );
        if (!liveClass) {
          return res.status(404).json({ error: "Live session not found for this course." });
        }

      } else {
        // Create new session
        const existingSessions = await LiveClass.find({ courseId: courseId });
        if (existingSessions.length >= 2) {
          return res.status(400).json({ error: "Maximum of 2 live classes allowed per course." });
        }
        liveClass = new LiveClass({
          _id: `ls_${Date.now()}`,
          courseId: courseId,
          topic: sessionData.topic,
          date: sessionData.date,
          meetingLink: sessionData.meetingLink,
          isActive: sessionData.isActive ?? false // Default to false if not provided
        });
        await liveClass.save();
      }

      // Proactive Setup: Notify students automatically if a session was activated
      if (liveClass.isActive) {
          const course = await Course.findOne({ _id: courseId } as any);
          if (!course) return res.status(404).json({ error: "Course not found for notification." });

          const progressDocs = await Progress.find({ courseId: course._id } as any);
          const studentIds = progressDocs.map(p => p.userId);
          
          const notificationPromises = studentIds.map(sId => {
              return new Notification({
                  _id: `n_live_${Date.now()}_${sId.slice(-4)}`,
                  userId: sId,
                  fromName: course.tutorName || "Instructor",
                  message: `Live Class Update: ${liveClass.topic} is now scheduled for ${new Date(liveClass.date).toLocaleString()}`,
                  type: 'live',
                  date: new Date(),
                  read: false
              }).save();
          });
          await Promise.all(notificationPromises);
      }

      res.json(liveClass);
    } catch (e) {
      console.error("Course.scheduleLive error:", e);
      // Return 400 for validation or casting (Date) errors, 500 for actual server failures
      const isValidationError = (e as any).name === 'ValidationError' || (e as any).name === 'CastError';
      const status = isValidationError ? 400 : 500;
      res.status(status).json({ error: (e as any).message || "Failed to schedule live session" });
    }
  },

  async getLiveSessionsByCourse(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const liveSessions = await LiveClass.find({ courseId: courseId }).sort({ date: 1 });
      res.status(200).json(liveSessions);
    } catch (e) {
      console.error("Course.getLiveSessionsByCourse error:", e);
      res.status(500).json({ error: "Failed to fetch live sessions" });
    }
  },

  async getAllLiveSessions(req: Request, res: Response) {
    try {
      const filter: any = {};
      // If a tutorId is provided, filter by it. This assumes tutorId is stored on LiveClass or we need to join.
      // For now, let's assume LiveClass doesn't directly store tutorId, so we'll fetch all and filter on frontend or enrich.
      // A more robust solution would be to store tutorId on LiveClass or perform a lookup/join.
      // For simplicity, let's fetch all and let the frontend filter by tutor's courses.
      const liveSessions = await LiveClass.find(filter).sort({ date: 1 });
      res.status(200).json(liveSessions);
    } catch (e) {
      console.error("Course.getAllLiveSessions error:", e);
      res.status(500).json({ error: "Failed to fetch all live sessions" });
    }
  },
  }
};

// Controller for User related operations
export const UserController = {
    async getAll(req: Request, res: Response) {
        try {
            const users = await User.find({} as any).select('-password');
            res.json(users);
        } catch (e) {
            console.error("User.getAll error:", e);
            res.status(500).json({ error: "Failed to fetch users" });
        }
    },

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            // Use a case-insensitive regex search to find users even if their email was saved in uppercase
            const escapedEmail = email?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const user = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } } as any);
            
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

    async save(req: Request, res: Response) {
      try {
        const userData = req.body;
        if (!userData.email || !userData.password || !userData._id) {
            return res.status(400).json({ error: "Identity parameters (ID, Email, Password) are required." });
        }

        userData.email = userData.email.toLowerCase();

        const { _id, ...updateData } = userData;

        // Use case-insensitive check for existing email to catch legacy uppercase records
        const escapedEmail = userData.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        let user = await User.findOne({ 
            $or: [{ _id: _id }, { email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } }]
        } as any);

        if (user) {
            if (user._id !== _id && user.email.toLowerCase() === userData.email) {
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

    async enroll(req: Request, res: Response) {
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

    async toggleSuspension(req: Request, res: Response) {
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

    async delete(req: Request, res: Response) {
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

    async requestPasswordReset(req: Request, res: Response) {
        try {
            const { email } = req.body;
            const escapedEmail = email?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const user = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } } as any);
    
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
            const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const link = `${clientUrl}/#/reset-password?token=${resetToken}`;
    
            const sender = process.env.RESEND_SENDER_EMAIL;
            if (!sender) {
                console.error('❌ Configuration Error: RESEND_SENDER_EMAIL environment variable is missing.');
                return res.status(500).json({ error: 'Email service is currently misconfigured.' });
            }

            // Use Resend to send the email with robust validation
            const { data, error } = await resend.emails.send({
                from: sender,
                to: user.email,
                subject: 'Edumeet Password Reset Request',
                headers: {
                    'X-Entity-Ref-ID': resetToken // For tracking/deduplication
                },
                html: `<p>You requested a password reset. Click <a href="${link}">here</a> to reset your password.</p><p>This link expires in 1 hour.</p>`
            });
    
            if (error) {
                console.error('❌ Resend Email Send Error:', error);
                return res.status(500).json({ error: 'Failed to send password reset email.' });
            }

            console.log('✅ Password reset email sent via Resend:', data);
            res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        } catch (error) {
            console.error('Password Reset Request Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async resetPassword(req: Request, res: Response) {
        try {
            const { token, newPassword } = req.body;
    
            if (!token || !newPassword) {
                return res.status(400).json({ error: 'Token and new password are required.' });
            }

            const passwordResetToken = await ResetToken.findOne({ token } as any);
            if (!passwordResetToken) return res.status(400).json({ error: 'TOKEN_NOT_FOUND', message: 'Invalid or expired password reset token.' });
    
            const user = await User.findOne({ _id: passwordResetToken.userId } as any);
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
  async get(req: Request, res: Response) {
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

  async update(req: Request, res: Response) {
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

  async gradeCapstone(req: Request, res: Response) {
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
  async getByUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const notifications = await Notification.find({ userId } as any).sort({ date: -1 });
      res.status(200).json(notifications);
    } catch (e) {
      console.error("Notification.getByUser error:", e);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  },

  async send(req: Request, res: Response) {
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

  async markRead(req: Request, res: Response) {
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