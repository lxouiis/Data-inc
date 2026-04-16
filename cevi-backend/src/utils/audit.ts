import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAudit(params: {
  doctorId?: number;
  doctorName?: string;
  action: string;
  patientId?: string;
  details?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        doctor_id: params.doctorId,
        doctor_name: params.doctorName,
        action: params.action,
        patient_id: params.patientId,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (error) {
    console.error('Audit logging failed:', error);
    // Don't throw error to avoid breaking the main request flow
  }
}
