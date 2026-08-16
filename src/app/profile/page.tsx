import { getProfiles, saveProfile, deleteProfile } from './actions';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ResumeImporter from './ResumeImporter';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const profiles = await getProfiles();
  
  const editingProfile = edit ? profiles.find(p => p.id === edit) : null;
  const isEditing = !!editingProfile || edit === 'new';

  async function handleSave(formData: FormData) {
    'use server'
    await saveProfile(formData);
    revalidatePath('/profile');
    redirect('/profile');
  }

  async function handleDelete(formData: FormData) {
    'use server'
    const id = formData.get('id')?.toString();
    if (id) await deleteProfile(id);
    revalidatePath('/profile');
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Candidate Profiles</h2>
        {!isEditing && (
          <Link href="/profile?edit=new" className="btn btn-primary">+ New Profile</Link>
        )}
      </div>

      {!isEditing ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {profiles.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>No candidate profiles yet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem auto' }}>
                Create a profile or import your resume to let JobSight automatically evaluate jobs against your experience, skills, and preferences.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <Link href="/profile?edit=new" className="btn btn-primary">Create Profile</Link>
                <Link href="/profile?edit=new" className="btn btn-secondary">Import Resume</Link>
              </div>
            </div>
          ) : (
            profiles.map(p => (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  {p.yearsOfProfessionalExperience} years exp • {(p.targetRoles as string[])?.length || 0} target roles
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <Link href={`/profile?edit=${p.id}`} className="btn" style={{ flex: 1, textAlign: 'center' }}>Edit</Link>
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="btn btn-secondary" style={{ color: 'var(--danger-text)' }}>Delete</button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ maxWidth: '600px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <Link href="/profile" className="btn">← Back to Profiles</Link>
          </div>
          
          <ResumeImporter />
          
          <form id="profile-form" action={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <input type="hidden" name="id" value={editingProfile?.id || ''} />
            
            <div className="form-group">
              <label className="form-label">Profile Persona Name</label>
              <input type="text" name="name" className="form-input" defaultValue={editingProfile?.name || ''} placeholder="e.g. Lead React Engineer" required />
            </div>

            <div className="form-group">
              <label className="form-label">Years of Professional Experience</label>
              <input type="number" name="yearsOfProfessionalExperience" className="form-input" defaultValue={editingProfile?.yearsOfProfessionalExperience || 0} required min="0" />
              <div className="form-text">Employment experience only. Project experience should go below.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Education</label>
              <input type="text" name="education" className="form-input" defaultValue={editingProfile?.education || ''} placeholder="e.g. BS Computer Science" />
            </div>

            <div className="form-group">
              <label className="form-label">Target Roles (comma-separated)</label>
              <input type="text" name="targetRoles" className="form-input" defaultValue={(editingProfile?.targetRoles as string[])?.join(', ') || ''} required />
              <div className="form-text">e.g., Software Engineer, Backend Engineer</div>
            </div>

            <div className="form-group">
              <label className="form-label">Professional Skills (comma-separated)</label>
              <textarea name="skills" className="form-input" defaultValue={(editingProfile?.skills as string[])?.join(', ') || ''} required rows={3}></textarea>
              <div className="form-text">Languages, frameworks, tools used professionally.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Project / Portfolio Skills (comma-separated)</label>
              <textarea name="projectExperience" className="form-input" defaultValue={(editingProfile?.projectExperience as string[])?.join(', ') || ''} rows={3}></textarea>
              <div className="form-text">Skills used in personal or portfolio projects.</div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Profile</button>
          </form>
        </div>
      )}
    </div>
  );
}
