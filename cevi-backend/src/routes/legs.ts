import { Router } from 'express';
import { getLegs, upsertLeg } from '../controllers/legController';


const router = Router();



router.post('/', upsertLeg);
router.get('/:patientId', getLegs);

export default router;
