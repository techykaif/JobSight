'use client';

import { useRef, useEffect, useState } from 'react';
import ResumeImporter from '@/app/profile/ResumeImporter';
import { saveProfile } from '@/app/profile/actions';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ProfileModal({ isOpen, onClose, onSaved }: ProfileModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Handle native ESC key close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  async function handleAction(formData: FormData) {
    setIsSaving(true);
    try {
      await saveProfile(formData);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save profile', err);
      alert('Failed to save profile. Please check your inputs.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog 
      ref={dialogRef} 
      className="profile-modal"
      style={{ 
        padding: '2rem', 
        borderRadius: '8px', 
        border: '1px solid var(--border-color)', 
        backgroundColor: 'var(--bg-primary)', 
        maxWidth: '800px', 
        width: '100%', 
        maxHeight: '90vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Create Candidate Profile</h2>
        <button type="button" onClick={onClose} className="btn" aria-label="Close modal">✕</button>
      </div>
      
      <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 100px)', paddingRight: '1rem' }}>
        <ResumeImporter />
        
        <form id="profile-form" action={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div className="form-group">
            <label className="form-label">Profile Persona Name</label>
            <input type="text" name="name" className="form-input" placeholder="e.g. Lead React Engineer" required />
          </div>

          <div className="form-group">
            <label className="form-label">Years of Professional Experience</label>
            <input type="number" name="yearsOfProfessionalExperience" className="form-input" defaultValue={0} required min="0" />
            <div className="form-text">Employment experience only. Project experience should go below.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Education</label>
            <input type="text" name="education" className="form-input" placeholder="e.g. BS Computer Science" />
          </div>

          <div className="form-group">
            <label className="form-label">Target Roles (comma-separated)</label>
            <input type="text" name="targetRoles" className="form-input" placeholder="e.g., Software Engineer, Backend Engineer" required />
          </div>

          <div className="form-group">
            <label className="form-label">Professional Skills (comma-separated)</label>
            <textarea name="skills" className="form-input" placeholder="React, Node.js, TypeScript" required rows={3}></textarea>
            <div className="form-text">Languages, frameworks, tools used professionally.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Project / Portfolio Skills (comma-separated)</label>
            <textarea name="projectExperience" className="form-input" placeholder="Docker, AWS" rows={3}></textarea>
            <div className="form-text">Skills used in personal or portfolio projects.</div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }
      `}</style>
    </dialog>
  );
}
