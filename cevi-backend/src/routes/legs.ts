import { Router } from 'express';
import { getLegs, upsertLeg } from '../controllers/legController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', upsertLeg);
router.get('/:patientId', getLegs);

export default router;
