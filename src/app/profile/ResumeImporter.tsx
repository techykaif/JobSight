'use client';

import { useState } from 'react';
import { extractProfileFromInput } from './actions';
import type { ExtractedProfile } from '@/lib/profile/extractionSchema';

export default function ResumeImporter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedProfile | null>(null);
  
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
    
    // Find the main profile edit form and populate it
    const form = document.getElementById('profile-form') as HTMLFormElement;
    if (!form) {
      alert('Please ensure the profile form is open to apply data.');
      return;
    }
    
    const setInputValue = (name: string, value: string) => {
      const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement;
      if (input) input.value = value;
    };

    if (extracted.experience?.yearsOfProfessionalExperience !== null) {
      setInputValue('yearsOfProfessionalExperience', String(extracted.experience.yearsOfProfessionalExperience));
    }
    
    if (extracted.education?.degrees?.length || extracted.education?.institutions?.length) {
      const edu = [...(extracted.education.degrees || []), ...(extracted.education.institutions || [])].join(' at ');
      setInputValue('education', edu);
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

    if (extracted.experience?.roles?.length || extracted.experience?.notableResponsibilities?.length) {
      const projExp = [
        ...(extracted.experience.roles || []),
        ...(extracted.experience.notableResponsibilities || [])
      ];
      setInputValue('projectExperience', projExp.join(', '));
    }
    
    alert('Profile data applied to the form. Please review and click "Save Profile".');
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
      <h3>Import from Resume</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Upload a PDF, DOCX, or TXT file, or paste your resume text to extract your structured candidate profile.
      </p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Upload Resume Document</label>
          <input type="file" name="resumeFile" accept=".pdf,.docx,.txt" className="form-input" />
        </div>
        
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>OR</div>
        
        <div className="form-group">
          <label className="form-label">Paste Context / LinkedIn Summary</label>
          <textarea name="pastedText" rows={4} className="form-input" placeholder="Paste your resume or experience here..."></textarea>
        </div>
        
        <button type="submit" className="btn btn-secondary" disabled={loading}>
          {loading ? 'Extracting Intelligence...' : 'Extract Profile'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--danger-bg, #fee2e2)', color: 'var(--danger-text, #991b1b)', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {extracted && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-primary)' }}>
          <h4 style={{ margin: '0 0 1rem 0' }}>Extracted Profile Preview</h4>
          
          <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p><strong>Years of Exp:</strong> {extracted.experience?.yearsOfProfessionalExperience ?? 'Unknown'}</p>
            <p><strong>Target Roles:</strong> {extracted.target?.targetRoles?.join(', ') || 'None found'}</p>
            <p><strong>Education:</strong> {extracted.education?.degrees?.join(', ') || 'None found'}</p>
            <p><strong>Top Skills:</strong> {extracted.skills?.programmingLanguages?.join(', ')} {extracted.skills?.frameworks?.join(', ')}</p>
          </div>
          
          <div style={{ marginTop: '1rem' }}>
            <button type="button" onClick={applyToForm} className="btn btn-primary" style={{ width: '100%' }}>
              Apply to Profile Form ↓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
