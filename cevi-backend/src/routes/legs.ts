import { Router } from 'express';
import { getLegs, createLeg } from '../controllers/legController';

const router = Router();

router.post('/', createLeg);
router.get('/:patientId', getLegs);

export default router;
