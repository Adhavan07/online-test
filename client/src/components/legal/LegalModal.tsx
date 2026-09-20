import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Scale, FileText, AlertCircle, HelpCircle, Mail, MapPin, Building2, ExternalLink } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms' | 'proctoring' | 'grievance';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'proctoring' | 'grievance'>(defaultTab);
  const [legalConfig, setLegalConfig] = useState<any>(null);
  const [policies, setPolicies] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const [configRes, policiesRes] = await Promise.all([
          fetch('/api/legal/config'),
          fetch('/api/legal/policies'),
        ]);

        if (configRes.ok) {
          const cData = await configRes.json();
          if (cData.success) setLegalConfig(cData.config);
        }
        if (policiesRes.ok) {
          const pData = await policiesRes.json();
          if (pData.success) setPolicies(pData.policies);
        }
      } catch (err) {
        console.error('[LEGAL MODAL] Failed to load legal configuration:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  const entityName = legalConfig?.legalEntityName || '[Configured by Workspace Administrator]';
  const postalAddress = legalConfig?.legalPostalAddress || '[Configured Registered Address, India]';
  const grievanceOfficer = legalConfig?.grievanceOfficer?.name || '[Designated Grievance Officer]';
  const grievanceEmail = legalConfig?.grievanceOfficer?.email || '[grievance-contact@configured-domain.local]';
  const grievanceAddress = legalConfig?.grievanceOfficer?.address || postalAddress;
  const grievanceTimeline = legalConfig?.grievanceOfficer?.redressalTimeline || 'Acknowledgment within 24 hours; resolution within 15 days';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs">
              TS
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 font-mono tracking-tight flex items-center space-x-2">
                <span>LEGAL & PRIVACY GOVERNANCE</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-sans font-semibold">
                  DPDP Act 2023 Aligned
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 font-sans">
                Operating Framework for SaaS Technical Screening & Assessment Services in India
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-md hover:bg-zinc-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 bg-white px-6 gap-2 text-xs font-semibold select-none overflow-x-auto">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-2 border-b-2 transition flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeTab === 'privacy'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy Notice (DPDP)</span>
          </button>

          <button
            onClick={() => setActiveTab('proctoring')}
            className={`py-3 px-2 border-b-2 transition flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeTab === 'proctoring'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Proctoring Advisory</span>
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-2 border-b-2 transition flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeTab === 'terms'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
          </button>

          <button
            onClick={() => setActiveTab('grievance')}
            className={`py-3 px-2 border-b-2 transition flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeTab === 'grievance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Grievance Redressal</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-zinc-700 leading-relaxed font-sans">
          
          {/* Lawyer Review Advisory Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Compliance Implementation Notice:</span>
              <p className="text-amber-800 text-[10px]">
                This framework implements technical controls under the Digital Personal Data Protection (DPDP) Act, 2023 and the Information Technology (Intermediary Guidelines) Rules, 2021. Final legal contract language, DPA schedules, and terms must be reviewed by qualified Indian privacy counsel.
              </p>
            </div>
          </div>

          {/* TAB 1: Privacy Notice (DPDP) */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-zinc-900">
                  Privacy Notice under DPDP Act, 2023
                </h4>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  Effective Version: {legalConfig?.privacyPolicyVersion || 'DPDP-2025-v1.0'} &bull; Data Fiduciary: {entityName}
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs text-zinc-800 uppercase font-mono tracking-wider">
                  1. Categories of Personal Data Collected
                </h5>
                <ul className="list-disc pl-5 space-y-1 text-zinc-600">
                  <li><strong>Candidate Profile:</strong> Name, work/personal email, phone number, and location.</li>
                  <li><strong>Professional Data:</strong> Resume text, verified skills, and work experience details.</li>
                  <li><strong>Assessment Performance:</strong> Selected MCQ answers, written code, test scores, and question timers.</li>
                  <li><strong>Proctoring Telemetry:</strong> Periodic webcam verification frames (where enabled), tab switch events, and window focus logs.</li>
                  <li><strong>Session Logs:</strong> IP address, browser user agent, and authentication timestamps for session security and anti-tampering.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs text-zinc-800 uppercase font-mono tracking-wider">
                  2. Specified Purpose of Processing
                </h5>
                <p>
                  Personal data is processed strictly for: (i) authenticating candidates, (ii) evaluating technical competency for employment recruitment, (iii) maintaining fair evaluation integrity via algorithmic telemetry, and (iv) reporting results to the hiring employer.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs text-zinc-800 uppercase font-mono tracking-wider">
                  3. Rights of the Data Principal (Candidate)
                </h5>
                <p>Under the DPDP Act, 2023, candidates are recognized as Data Principals and possess the following rights:</p>
                <ul className="list-disc pl-5 space-y-1 text-zinc-600">
                  <li><strong>Right to Access (DSAR):</strong> Request a structured summary of personal data held on the platform.</li>
                  <li><strong>Right to Correction:</strong> Request updating or correction of inaccurate personal records.</li>
                  <li><strong>Right to Erasure:</strong> Request deletion of candidate personal data when hiring evaluation is complete, subject to statutory retention exceptions (e.g. Legal Holds).</li>
                  <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any stage, halting any active evaluation.</li>
                  <li><strong>Right to Grievance Redressal:</strong> Submit inquiries or complaints to the designated Grievance Officer.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs text-zinc-800 uppercase font-mono tracking-wider">
                  4. Storage Limitation & Retention
                </h5>
                <p>
                  Personal data is retained only as long as necessary to satisfy the hiring evaluation purpose or as required by applicable law. Biometric proctoring snapshots are purged automatically or manually according to tenant retention policies, excluding records subject to active legal holds.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Proctoring Advisory */}
          {activeTab === 'proctoring' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-zinc-900">
                  Proctoring Telemetry & Algorithmic Signals Advisory
                </h4>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  Fair Evaluation & Non-Definitive Algorithmic Monitoring Principles
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-900 text-xs">
                <strong>Algorithmic Review Notice:</strong> Automated proctoring telemetry (tab switches, full-screen exits, webcam snapshots) represents heuristic review indicators designed to assist human recruiter review. They do not constitute conclusive proof of academic or professional dishonesty.
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs text-zinc-800 uppercase font-mono tracking-wider">
                  Candidate Safeguards
                </h5>
                <ul className="list-disc pl-5 space-y-1 text-zinc-600">
                  <li><strong>Affirmative Notice:</strong> You will always be informed in advance before camera, microphone, or screen activity is monitored.</li>
                  <li><strong>Hardware Minimization:</strong> Employers can disable camera or microphone requirements when not necessary for the specific technical role.</li>
                  <li><strong>Tenant-Partitioned Storage:</strong> Proctoring snapshots are stored in isolated directories and are never shared across organizations or public endpoints.</li>
                  <li><strong>Human in the Loop:</strong> Final hiring determinations are made by human recruiters, with proctoring flags serving as review aids.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: Terms of Service */}
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-zinc-900">
                  Platform Terms of Service
                </h4>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  Governing Recruiter & Candidate Platform Usage in India
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs text-zinc-800 uppercase font-mono tracking-wider">
                  1. Employer / Data Fiduciary Responsibilities
                </h5>
                <p>
                  Recruiters and hiring organizations must ensure that job descriptions, skill requirements, and evaluation policies comply with Indian non-discrimination laws. Employers are responsible for responding to candidate privacy inquiries and determining appropriate candidate age assurance thresholds for their vacancies.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs text-zinc-800 uppercase font-mono tracking-wider">
                  2. Candidate Conduct & Assessment Integrity
                </h5>
                <p>
                  Candidates agree to complete technical assessments independently and truthfully. Candidates must not inject malicious scripts, attempt unauthorized access to other candidates' evaluations, or tamper with automated timers.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs text-zinc-800 uppercase font-mono tracking-wider">
                  3. Information Technology Rules Compliance
                </h5>
                <p>
                  Users shall not host, display, upload, or transmit any content prohibited under Rule 3(1)(b) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Grievance Redressal */}
          {activeTab === 'grievance' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-zinc-900">
                  Grievance Redressal Mechanism
                </h4>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  In compliance with Rule 3(2) of the IT Rules, 2021 and DPDP Act, 2023
                </p>
              </div>

              <p>
                If you have any grievance or inquiry regarding personal data processing, privacy rights, or platform conduct, you may contact the designated Grievance Officer:
              </p>

              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3 font-mono text-xs">
                <div className="flex items-start space-x-2.5">
                  <Building2 className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase">Entity / Data Fiduciary</span>
                    <div className="font-bold text-zinc-900 font-sans">{entityName}</div>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase">Designated Grievance Officer</span>
                    <div className="font-bold text-zinc-900 font-sans">{grievanceOfficer}</div>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <Mail className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase">Grievance & Privacy Email</span>
                    <div className="text-blue-600 font-semibold select-all">{grievanceEmail}</div>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase">Registered Postal Address</span>
                    <div className="text-zinc-700 font-sans">{postalAddress}</div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded border border-zinc-200 space-y-1">
                <span className="font-bold text-zinc-900 text-xs">Statutory Redressal Timelines:</span>
                <p className="text-zinc-600 text-[11px]">
                  {grievanceTimeline}
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between text-xs">
          <span className="text-zinc-400 text-[10px] font-mono">
            Platform Framework: DPDP Act 2023 &bull; IT Rules 2021
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded font-semibold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
