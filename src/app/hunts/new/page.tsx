'use client';

import { saveHuntConfig, type HuntFormState } from './actions';
import { useState, useEffect, useActionState } from 'react';
import type { KeyboardEvent } from 'react';
import { getProfiles } from '@/app/profile/actions';
import { ProfileModal } from '@/components/profile/ProfileModal';

const COMMON_PROVIDERS = [
  { id: 'provider_greenhouse', name: 'Greenhouse', icon: '🌱' },
  { id: 'provider_lever', name: 'Lever', icon: '📊' },
  { id: 'provider_ashby', name: 'Ashby', icon: '📈' },
  { id: 'provider_workday', name: 'Workday', icon: '🏢' },
];

const SAVED_GROUPS = [
  { id: 'group_yc', name: 'Y Combinator Startups', count: 142 },
  { id: 'group_a16z', name: 'a16z Portfolio', count: 89 },
  { id: 'group_remote', name: 'Remote First Co', count: 256 },
  { id: 'group_ai', name: 'AI/ML Leaders', count: 45 },
];

const FAVOURITE_COMPANIES = [
  { url: 'https://openai.com/careers', name: 'OpenAI' },
  { url: 'https://careers.google.com', name: 'Google' },
  { url: 'https://stripe.com/jobs', name: 'Stripe' },
  { url: 'https://linear.app/careers', name: 'Linear' },
];

