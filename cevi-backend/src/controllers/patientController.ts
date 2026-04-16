import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logAudit } from '../utils/audit';

const prisma = new PrismaClient();

/** GET /api/patients — List all patients with latest CEAP + rVCSS per leg */
export async function listPatients(req: Request, res: Response): Promise<void> {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        legs: {
          select: {
            leg_side: true,
            ceap_full: true,
            rvcss_total: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(patients);
  } catch (error) {
    console.error('List patients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/patients — Create new patient with UHID uniqueness check */
export async function createPatient(req: Request, res: Response): Promise<void> {
  try {
    const { name, uhid, age, sex, height, weight, race, smoking, occupation, parity,
      comorbidities, medications, venous_history, dvt_history, clinic, doctor_notes } = req.body;

    if (!name || !uhid || !age || !sex) {
      res.status(400).json({ error: 'Name, UHID, age, and sex are required' });
      return;
    }

    const patientId = req.params.patientId as string;
    const existing = await prisma.patient.findUnique({ where: { uhid } });
    if (existing) {
      res.status(409).json({ error: 'A patient with this UHID already exists' });
      return;
    }

    const h = parseFloat(height) || 0;
    const w = parseFloat(weight) || 0;
    const bmi = h > 0 ? parseFloat((w / ((h / 100) ** 2)).toFixed(1)) : 0;

    const patient = await prisma.patient.create({
      data: {
        name,
        uhid,
        age: parseInt(age),
        sex,
        height: h,
        weight: w,
        bmi,
        race: race || null,
        smoking: smoking || null,
        occupation: occupation || null,
        parity: parity ? parseInt(parity) : null,
        comorbidities: comorbidities ? (typeof comorbidities === 'string' ? comorbidities : JSON.stringify(comorbidities)) : null,
        medications: medications ? (typeof medications === 'string' ? medications : JSON.stringify(medications)) : null,
        venous_history: venous_history ? (typeof venous_history === 'string' ? venous_history : JSON.stringify(venous_history)) : null,
        dvt_history: dvt_history === true || dvt_history === 'true',
        clinic: clinic || null,
        doctor_notes: doctor_notes || null,
      },
    });

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'CREATE_PATIENT',
      patientId: patient.id,
      details: { uhid: patient.uhid }
    });

    res.status(201).json(patient);
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/patients/:id — Full patient with legs + images + doppler */
export async function getPatient(req: Request, res: Response): Promise<void> {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id as string },
      include: {
        legs: {
          include: {
            images: { orderBy: { uploaded_at: 'desc' } },
            doppler: { orderBy: { uploaded_at: 'desc' } },
          },
        },
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'VIEW_PATIENT',
      patientId: patient.id
    });

    res.json(patient);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** PUT /api/patients/:id — Update patient demographics */
export async function updatePatient(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const { name, age, sex, height, weight, race, smoking, occupation, parity,
      comorbidities, medications, venous_history, dvt_history, clinic, doctor_notes } = req.body;

    const h = height !== undefined ? parseFloat(height) : existing.height;
    const w = weight !== undefined ? parseFloat(weight) : existing.weight;
    const bmi = h > 0 ? parseFloat((w / ((h / 100) ** 2)).toFixed(1)) : existing.bmi;

    const patient = await prisma.patient.update({
      where: { id: req.params.id as string },
      data: {
        ...(name && { name }),
        ...(age && { age: parseInt(age) }),
        ...(sex && { sex }),
        height: h,
        weight: w,
        bmi,
        ...(race !== undefined && { race }),
        ...(smoking !== undefined && { smoking }),
        ...(occupation !== undefined && { occupation }),
        ...(parity !== undefined && { parity: parity ? parseInt(parity) : null }),
        ...(comorbidities !== undefined && { comorbidities: typeof comorbidities === 'string' ? comorbidities : JSON.stringify(comorbidities) }),
        ...(medications !== undefined && { medications: typeof medications === 'string' ? medications : JSON.stringify(medications) }),
        ...(venous_history !== undefined && { venous_history: typeof venous_history === 'string' ? venous_history : JSON.stringify(venous_history) }),
        ...(dvt_history !== undefined && { dvt_history: dvt_history === true || dvt_history === 'true' }),
        ...(clinic !== undefined && { clinic }),
        ...(doctor_notes !== undefined && { doctor_notes }),
      },
    });

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'UPDATE_PATIENT',
      patientId: patient.id
    });

    res.json(patient);
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
