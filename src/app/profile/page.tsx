import { getProfiles, saveProfile, deleteProfile } from './actions';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ResumeImporter from './ResumeImporter';

export const metadata = {
  title: 'Candidate Profile — JobSight',
  description: 'Build your candidate profile to evaluate jobs against your experience, skills, and preferences.',
};

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
    <div className="profile-workspace">
      {/* Page Header */}
      <div className="profile-page-header">
        <div className="profile-page-header-text">
          {isEditing && (
            <Link href="/profile" className="profile-back-link">
              ← Profiles
            </Link>
          )}
          <h1 className="profile-page-title">
            {isEditing
              ? (editingProfile ? `Editing: ${editingProfile.name}` : 'New Candidate Profile')
              : 'Candidate Profiles'}
          </h1>
          <p className="profile-page-subtitle">
            {isEditing
              ? 'Build your profile once, apply it across all your job hunts.'
              : 'Profiles let JobSight score jobs against your skills, experience, and target roles.'}
          </p>
        </div>
        {!isEditing && (
          <Link href="/profile?edit=new" className="btn btn-primary">
            + New Profile
          </Link>
        )}
      </div>

      {!isEditing ? (
        <div>
          {profiles.length === 0 ? (
            <div className="profile-empty-state">
              <div className="profile-empty-icon" aria-hidden="true">👤</div>
              <h3>No profiles yet</h3>
              <p>Create a profile or import your resume to let JobSight automatically evaluate jobs against your background.</p>
              <div className="profile-empty-actions">
                <Link href="/profile?edit=new" className="btn btn-primary">Create Profile</Link>
                <Link href="/profile?edit=new" className="btn">Import Resume</Link>
              </div>
            </div>
          ) : (
            <div className="profile-grid">
              {profiles.map(p => (
                <div key={p.id} className="profile-card">
                  <div className="profile-card-avatar" aria-hidden="true">
                    {(p.name || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div className="profile-card-body">
                    <h3 className="profile-card-name">{p.name}</h3>
                    <div className="profile-card-meta">
                      <span>{p.yearsOfProfessionalExperience}y exp</span>
                      <span className="profile-card-meta-dot" aria-hidden="true">·</span>
                      <span>{(p.targetRoles as string[])?.length || 0} roles</span>
                      <span className="profile-card-meta-dot" aria-hidden="true">·</span>
                      <span>{(p.skills as string[])?.length || 0} skills</span>
                    </div>
                    {(p.targetRoles as string[])?.length > 0 && (
                      <div className="profile-card-roles">
                        {(p.targetRoles as string[]).slice(0, 3).map((role, i) => (
                          <span key={i} className="profile-role-chip">{role}</span>
                        ))}
                        {(p.targetRoles as string[]).length > 3 && (
                          <span className="profile-role-chip profile-role-chip-more">
                            +{(p.targetRoles as string[]).length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="profile-card-actions">
                    <Link href={`/profile?edit=${p.id}`} className="btn">Edit Profile</Link>
                    <form action={handleDelete} style={{ display: 'contents' }}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="profile-card-delete-btn" aria-label={`Delete ${p.name}`}>
                        ✕
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="profile-editor-layout">
          {/* Resume Import */}
          <ResumeImporter />

          {/* Main form */}
          <form id="profile-form" action={handleSave} className="profile-form">
            <input type="hidden" name="id" value={editingProfile?.id || ''} />

            {/* Section: Profile Basics */}
            <section className="profile-section">
              <div className="profile-section-header">
                <span className="profile-section-icon" aria-hidden="true">◎</span>
                <div>
                  <h2 className="profile-section-title">Profile Basics</h2>
                  <p className="profile-section-subtitle">How you&apos;ll be identified across your hunts.</p>
                </div>
              </div>
              <div className="profile-field">
                <label htmlFor="profile-name" className="profile-label">
                  Profile Name <span className="profile-label-required" aria-label="required">*</span>
                </label>
                <input
                  id="profile-name"
                  type="text"
                  name="name"
                  className="profile-input"
                  defaultValue={editingProfile?.name || ''}
                  placeholder="e.g. Senior React Engineer"
                  required
                  autoComplete="off"
                />
                <span className="profile-helper">Give this profile a descriptive name for the role you&apos;re targeting.</span>
              </div>
            </section>

            {/* Section: Experience */}
            <section className="profile-section">
              <div className="profile-section-header">
                <span className="profile-section-icon" aria-hidden="true">⧖</span>
                <div>
                  <h2 className="profile-section-title">Experience</h2>
                  <p className="profile-section-subtitle">Professional employment history, not personal projects.</p>
                </div>
              </div>
              <div className="profile-field">
                <label htmlFor="profile-exp" className="profile-label">
                  Years of Professional Experience <span className="profile-label-required" aria-label="required">*</span>
                </label>
                <div className="profile-number-wrapper">
                  <input
                    id="profile-exp"
                    type="number"
                    name="yearsOfProfessionalExperience"
                    className="profile-input profile-input-number"
                    defaultValue={editingProfile?.yearsOfProfessionalExperience ?? 0}
                    required
                    min="0"
                    step="0.5"
                  />
                  <span className="profile-number-unit">years</span>
                </div>
                <span className="profile-helper">Employment experience only. Internships count proportionally (2 months = 0.17).</span>
              </div>
            </section>

            {/* Section: Education */}
            <section className="profile-section">
              <div className="profile-section-header">
                <span className="profile-section-icon" aria-hidden="true">◈</span>
                <div>
                  <h2 className="profile-section-title">Education</h2>
                  <p className="profile-section-subtitle">Degrees and institutions.</p>
                </div>
              </div>
              <div className="profile-field">
                <label htmlFor="profile-education" className="profile-label">Degree &amp; Institution</label>
                <input
                  id="profile-education"
                  type="text"
                  name="education"
                  className="profile-input"
                  defaultValue={editingProfile?.education || ''}
                  placeholder="e.g. BSc Computer Science, MIT"
                  autoComplete="off"
                />
                <span className="profile-helper">Your highest or most relevant qualification.</span>
              </div>
            </section>

            {/* Section: Target Roles */}
            <section className="profile-section">
              <div className="profile-section-header">
                <span className="profile-section-icon" aria-hidden="true">◎</span>
                <div>
                  <h2 className="profile-section-title">Target Roles</h2>
                  <p className="profile-section-subtitle">Roles you&apos;re actively pursuing.</p>
                </div>
              </div>
              <div className="profile-field">
                <label htmlFor="profile-target-roles" className="profile-label">
                  Target Roles <span className="profile-label-required" aria-label="required">*</span>
                </label>
                <input
                  id="profile-target-roles"
                  type="text"
                  name="targetRoles"
                  className="profile-input"
                  defaultValue={(editingProfile?.targetRoles as string[])?.join(', ') || ''}
                  placeholder="Software Engineer, Full Stack Engineer, Backend Engineer"
                  required
                  autoComplete="off"
                />
                <span className="profile-helper">Comma-separated. Matched against job titles during scoring.</span>
              </div>
            </section>

            {/* Section: Skills */}
            <section className="profile-section">
              <div className="profile-section-header">
                <span className="profile-section-icon" aria-hidden="true">⬡</span>
                <div>
                  <h2 className="profile-section-title">Skills &amp; Technologies</h2>
                  <p className="profile-section-subtitle">Technologies, frameworks, and languages you use professionally.</p>
                </div>
              </div>
              <div className="profile-field">
                <label htmlFor="profile-skills" className="profile-label">
                  Professional Skills <span className="profile-label-required" aria-label="required">*</span>
                </label>
                <textarea
                  id="profile-skills"
                  name="skills"
                  className="profile-input profile-textarea"
                  defaultValue={(editingProfile?.skills as string[])?.join(', ') || ''}
                  placeholder="JavaScript, TypeScript, React, Next.js, Node.js, PostgreSQL, Docker"
                  required
                  rows={3}
                />
                <span className="profile-helper">Comma-separated technology/tool names — not descriptions or sentences.</span>
              </div>
            </section>

            {/* Section: Projects */}
            <section className="profile-section">
              <div className="profile-section-header">
                <span className="profile-section-icon" aria-hidden="true">◧</span>
                <div>
                  <h2 className="profile-section-title">Projects &amp; Portfolio</h2>
                  <p className="profile-section-subtitle">Personal or side projects — distinct from your employment history.</p>
                </div>
              </div>
              <div className="profile-field">
                <label htmlFor="profile-project-exp" className="profile-label">Project Technologies</label>
                <textarea
                  id="profile-project-exp"
                  name="projectExperience"
                  className="profile-input profile-textarea"
                  defaultValue={(editingProfile?.projectExperience as string[])?.join(', ') || ''}
                  placeholder="AWS, Terraform, Redis, GraphQL, Expo, Unity"
                  rows={3}
                />
                <span className="profile-helper">Skills used specifically in personal or portfolio projects.</span>
              </div>
            </section>

            {/* Form Actions */}
            <div className="profile-form-actions">
              <Link href="/profile" className="btn profile-cancel-btn">Cancel</Link>
              <button type="submit" className="btn btn-primary profile-save-btn">
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