export default function NewHuntPage() {
  const [state, formAction, pending] = useActionState<HuntFormState, FormData>(
    saveHuntConfig,
    null
  );

  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(['group_yc']));
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('none');

  const fetchProfiles = () => {
    getProfiles().then(setProfiles).catch(console.error);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleUrlKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUrl();
    }
  };

  const addUrl = () => {
    if (urlInput.trim()) {
      const newUrls = urlInput.split(/[\s,]+/).filter(u => u.trim().startsWith('http'));
      if (newUrls.length > 0) {
        setUrls(prev => [...new Set([...prev, ...newUrls])]);
        setUrlInput('');
      } else if (urlInput.trim().startsWith('http')) {
        setUrls(prev => [...new Set([...prev, urlInput.trim()])]);
        setUrlInput('');
      }
    }
  };

  const removeUrl = (url: string) => {
    setUrls(prev => prev.filter(u => u !== url));
  };

  const toggleGroup = (id: string) => {
    const next = new Set(selectedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGroups(next);
  };

  const toggleProvider = (id: string) => {
    const next = new Set(selectedProviders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProviders(next);
  };

  const addFavourite = (url: string) => {
    setUrls(prev => [...new Set([...prev, url])]);
  };

  return (
    <div className="profile-workspace" style={{ maxWidth: 860, animation: 'fadeIn 0.35s ease-out' }}>
      
      {/* PAGE HEADER */}
      <div className="profile-page-header" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="profile-page-header-text">
          <h1 className="profile-page-title">Create Hunt</h1>
          <p className="profile-page-subtitle">Define the mission, constraints, and discovery strategy for this Hunt.</p>
        </div>
      </div>

      <form action={formAction}>
        
        {/* SECTION 1 — MISSION BLUEPRINT */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Mission Blueprint</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>What are we looking for?</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            
            {/* Profile */}
            <div className="profile-field">
              <label className="profile-label">Candidate Profile</label>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <select 
                    name="profileId" 
                    className="profile-input" 
                    style={{ width: '100%', height: '44px', cursor: 'pointer', appearance: 'none', paddingRight: '32px' }}
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                  >
                    <option value="none">No candidate profile (Standalone Hunt)</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.yearsOfProfessionalExperience} yrs exp)</option>
                    ))}
                  </select>
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                    ▼
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsModalOpen(true)}
                  style={{ whiteSpace: 'nowrap', height: '44px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, border: '1px solid var(--border-subtle)' }}
                >
                  + Create Profile
                </button>
              </div>
              <div className="profile-helper">Links this Hunt to a Candidate Profile for scoring</div>
            </div>

            {/* Target Roles */}
            <div className="profile-field">
              <label className="profile-label" style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Target Roles</label>
              <input type="text" name="targetRoles" className="profile-input" placeholder="e.g., Software Engineer, Backend Engineer" required style={{ fontSize: '1.0625rem', padding: '10px 14px', fontWeight: 500 }} />
              <div className="profile-helper">Comma-separated priority roles</div>
            </div>

            {/* Alternative Roles & Required Skills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-5)', alignItems: 'flex-start' }}>
              <div className="profile-field">
                <label className="profile-label">Alternative Roles</label>
                <input type="text" name="alternativeRoles" className="profile-input" placeholder="e.g., Full Stack Engineer" />
              </div>
              <div className="profile-field">
                <label className="profile-label">Required Skills</label>
                <textarea name="requiredSkills" className="profile-input" rows={2} placeholder="e.g., TypeScript, React, Node.js"></textarea>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — GEOGRAPHY & COMPENSATION */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Geography & Compensation</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Where and under what compensation constraints?</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
              <div className="profile-field">
                <label className="profile-label">Search Scope</label>
                <div style={{ position: 'relative' }}>
                  <select name="searchScope" className="profile-input" style={{ width: '100%', height: '42px', appearance: 'none', paddingRight: '32px' }}>
                    <option value="LOCAL_AND_GLOBAL">Local & Global Remote</option>
                    <option value="LOCAL">Local Only</option>
                    <option value="GLOBAL_REMOTE">Global Remote Only</option>
                  </select>
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▼</div>
                </div>
              </div>
              <div className="profile-field">
                <label className="profile-label">Country</label>
                <input type="text" name="candidateCountry" className="profile-input" defaultValue="India" style={{ height: '42px' }} />
              </div>
            </div>

            <div className="profile-field">
              <label className="profile-label">Remote Requirement</label>
              <div style={{ position: 'relative', maxWidth: '400px' }}>
                <select name="remoteRequirement" className="profile-input" style={{ width: '100%', height: '42px', appearance: 'none', paddingRight: '32px' }}>
                  <option value="">Any (No preference)</option>
                  <option value="REMOTE_ONLY">Remote Only</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ONSITE">Onsite</option>
                </select>
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▼</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
              <div className="profile-field">
                <label className="profile-label">Minimum Desired Salary</label>
                <input type="number" name="minimumDesiredSalary" className="profile-input" placeholder="e.g. 3000000" style={{ height: '42px' }} />
              </div>
              <div className="profile-field">
                <label className="profile-label">Currency</label>
                <div style={{ position: 'relative' }}>
                  <select name="desiredSalaryCurrency" className="profile-input" defaultValue="INR" style={{ width: '100%', height: '42px', appearance: 'none', paddingRight: '32px', cursor: 'pointer' }}>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▼</div>
                </div>
              </div>
              <div className="profile-field">
                <label className="profile-label">Period</label>
                <div style={{ position: 'relative' }}>
                  <select name="desiredSalaryPeriod" className="profile-input" defaultValue="YEAR" style={{ width: '100%', height: '42px', appearance: 'none', paddingRight: '32px', cursor: 'pointer' }}>
                    <option value="YEAR">Yearly</option>
                    <option value="MONTH">Monthly</option>
                  </select>
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▼</div>
                </div>
              </div>
            </div>

            <div style={{ 
              marginTop: 'var(--space-4)', 
              padding: 'var(--space-4)', 
              background: 'var(--bg-subtle)', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'flex-start',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
            onClick={(e) => {
              const checkbox = e.currentTarget.querySelector('input[type="checkbox"]') as HTMLInputElement;
              if (e.target !== checkbox) checkbox.click();
            }}>
              <input type="checkbox" name="requireSalaryDisclosure" id="requireSalaryDisclosure" value="true" defaultChecked style={{ marginTop: '2px', width: '20px', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <label htmlFor="requireSalaryDisclosure" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', margin: 0, lineHeight: 1 }}>
                    Require Salary Disclosure
                  </label>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                    Early Cheap Filter
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Only include jobs that disclose salary details upfront.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 — DISCOVERY PROTOCOL */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Discovery Protocol</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>How should JobSight discover opportunities?</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <input type="hidden" name="discoveryGroups" value={Array.from(selectedGroups).concat(Array.from(selectedProviders)).join(',')} />
            <input type="hidden" name="userUrls" value={urls.join('\n')} />

            <div className="profile-field">
              <label className="profile-label">Discovery Strategy</label>
              <select name="discoveryStrategy" className="profile-input" style={{ maxWidth: '400px' }}>
                <option value="strategy_stealth">🕵️ Stealth Discovery</option>
                <option value="strategy_high_comp">💰 High Comp Priority</option>
                <option value="strategy_startup">🚀 Startup Priority</option>
                <option value="strategy_remote_first">🌍 Remote First</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
              <div>
                <label className="profile-label">Source Groups</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  {SAVED_GROUPS.map(g => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => toggleGroup(g.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: `1px solid ${selectedGroups.has(g.id) ? 'var(--accent)' : 'var(--border-subtle)'}`,
                        background: selectedGroups.has(g.id) ? 'rgba(59,130,246,0.1)' : 'var(--bg-subtle)',
                        color: selectedGroups.has(g.id) ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                      }}
                      aria-pressed={selectedGroups.has(g.id)}
                    >
                      {g.name} <span style={{ opacity: 0.6, marginLeft: 4 }}>{g.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="profile-label">ATS Providers</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  {COMMON_PROVIDERS.map(p => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => toggleProvider(p.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: `1px solid ${selectedProviders.has(p.id) ? 'var(--accent)' : 'var(--border-subtle)'}`,
                        background: selectedProviders.has(p.id) ? 'rgba(59,130,246,0.1)' : 'var(--bg-subtle)',
                        color: selectedProviders.has(p.id) ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      aria-pressed={selectedProviders.has(p.id)}
                    >
                      <span aria-hidden="true">{p.icon}</span> {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="profile-field">
              <label className="profile-label">Target Specific URLs</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', maxWidth: '600px' }}>
                <input 
                  type="text" 
                  className="profile-input" 
                  placeholder="https://company.com/careers (Press Enter to add)"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={handleUrlKeyDown}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-secondary" onClick={addUrl} style={{ padding: '8px 16px' }}>Add</button>
              </div>
              
              {urls.length > 0 ? (
                <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: '600px' }}>
                  {urls.map(url => (
                    <div key={url} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-subtle)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{url}</span>
                      <button type="button" onClick={() => removeUrl(url)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)', textAlign: 'center', maxWidth: '600px' }}>
                  <p style={{ margin: '0 0 var(--space-2)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No specific URLs added yet.</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick add:</span>
                    {FAVOURITE_COMPANIES.map(c => (
                      <button type="button" key={c.name} onClick={() => addFavourite(c.url)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                        + {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 4 — EXECUTION CONSTRAINTS */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Execution Constraints</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>How much execution capacity should this Hunt use?</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-5)' }}>
            <div className="profile-field">
              <label className="profile-label">Max Providers</label>
              <input type="number" name="maximumProviders" className="profile-input" defaultValue="10" />
            </div>
            <div className="profile-field">
              <label className="profile-label">Max Runtime (ms)</label>
              <input type="number" name="maximumRuntime" className="profile-input" defaultValue="120000" />
            </div>
            <div className="profile-field">
              <label className="profile-label">Result Target</label>
              <input type="number" name="maximumUsableResults" className="profile-input" defaultValue="5" />
            </div>
          </div>
        </section>

        {/* SECTION 5 — REVIEW / LAUNCH */}
        <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-8)' }}>
          {state?.error && (
            <div role="alert" style={{
              color: 'var(--danger-text)',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              fontSize: '0.875rem',
              marginBottom: 'var(--space-4)',
            }}>
              <strong>Error:</strong> {state.error}
            </div>
          )}
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending}
            aria-busy={pending}
            style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 500, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            <span>{pending ? '⏳' : '✨'}</span>
            {pending ? 'Launching Mission...' : 'Launch Intelligence Hunt'}
          </button>
        </div>
      </form>

      <ProfileModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSaved={fetchProfiles} 
      />
    </div>
  );
}
