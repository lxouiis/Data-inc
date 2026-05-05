import { useRef, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore, type LegExam } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { CeapBadge } from "@/components/ui/ceap-badge";
import { ArrowLeft, Download, Printer } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";

function LegReport({ leg, label }: { leg: LegExam; label: string }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2">
        <h3 className="text-lg font-bold text-slate-800">{label} Leg</h3>
        <CeapBadge ceap={leg.ceapTotal} />
      </div>

      {/* Doppler Findings */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a6b5c] mb-2 border-b pb-1">Doppler Findings</h4>
        <table className="w-full text-sm text-slate-700">
          <tbody>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium w-48">Common Femoral Vein</td><td className="py-1">{leg.commonFemoralVein || "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Superficial Femoral Vein</td><td className="py-1">{leg.superficialFemoralVein || "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Popliteal Vein</td><td className="py-1">{leg.poplitealVeinStatus || "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">SFJ Reflux</td><td className="py-1">{leg.sfjReflux ? "Yes" : "No"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">GSV Diameter</td><td className="py-1">{leg.gsvDiamMm ? `${leg.gsvDiamMm} mm` : "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">SSV Diameter</td><td className="py-1">{leg.ssvDiamMm ? `${leg.ssvDiamMm} mm` : "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Etiology (E)</td><td className="py-1">{leg.etiology ? `E${leg.etiology}` : "—"}</td></tr>
            <tr><td className="py-1 font-medium">Incompetent Perforators</td><td className="py-1">{leg.incompetentPerforators ? "Yes" : "No"}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Clinical Signs & Local Exam */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a6b5c] mb-2 border-b pb-1">Clinical Signs & Local Exam</h4>
        <table className="w-full text-sm text-slate-700">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1 font-medium w-48">Clinical Signs</td>
              <td className="py-1">{leg.clinicalSigns.length ? leg.clinicalSigns.join(", ") : "None"}</td>
            </tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Skin</td><td className="py-1">{leg.skin}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Swelling Grade</td><td className="py-1">{leg.swelling} / 3</td></tr>
            {leg.ulcerPresent && (
              <>
                <tr className="border-b border-slate-100"><td className="py-1 font-medium">Ulcer Present</td><td className="py-1 text-red-600 font-semibold">Yes</td></tr>
                {leg.ulcerLocationText && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Location</td><td className="py-1">{leg.ulcerLocationText}</td></tr>}
                {leg.ulcerSizeCm != null && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Size</td><td className="py-1">{leg.ulcerSizeCm} cm</td></tr>}
                {leg.ulcerType && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Type</td><td className="py-1">{leg.ulcerType}</td></tr>}
                {leg.ulcerEdges && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Edges</td><td className="py-1">{leg.ulcerEdges}</td></tr>}
                {leg.ulcerBase && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Base</td><td className="py-1">{leg.ulcerBase}</td></tr>}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AssessmentReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const assessments = useStore(state => state.assessments);
  const getPatientById = useStore(state => state.getPatientById);
  const fetchPatients = useStore(state => state.fetchPatients);
  const reportRef = useRef<HTMLDivElement>(null);

  const assessment = assessments.find(a => a.id === id);
  const patient = assessment ? getPatientById(assessment.patientId) : null;

  useEffect(() => {
    if (assessments.length > 0 && !getPatientById(assessments[0].patientId)) {
        fetchPatients();
    }
  }, [id, assessment, fetchPatients, assessments]);

  if (!assessment || !patient) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-muted-foreground">Loading assessment data...</div>
        <Button variant="outline" onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    try {
      setIsGeneratingPdf(true);
      // Let charts render completely
      await new Promise(r => setTimeout(r, 500));
      
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if content overflows A4 height
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`CEVI_Report_${patient.patientName.replace(/\s+/g, '_')}_${assessment.assessmentDate}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const rvcssData = [
    { subject: 'Pain', right: assessment.rightLeg.pain || 0, left: assessment.leftLeg.pain || 0, fullMark: 3 },
    { subject: 'Varicose Veins', right: assessment.rightLeg.varicoseVeins || 0, left: assessment.leftLeg.varicoseVeins || 0, fullMark: 3 },
    { subject: 'Venous Edema', right: assessment.rightLeg.venousEdema || 0, left: assessment.leftLeg.venousEdema || 0, fullMark: 3 },
    { subject: 'Pigmentation', right: assessment.rightLeg.skinPigmentation || 0, left: assessment.leftLeg.skinPigmentation || 0, fullMark: 3 },
    { subject: 'Inflammation', right: assessment.rightLeg.inflammation || 0, left: assessment.leftLeg.inflammation || 0, fullMark: 3 },
    { subject: 'Induration', right: assessment.rightLeg.induration || 0, left: assessment.leftLeg.induration || 0, fullMark: 3 },
    { subject: 'Ulcer No.', right: assessment.rightLeg.ulcerNumber || 0, left: assessment.leftLeg.ulcerNumber || 0, fullMark: 3 },
    { subject: 'Ulcer Dur.', right: assessment.rightLeg.ulcerDuration || 0, left: assessment.leftLeg.ulcerDuration || 0, fullMark: 3 },
    { subject: 'Ulcer Size', right: assessment.rightLeg.ulcerSizeScore || 0, left: assessment.leftLeg.ulcerSizeScore || 0, fullMark: 3 },
    { subject: 'Compliance', right: assessment.rightLeg.compressionCompliance || 0, left: assessment.leftLeg.compressionCompliance || 0, fullMark: 3 }
  ];
  
  // Calculate global rvcss manually in case it isn't calculated in Assessment
  const globalRvcssTotal = assessment.rightLeg.rvcssTotal + assessment.leftLeg.rvcssTotal;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assessment Report</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button onClick={handleDownload} disabled={isGeneratingPdf} className="bg-[#1a6b5c] hover:bg-[#134d42]">
            <Download className="mr-2 h-4 w-4" /> {isGeneratingPdf ? "Generating..." : "Download PDF"}
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white px-8 py-10 shadow-sm border rounded-lg print:shadow-none print:border-0" style={{ minHeight: '297mm' }}>
        {/* Header */}
        <div className="border-b-2 border-[#1a6b5c] pb-6 mb-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img src={`${import.meta.env.BASE_URL}kle-logo.png`} alt="KLE Logo" className="h-12 object-contain" />
              <div>
                <h2 className="text-3xl font-heading font-bold text-[#1a6b5c]">CEVI</h2>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Clinical Electronic Venous Intelligence</p>
              </div>
            </div>
            <div className="text-right text-sm text-slate-600 space-y-1">
              <p><strong>Doctor:</strong> {assessment.assessedBy}</p>
              <p><strong>Date:</strong> {formatDate(assessment.assessmentDate)}</p>
            </div>
          </div>
        </div>

        {/* Patient Info */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8 bg-slate-50 p-4 rounded-lg border">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Patient Name</p>
            <p className="font-semibold text-slate-900">{patient.patientName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">UHID</p>
            <p className="font-semibold text-slate-900">{patient.uhid}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Age / Gender</p>
            <p className="font-semibold text-slate-900">{patient.age} / {patient.gender}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Comorbidities</p>
            <p className="font-semibold text-slate-900">{assessment.comorbidities?.length ? assessment.comorbidities.join(", ") : "None"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Venous History</p>
            <p className="font-semibold text-slate-900">{assessment.venousHistory?.length ? assessment.venousHistory.join(", ") : "None"}</p>
          </div>
        </div>

        {/* Clinical Notes (Addition 1) */}
        <div className="mb-8 p-4 bg-[#fffbeb] border-l-4 border-l-[#f59e0b] rounded-r-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#f59e0b] mb-2">Clinical Notes</h3>
          {assessment.clinicalNotes ? (
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{assessment.clinicalNotes}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">No clinical notes recorded.</p>
          )}
        </div>

        {/* Per-Leg Clinical Findings */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <LegReport leg={assessment.rightLeg} label="Right" />
          <LegReport leg={assessment.leftLeg} label="Left" />
        </div>

        {/* rVCSS Visual Graphs (Addition 2) */}
        <div className="mt-10 pt-8 border-t border-slate-200" style={{ pageBreakBefore: 'always' }}>
          <h3 className="text-xl font-bold text-[#1a6b5c] mb-6 text-center">rVCSS Visualization</h3>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Right Leg Radar */}
            <div className="bg-slate-50 p-6 rounded-lg border flex flex-col items-center">
              <h4 className="text-md font-bold text-slate-800 mb-2">Right Leg</h4>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={rvcssData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 3]} tick={{ fontSize: 10 }} />
                    <Radar name="Right Leg" dataKey="right" stroke="#1a6b5c" fill="#1a6b5c" fillOpacity={0.5} />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 bg-[#1a6b5c]/10 px-6 py-2 rounded-full border border-[#1a6b5c]/30">
                <span className="font-bold text-[#1a6b5c] text-lg">Right Leg: {assessment.rightLeg.rvcssTotal} / 30</span>
              </div>
            </div>

            {/* Left Leg Radar */}
            <div className="bg-slate-50 p-6 rounded-lg border flex flex-col items-center">
              <h4 className="text-md font-bold text-slate-800 mb-2">Left Leg</h4>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={rvcssData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 3]} tick={{ fontSize: 10 }} />
                    <Radar name="Left Leg" dataKey="left" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.5} />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 bg-[#f59e0b]/10 px-6 py-2 rounded-full border border-[#f59e0b]/30">
                <span className="font-bold text-[#f59e0b] text-lg">Left Leg: {assessment.leftLeg.rvcssTotal} / 30</span>
              </div>
            </div>
          </div>

          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-slate-800">Total Global rVCSS: <span className="text-[#1a6b5c]">{globalRvcssTotal} / 60</span></h3>
          </div>

          {/* Parameter Comparison Bar Chart (Addition 3) */}
          <div className="bg-slate-50 p-6 rounded-lg border">
            <h4 className="text-lg font-bold text-slate-800 mb-6 text-center">Parameter Comparison — Right vs Left Leg</h4>
            <div className="w-full h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rvcssData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 3]} tickCount={4} />
                  <YAxis dataKey="subject" type="category" tick={{ fill: '#475569', fontSize: 11 }} width={100} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="right" name="Right Leg" fill="#1a6b5c" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="left" name="Left Leg" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="text-center mt-12 pt-8 border-t text-sm text-muted-foreground">
          <p>Generated by CEVI — Clinical Electronic Venous Intelligence</p>
        </div>
      </div>
    </div>
  );
}
