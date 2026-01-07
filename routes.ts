
import { Router } from 'express';
import { CourseController, UserController, ProgressController, NotificationController } from './controllers';

const router = Router();

// Auth Route
router.post('/users/login', UserController.login);
router.post('/users/request-password-reset', UserController.requestPasswordReset);
router.post('/users/reset-password', UserController.resetPassword);

// Course Routes
router.get('/courses', CourseController.getAll);
router.get('/courses/:id', CourseController.getById);
router.post('/courses', CourseController.create);
router.delete('/courses/:id', CourseController.delete);
router.get('/courses/:id/students', CourseController.getEnrolledStudents);
router.post('/courses/:courseId/live', CourseController.scheduleLive);

// User Routes
router.get('/users', UserController.getAll);
router.post('/users', UserController.save);
router.post('/users/:userId/enroll', UserController.enroll);
router.patch('/users/:userId/suspend', UserController.toggleSuspension);
router.delete('/users/:userId', UserController.delete);

// Progress Routes
router.get('/progress/:userId/:courseId', ProgressController.get);
router.put('/progress', ProgressController.update);
router.patch('/progress/:id/grade', ProgressController.gradeCapstone);

// Notification Routes
router.get('/notifications/:userId', NotificationController.getByUser);
router.post('/notifications', NotificationController.send);
router.patch('/notifications/:id/read', NotificationController.markRead);

export default router;
