import { Request, Response } from 'express';
import { calculateCEAP } from '../utils/ceap';
import { calculateRvcss } from '../utils/rvcss';

import { prisma } from '../lib/prisma';

const toBool = (v: any) => v === true || v === 'true';

const safeParse = (val: any) => {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch(e) {
    return [val];
  }
};

/** POST /api/legs — Upsert leg assessment by patient_id + leg_side */
export async function upsertLeg(req: Request, res: Response): Promise<void> {
  try {
    const {
      patient_id, leg_side,
      deep_system, common_femoral_vein, superficial_femoral_vein, popliteal_vein,
      sfj_reflux, gsv_diameter, gsv_reflux, ssv_diameter, ssv_reflux,
      incompetent_perforators, clinical_signs, etiology,
      pain, varicose_veins, edema, pigmentation, inflammation,
      induration, ulcer_count, ulcer_duration, ulcer_size, compression,
      ulcer_present, ulcer_location, ulcer_size_cm, ulcer_type, ulcer_edges, ulcer_base,
      skin_changes, swelling_grade, pain_vas,
    } = req.body;

    if (!patient_id || !leg_side) {
      res.status(400).json({ error: 'patient_id and leg_side are required' });
      return;
    }

    if (!['left', 'right'].includes(leg_side)) {
      res.status(400).json({ error: 'leg_side must be "left" or "right"' });
      return;
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({ where: { id: patient_id } });
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Normalize clinical_signs to JSON string
    const signsStr = clinical_signs
      ? (typeof clinical_signs === 'string' ? clinical_signs : JSON.stringify(clinical_signs))
      : null;

    // Auto-calculate CEAP
    const ceap = calculateCEAP({
      clinical_signs: signsStr,
      common_femoral_vein, superficial_femoral_vein, popliteal_vein,
      sfj_reflux: toBool(sfj_reflux),
      gsv_diameter: gsv_diameter ? parseFloat(gsv_diameter) : null,
      gsv_reflux: toBool(gsv_reflux),
      ssv_diameter: ssv_diameter ? parseFloat(ssv_diameter) : null,
      ssv_reflux: toBool(ssv_reflux),
      incompetent_perforators: toBool(incompetent_perforators),
      deep_system,
      etiology,
    });

    // Auto-calculate rVCSS
    const rvcss_total = calculateRvcss({
      pain: parseInt(pain) || 0,
      varicose_veins: parseInt(varicose_veins) || 0,
      edema: parseInt(edema) || 0,
      pigmentation: parseInt(pigmentation) || 0,
      inflammation: parseInt(inflammation) || 0,
      induration: parseInt(induration) || 0,
      ulcer_count: parseInt(ulcer_count) || 0,
      ulcer_duration: parseInt(ulcer_duration) || 0,
      ulcer_size: parseInt(ulcer_size) || 0,
      compression: parseInt(compression) || 0,
    });

    const data = {
      deep_system: deep_system || null,
      common_femoral_vein: common_femoral_vein || null,
      superficial_femoral_vein: superficial_femoral_vein || null,
      popliteal_vein: popliteal_vein || null,
      sfj_reflux: toBool(sfj_reflux),
      gsv_diameter: gsv_diameter ? parseFloat(gsv_diameter) : null,
      gsv_reflux: toBool(gsv_reflux),
      ssv_diameter: ssv_diameter ? parseFloat(ssv_diameter) : null,
      ssv_reflux: toBool(ssv_reflux),
      incompetent_perforators: toBool(incompetent_perforators),
      clinical_signs: signsStr,
      etiology: etiology || null,
      ...ceap,
      pain: parseInt(pain) || 0,
      varicose_veins: parseInt(varicose_veins) || 0,
      edema: parseInt(edema) || 0,
      pigmentation: parseInt(pigmentation) || 0,
      inflammation: parseInt(inflammation) || 0,
      induration: parseInt(induration) || 0,
      ulcer_count: parseInt(ulcer_count) || 0,
      ulcer_duration: parseInt(ulcer_duration) || 0,
      ulcer_size: parseInt(ulcer_size) || 0,
      compression: parseInt(compression) || 0,
      rvcss_total,
      ulcer_present: toBool(ulcer_present),
      ulcer_location: ulcer_location || null,
      ulcer_size_cm: ulcer_size_cm ? parseFloat(ulcer_size_cm) : null,
      ulcer_type: ulcer_type || null,
      ulcer_edges: ulcer_edges || null,
      ulcer_base: ulcer_base || null,
      skin_changes: skin_changes || null,
      swelling_grade: swelling_grade || null,
      pain_vas: pain_vas != null ? parseInt(pain_vas) : null,
    };

    // Since @@unique([patient_id, leg_side]) was removed to allow history,
    // we fulfill the 'upsert' rule without breaking history by acting on the MOST RECENT leg visit.
    const latestLeg = await prisma.leg.findFirst({
      where: { patient_id, leg_side },
      orderBy: { created_at: 'desc' }
    });

    let leg;
    if (latestLeg) {
      leg = await prisma.leg.update({
        where: { id: latestLeg.id },
        data,
        include: { images: true, doppler: true },
      });
    } else {
      leg = await prisma.leg.create({
        data: { patient_id, leg_side, ...data },
        include: { images: true, doppler: true },
      });
    }

    res.status(200).json(leg);
  } catch (error) {
    console.error('Upsert leg error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}

/** GET /api/legs/:patientId — Get both legs for a patient */
export async function getLegs(req: Request, res: Response): Promise<void> {
  try {
    const patientId = req.params.patientId as string;

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const legs = await prisma.leg.findMany({
      where: { patient_id: patientId },
      include: {
        images: { orderBy: { uploaded_at: 'desc' } },
        doppler: { orderBy: { uploaded_at: 'desc' } },
      },
      orderBy: { leg_side: 'asc' },
    });

    const mapped = legs.map(l => ({
      ...l,
      clinical_signs: safeParse(l.clinical_signs),
    }));
    res.json(mapped);
  } catch (error) {
    console.error('Get legs error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}
