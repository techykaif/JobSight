'use client';

import { useState } from 'react';
import { extractProfileFromInput } from './actions';
import type { ExtractedProfile } from '@/lib/profile/extractionSchema';

export default function ResumeImporter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedProfile | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setExtracted(null);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await extractProfileFromInput(formData);
      if (res.success) {
        setExtracted(res.extracted);
      } else {
        setError('Extraction failed unexpectedly.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during extraction.');
    } finally {
      setLoading(false);
    }
  }

  function applyToForm() {
    if (!extracted) return;

    const form = document.getElementById('profile-form') as HTMLFormElement;
    if (!form) {
      alert('Please ensure the profile form is visible to apply data.');
      return;
    }

    const setInputValue = (name: string, value: string) => {
      const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement;
      if (input) input.value = value;
    };

    if (extracted.experience?.yearsOfProfessionalExperience !== null) {
      setInputValue('yearsOfProfessionalExperience', String(extracted.experience.yearsOfProfessionalExperience));
    }

    // Education: each record is { degree, institution, status, ... }
    // Serialize as "Degree — Institution (Status) | Degree — Institution" to keep records distinct.
    // Using " | " as the inter-record separator (safe: won't appear in degree/institution names).
    if (extracted.education?.length) {
      const eduParts = extracted.education.map(rec => {
        let part = `${rec.degree} — ${rec.institution}`;
        if (rec.status) part += ` (${rec.status})`;
        return part;
      });
      setInputValue('education', eduParts.join(' | '));
    }

    if (extracted.target?.targetRoles?.length) {
      setInputValue('targetRoles', extracted.target.targetRoles.join(', '));
    }

    const allSkills = [
      ...(extracted.skills?.programmingLanguages || []),
      ...(extracted.skills?.frameworks || []),
      ...(extracted.skills?.databases || []),
      ...(extracted.skills?.cloudPlatforms || []),
      ...(extracted.skills?.tools || []),
      ...(extracted.skills?.otherTechnicalSkills || [])
    ];
    if (allSkills.length) {
      setInputValue('skills', allSkills.join(', '));
    }

    if (extracted.projects?.projectSkills?.length || extracted.projects?.portfolioProjects?.length) {
      const projExp = [
        ...(extracted.projects.portfolioProjects || []),
        ...(extracted.projects.projectSkills || [])
      ];
      setInputValue('projectExperience', projExp.join(', '));
    } else {
      setInputValue('projectExperience', '');
    }

    alert('Profile data applied. Please review each field and click "Save Profile".');
  }

  return (
    <div className="resume-importer-card">
      <div className="resume-importer-header">
        <div className="resume-importer-header-icon" aria-hidden="true">
          ⬆
        </div>
        <div>
          <h3 className="resume-importer-title">Import from Resume</h3>
          <p className="resume-importer-subtitle">
            Upload your PDF, DOCX, or TXT and we&apos;ll extract your profile automatically.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="resume-importer-form">
        <div className="resume-file-drop-zone">
          <input
            type="file"
            name="resumeFile"
            id="resume-file-input"
            accept=".pdf,.docx,.txt"
            className="resume-file-input-hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
          />
          <label htmlFor="resume-file-input" className="resume-file-drop-label">
            <span className="resume-file-drop-icon" aria-hidden="true">📄</span>
            {fileName ? (
              <span className="resume-file-selected">{fileName}</span>
            ) : (
              <span className="resume-file-placeholder">
                Click to upload <strong>PDF</strong>, <strong>DOCX</strong>, or <strong>TXT</strong>
              </span>
            )}
          </label>
        </div>

        <div className="resume-importer-divider">
          <span>or paste text</span>
        </div>

        <div className="profile-field">
          <label htmlFor="resume-paste" className="profile-label">
            Paste Resume / LinkedIn Summary
          </label>
          <textarea
            id="resume-paste"
            name="pastedText"
            rows={4}
            className="profile-input profile-textarea"
            placeholder="Paste your resume or LinkedIn About section here..."
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary resume-extract-btn"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="resume-spinner" aria-hidden="true" />
              Extracting…
            </>
          ) : (
            'Extract Profile'
          )}
        </button>
      </form>

      {error && (
        <div className="resume-importer-error" role="alert">
          <strong>Extraction failed:</strong> {error}
        </div>
      )}

      {extracted && (
        <div className="resume-preview-card">
          <div className="resume-preview-header">
            <span className="resume-preview-badge">✓ Extracted</span>
            <h4 className="resume-preview-title">Profile Preview</h4>
          </div>
          <div className="resume-preview-fields">
            <div className="resume-preview-row">
              <span className="resume-preview-label">Experience</span>
              <span className="resume-preview-value">
                {extracted.experience?.yearsOfProfessionalExperience != null
                  ? `${extracted.experience.yearsOfProfessionalExperience} years`
                  : 'Not found'}
              </span>
            </div>
            <div className="resume-preview-row">
              <span className="resume-preview-label">Education</span>
              <span className="resume-preview-value">
                {extracted.education?.length
                  ? extracted.education.map((rec, i) => (
                      <span key={i} style={{ display: 'block' }}>
                        {rec.degree}{rec.status ? ` (${rec.status})` : ''} — {rec.institution}
                      </span>
                    ))
                  : 'Not found'}
              </span>
            </div>
            <div className="resume-preview-row">
              <span className="resume-preview-label">Target Roles</span>
              <span className="resume-preview-value">
                {extracted.target?.targetRoles?.join(', ') || 'Not found'}
              </span>
            </div>
            <div className="resume-preview-row">
              <span className="resume-preview-label">Top Skills</span>
              <span className="resume-preview-value">
                {[
                  ...(extracted.skills?.programmingLanguages || []),
                  ...(extracted.skills?.frameworks || [])
                ].join(', ') || 'Not found'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={applyToForm}
            className="btn btn-primary resume-apply-btn"
          >
            Apply to Form ↓
          </button>
        </div>
      )}
    </div>
  );
}
