import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// ── Image upload config ──
const imageStorage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const leg = await prisma.leg.findUnique({
        where: { id: parseInt(req.body.leg_id) },
        include: { patient: { select: { uhid: true } } },
      });
      if (!leg) return cb(new Error('Leg not found'), '');
      const dir = path.join(process.cwd(), 'storage', 'patients', leg.patient.uhid, 'images');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const side = _req.body.side || 'unknown';
    const view = _req.body.view_type || 'photo';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${view}_${side}_${Date.now()}${ext}`);
  },
});

export const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only JPG and PNG files are allowed'));
  },
});

// ── Doppler upload config ──
const dopplerStorage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const leg = await prisma.leg.findUnique({
        where: { id: parseInt(req.body.leg_id) },
        include: { patient: { select: { uhid: true } } },
      });
      if (!leg) return cb(new Error('Leg not found'), '');
      const dir = path.join(process.cwd(), 'storage', 'patients', leg.patient.uhid, 'doppler');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `doppler_${Date.now()}${ext}`);
  },
});

export const dopplerUpload = multer({
  storage: dopplerStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.frm', '.dcm', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, FRM, DCM, JPG, and PNG files are allowed'));
  },
});

/** POST /api/images — Upload clinical image */
export async function uploadImage(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const legId = parseInt(req.body.leg_id);
    const viewType = req.body.view_type || 'photo';

    const leg = await prisma.leg.findUnique({ where: { id: legId } });
    if (!leg) {
      res.status(404).json({ error: 'Leg not found' });
      return;
    }

    // Store relative path
    const relativePath = path.relative(process.cwd(), req.file.path);

    const image = await prisma.image.create({
      data: {
        leg_id: legId,
        file_path: relativePath,
        view_type: viewType,
      },
    });

    res.status(201).json(image);
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/doppler — Upload doppler file */
export async function uploadDoppler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const legId = parseInt(req.body.leg_id);

    const leg = await prisma.leg.findUnique({ where: { id: legId } });
    if (!leg) {
      res.status(404).json({ error: 'Leg not found' });
      return;
    }

    const relativePath = path.relative(process.cwd(), req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    const doppler = await prisma.doppler.create({
      data: {
        leg_id: legId,
        file_path: relativePath,
        file_type: ext,
        vein_type: req.body.vein_type || null,
        vein_diameter: req.body.vein_diameter ? parseFloat(req.body.vein_diameter) : null,
        reflux_time: req.body.reflux_time ? parseFloat(req.body.reflux_time) : null,
        deep_vein_status: req.body.deep_vein_status || null,
      },
    });

    res.status(201).json(doppler);
  } catch (error) {
    console.error('Upload doppler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
