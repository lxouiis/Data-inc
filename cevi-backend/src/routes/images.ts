import { Router } from 'express';
import { imageUpload, uploadImage } from '../controllers/uploadController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', imageUpload.single('image'), uploadImage);

export default router;
