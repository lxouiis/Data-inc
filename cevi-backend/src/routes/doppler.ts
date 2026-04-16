import { Router } from 'express';
import { dopplerUpload, uploadDoppler } from '../controllers/uploadController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', dopplerUpload.single('file'), uploadDoppler);

export default router;
