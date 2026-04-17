import { Request, Response } from 'express';
import { calculateCEAP } from '../utils/ceap';
import { calculateRvcss } from '../utils/rvcss';
import { logAudit } from '../utils/audit';

import { prisma } from '../lib/prisma';

// Helper to calculate score and normalize fields for Leg creation.
// Accepts both camelCase (frontend) and snake_case field names.
const toBool = (v: any) => v === true || v === 'true';

const buildLegData = (leg: any, legSide: 'right' | 'left', patientId: string) => {
  // Resolve camelCase (frontend LegExam) → snake_case with snake_case fallback
  const rawSigns = leg.clinicalSigns ?? leg.clinical_signs;
  const signsStr = rawSigns != null
    ? (Array.isArray(rawSigns) ? JSON.stringify(rawSigns) : String(rawSigns))
    : null;

  const deepSystem            = leg.deepSystem            || leg.deep_system              || null;
  const commonFemoralVein     = leg.commonFemoralVein     || leg.common_femoral_vein      || null;
  const superficialFemoralVein= leg.superficialFemoralVein|| leg.superficial_femoral_vein || null;
  const poplitealVein         = leg.poplitealVeinStatus   || leg.popliteal_vein           || null;
  const sfjReflux             = toBool(leg.sfjReflux      ?? leg.sfj_reflux);
  const gsvDiameter           = leg.gsvDiamMm             ?? leg.gsv_diameter;
  const gsvReflux             = toBool(leg.gsvReflux      ?? leg.gsv_reflux);
  const ssvDiameter           = leg.ssvDiamMm             ?? leg.ssv_diameter;
  const ssvReflux             = toBool(leg.ssvReflux      ?? leg.ssv_reflux);
  const incompetentPerforators= toBool(leg.incompetentPerforators ?? leg.incompetent_perforators);

  const pain         = parseInt(leg.pain)                                    || 0;
  const varicoseVeins= parseInt(leg.varicoseVeins    ?? leg.varicose_veins)  || 0;
  const edema        = parseInt(leg.venousEdema      ?? leg.edema)           || 0;
  const pigmentation = parseInt(leg.skinPigmentation ?? leg.pigmentation)    || 0;
  const inflammation = parseInt(leg.inflammation)                            || 0;
  const induration   = parseInt(leg.induration)                              || 0;
  const ulcerCount   = parseInt(leg.ulcerNumber      ?? leg.ulcer_count)     || 0;
  const ulcerDuration= parseInt(leg.ulcerDuration    ?? leg.ulcer_duration)  || 0;
  const ulcerSize    = parseInt(leg.ulcerSizeScore   ?? leg.ulcer_size)      || 0;
  const compression  = parseInt(leg.compressionCompliance ?? leg.compression)|| 0;

  const ceap = calculateCEAP({
    clinical_signs: signsStr,
    common_femoral_vein: commonFemoralVein,
    superficial_femoral_vein: superficialFemoralVein,
    popliteal_vein: poplitealVein,
    sfj_reflux: sfjReflux,
    gsv_diameter: gsvDiameter ? parseFloat(gsvDiameter) : null,
    gsv_reflux: gsvReflux,
    ssv_diameter: ssvDiameter ? parseFloat(ssvDiameter) : null,
    ssv_reflux: ssvReflux,
    incompetent_perforators: incompetentPerforators,
    deep_system: deepSystem,
    etiology: leg.etiology || null,
  });

  const rvcss_total = calculateRvcss({
    pain, varicose_veins: varicoseVeins, edema, pigmentation,
    inflammation, induration, ulcer_count: ulcerCount,
    ulcer_duration: ulcerDuration, ulcer_size: ulcerSize, compression,
  });

  const ulcerSizeCmRaw = leg.ulcerSizeCm ?? leg.ulcer_size_cm;

  return {
    patient_id: patientId,
    leg_side: legSide,
    deep_system: deepSystem,
    common_femoral_vein: commonFemoralVein,
    superficial_femoral_vein: superficialFemoralVein,
    popliteal_vein: poplitealVein,
    sfj_reflux: sfjReflux,
    gsv_diameter: gsvDiameter ? parseFloat(gsvDiameter) : null,
    gsv_reflux: gsvReflux,
    ssv_diameter: ssvDiameter ? parseFloat(ssvDiameter) : null,
    ssv_reflux: ssvReflux,
    incompetent_perforators: incompetentPerforators,
    clinical_signs: signsStr,
    etiology: leg.etiology || null,
    ...ceap,
    pain, varicose_veins: varicoseVeins, edema, pigmentation,
    inflammation, induration,
    ulcer_count: ulcerCount, ulcer_duration: ulcerDuration,
    ulcer_size: ulcerSize, compression,
    rvcss_total,
    ulcer_present: toBool(leg.ulcerPresent ?? leg.ulcer_present),
    ulcer_location: leg.ulcerLocationText || leg.ulcer_location || null,
    ulcer_size_cm: ulcerSizeCmRaw ? parseFloat(ulcerSizeCmRaw) : null,
    ulcer_type: leg.ulcerType  || leg.ulcer_type  || null,
    ulcer_edges: leg.ulcerEdges|| leg.ulcer_edges || null,
    ulcer_base: leg.ulcerBase  || leg.ulcer_base  || null,
    skin_changes: leg.skin     || leg.skin_changes || null,
    swelling_grade: leg.swelling != null ? String(leg.swelling) : (leg.swelling_grade || null),
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
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
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
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}
