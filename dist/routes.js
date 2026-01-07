"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("./controllers");
const router = (0, express_1.Router)();
// Auth Route
router.post('/users/login', controllers_1.UserController.login);
router.post('/users/request-password-reset', controllers_1.UserController.requestPasswordReset);
router.post('/users/reset-password', controllers_1.UserController.resetPassword);
// Course Routes
router.get('/courses', controllers_1.CourseController.getAll);
router.get('/courses/:id', controllers_1.CourseController.getById);
router.post('/courses', controllers_1.CourseController.create);
router.delete('/courses/:id', controllers_1.CourseController.delete);
router.get('/courses/:id/students', controllers_1.CourseController.getEnrolledStudents);
router.post('/courses/:courseId/live', controllers_1.CourseController.scheduleLive);
// User Routes
router.get('/users', controllers_1.UserController.getAll);
router.post('/users', controllers_1.UserController.save);
router.post('/users/:userId/enroll', controllers_1.UserController.enroll);
router.patch('/users/:userId/suspend', controllers_1.UserController.toggleSuspension);
router.delete('/users/:userId', controllers_1.UserController.delete);
// Progress Routes
router.get('/progress/:userId/:courseId', controllers_1.ProgressController.get);
router.put('/progress', controllers_1.ProgressController.update);
router.patch('/progress/:id/grade', controllers_1.ProgressController.gradeCapstone);
// Notification Routes
router.get('/notifications/:userId', controllers_1.NotificationController.getByUser);
router.post('/notifications', controllers_1.NotificationController.send);
router.patch('/notifications/:id/read', controllers_1.NotificationController.markRead);
exports.default = router;
