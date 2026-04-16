import { Router } from 'express';
import { getFile } from '../controllers/fileController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Securely serve files — requires JWT
router.get('/:type/:id', authMiddleware, getFile);

export default router;
