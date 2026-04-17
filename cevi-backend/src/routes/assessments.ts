import { Router } from 'express';
import { createAssessment, getAssessments } from '../controllers/assessmentController';


const router = Router();

// Retrieve all assessments for a patient
router.get('/:patientId', getAssessments);

// Create a new assessment with leg data
router.post('/', createAssessment);

export default router;
