import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateCEAP } from '../utils/ceap';
import { calculateRvcss } from '../utils/rvcss';
import { logAudit } from '../utils/audit';

const prisma = new PrismaClient();

// Helper to calculate score and normalize fields for Leg creation
const buildLegData = (leg: any, legSide: 'right' | 'left', patientId: string) => {
  const signsStr = leg.clinical_signs
    ? typeof leg.clinical_signs === 'string' ? leg.clinical_signs : JSON.stringify(leg.clinical_signs)
    : null;

  const ceap = calculateCEAP({
    clinical_signs: signsStr,
    common_femoral_vein: leg.common_femoral_vein,
    superficial_femoral_vein: leg.superficial_femoral_vein,
    popliteal_vein: leg.popliteal_vein,
    sfj_reflux: leg.sfj_reflux === true,
    gsv_diameter: leg.gsv_diameter ? parseFloat(leg.gsv_diameter) : null,
    gsv_reflux: leg.gsv_reflux === true,
    ssv_diameter: leg.ssv_diameter ? parseFloat(leg.ssv_diameter) : null,
    ssv_reflux: leg.ssv_reflux === true,
    incompetent_perforators: leg.incompetent_perforators === true,
    deep_system: leg.deep_system,
    etiology: leg.etiology,
  });

  const rvcss_total = calculateRvcss({
    pain: parseInt(leg.pain) || 0,
    varicose_veins: parseInt(leg.varicose_veins) || 0,
    edema: parseInt(leg.edema) || 0,
    pigmentation: parseInt(leg.pigmentation) || 0,
    inflammation: parseInt(leg.inflammation) || 0,
    induration: parseInt(leg.induration) || 0,
    ulcer_count: parseInt(leg.ulcer_count) || 0,
    ulcer_duration: parseInt(leg.ulcer_duration) || 0,
    ulcer_size: parseInt(leg.ulcer_size) || 0,
    compression: parseInt(leg.compression) || 0,
  });

  return {
    patient_id: patientId,
    leg_side: legSide,
    deep_system: leg.deep_system || null,
    common_femoral_vein: leg.common_femoral_vein || null,
    superficial_femoral_vein: leg.superficial_femoral_vein || null,
    popliteal_vein: leg.popliteal_vein || null,
    sfj_reflux: leg.sfj_reflux === true,
    gsv_diameter: leg.gsv_diameter ? parseFloat(leg.gsv_diameter) : null,
    gsv_reflux: leg.gsv_reflux === true,
    ssv_diameter: leg.ssv_diameter ? parseFloat(leg.ssv_diameter) : null,
    ssv_reflux: leg.ssv_reflux === true,
    incompetent_perforators: leg.incompetent_perforators === true,
    clinical_signs: signsStr,
    etiology: leg.etiology || null,
    ...ceap,
    pain: parseInt(leg.pain) || 0,
    varicose_veins: parseInt(leg.varicose_veins) || 0,
    edema: parseInt(leg.edema) || 0,
    pigmentation: parseInt(leg.pigmentation) || 0,
    inflammation: parseInt(leg.inflammation) || 0,
    induration: parseInt(leg.induration) || 0,
    ulcer_count: parseInt(leg.ulcer_count) || 0,
    ulcer_duration: parseInt(leg.ulcer_duration) || 0,
    ulcer_size: parseInt(leg.ulcer_size) || 0,
    compression: parseInt(leg.compression) || 0,
    rvcss_total,
    ulcer_present: leg.ulcer_present === true,
    ulcer_location: leg.ulcer_location || null,
    ulcer_size_cm: leg.ulcer_size_cm ? parseFloat(leg.ulcer_size_cm) : null,
    ulcer_type: leg.ulcer_type || null,
    ulcer_edges: leg.ulcer_edges || null,
    ulcer_base: leg.ulcer_base || null,
    skin_changes: leg.skin_changes || null,
    swelling_grade: leg.swelling_grade || null,
    pain_vas: leg.pain_vas != null ? parseInt(leg.pain_vas) : null,
  };
};

/** POST /api/assessments — Create Assessment with both legs */
export async function createAssessment(req: Request, res: Response): Promise<void> {
  try {
    const { patientId, comorbidities, venousHistory, clinicalNotes, rightPainVas, leftPainVas, veinesNotes, rightLeg, leftLeg } = req.body;

    if (!patientId || !rightLeg || !leftLeg) {
      res.status(400).json({ error: 'patientId, rightLeg, and leftLeg are required' });
      return;
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const rightData = buildLegData(rightLeg, 'right', patientId);
    const leftData = buildLegData(leftLeg, 'left', patientId);
    const globalRvcss = (rightData.rvcss_total || 0) + (leftData.rvcss_total || 0);

    // Create assessment and legs in a transaction
    const assessment = await prisma.$transaction(async (tx) => {
      const newAss = await tx.assessment.create({
        data: {
          patient_id: patientId,
          assessed_by: req.user?.name || req.body.assessedBy || 'Unknown Doctor',
          comorbidities: comorbidities ? JSON.stringify(comorbidities) : null,
          venous_history: venousHistory ? JSON.stringify(venousHistory) : null,
          clinical_notes: clinicalNotes || null,
          veines_notes: veinesNotes || null,
          right_pain_vas: parseInt(rightPainVas) || null,
          left_pain_vas: parseInt(leftPainVas) || null,
          global_rvcss: globalRvcss,
        }
      });

      // Insert legs linking to assessment
      await tx.leg.create({ data: { ...rightData, assessment_id: newAss.id } });
      await tx.leg.create({ data: { ...leftData, assessment_id: newAss.id } });

      return newAss;
    });

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'CREATE_ASSESSMENT',
      patientId,
      details: JSON.stringify({ assessmentId: assessment.id }),
    });

    res.status(201).json(assessment);
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/assessments/:patientId — Fetch all assessments and connected legs */
export async function getAssessments(req: Request, res: Response): Promise<void> {
  try {
    const patientId = req.params.patientId as string;

    const assessments = await prisma.assessment.findMany({
      where: { patient_id: patientId },
      include: {
        legs: true
      },
      orderBy: { assessment_date: 'desc' }
    });

    res.json(assessments);
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
