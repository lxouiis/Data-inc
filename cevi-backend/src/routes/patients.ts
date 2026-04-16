import { Router } from 'express';
import { createPatient, getPatient, listPatients, updatePatient } from '../controllers/patientController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', listPatients);
router.post('/', createPatient);
router.get('/:id', getPatient);
router.put('/:id', updatePatient);

export default router;
