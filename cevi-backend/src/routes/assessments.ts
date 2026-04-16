import { Router } from 'express';
import { createAssessment, getAssessments } from '../controllers/assessmentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Retrieve all assessments for a patient
router.get('/:patientId', authMiddleware, getAssessments);

// Create a new assessment with leg data
router.post('/', authMiddleware, createAssessment);

export default router;
