'use client';

import { saveHuntConfig } from './actions';
import { useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';

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
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(['group_yc']));
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());

  const handleUrlKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUrl();
    }
  };

  const addUrl = () => {
    if (urlInput.trim()) {
      // Split by commas, spaces, or newlines if multiple pasted
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
    <div className="new-hunt-container">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Configure New Hunt</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Set your search parameters and discovery sources</p>
        </div>
      </div>

      <form action={saveHuntConfig} className="hunt-form">
        <div className="form-grid">
          {/* Left Column - Core Settings */}
          <div className="form-column">
            <div className="card">
              <h3 className="card-title">Target Role Details</h3>
              <div className="form-group">
                <label className="form-label">Target Roles</label>
                <input type="text" name="targetRoles" className="form-input" placeholder="e.g., Software Engineer, Backend Engineer" required />
                <span className="form-hint">Comma-separated priority roles</span>
              </div>

              <div className="form-group">
                <label className="form-label">Alternative Roles</label>
                <input type="text" name="alternativeRoles" className="form-input" placeholder="e.g., Full Stack Engineer" />
              </div>

              <div className="form-group">
                <label className="form-label">Required Skills</label>
                <textarea name="requiredSkills" className="form-input" rows={2} placeholder="e.g., TypeScript, React, Node.js"></textarea>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Candidate Preferences</h3>
              
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">Search Scope</label>
                  <select name="searchScope" className="form-input">
                    <option value="LOCAL_AND_GLOBAL">Local & Global Remote</option>
                    <option value="LOCAL">Local Only</option>
                    <option value="GLOBAL_REMOTE">Global Remote Only</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Country</label>
                  <input type="text" name="candidateCountry" className="form-input" defaultValue="India" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remote Requirement</label>
                <select name="remoteRequirement" className="form-input">
                  <option value="">Any (No preference)</option>
                  <option value="REMOTE_ONLY">Remote Only</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ONSITE">Onsite</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group flex-2">
                  <label className="form-label">Min Salary</label>
                  <input type="number" name="minimumDesiredSalary" className="form-input" placeholder="e.g. 3000000" />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Cur</label>
                  <input type="text" name="desiredSalaryCurrency" className="form-input" defaultValue="INR" />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Period</label>
                  <select name="desiredSalaryPeriod" className="form-input" defaultValue="YEAR">
                    <option value="YEAR">Yr</option>
                    <option value="MONTH">Mo</option>
                  </select>
                </div>
              </div>

              <label className="checkbox-label">
                <input type="checkbox" name="requireSalaryDisclosure" value="true" defaultChecked />
                <span>Require Salary Disclosure (Early Cheap Filter)</span>
              </label>
            </div>
          </div>

          {/* Right Column - Discovery UX */}
          <div className="form-column">
            <div className="card discovery-card">
              <div className="card-header-row">
                <h3 className="card-title" style={{ margin: 0 }}>Discovery Sources</h3>
                <select name="discoveryStrategy" className="strategy-select">
                  <option value="strategy_stealth">🕵️ Stealth Discovery</option>
                  <option value="strategy_high_comp">💰 High Comp Priority</option>
                  <option value="strategy_startup">🚀 Startup Priority</option>
                  <option value="strategy_remote_first">🌍 Remote First</option>
                </select>
              </div>

              <input type="hidden" name="discoveryGroups" value={Array.from(selectedGroups).concat(Array.from(selectedProviders)).join(',')} />
              <input type="hidden" name="userUrls" value={urls.join('\n')} />

              <div className="discovery-section">
                <label className="section-label" id="source-groups-label">Source Groups</label>
                <div className="pill-grid" role="group" aria-labelledby="source-groups-label">
                  {SAVED_GROUPS.map(g => (
                    <button
                      type="button"
                      key={g.id}
                      className={`selectable-pill ${selectedGroups.has(g.id) ? 'active' : ''}`}
                      onClick={() => toggleGroup(g.id)}
                      aria-pressed={selectedGroups.has(g.id)}
                    >
                      <span className="pill-name">{g.name}</span>
                      <span className="pill-count">{g.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="discovery-section">
                <label className="section-label" id="ats-providers-label">ATS Providers</label>
                <div className="provider-grid" role="group" aria-labelledby="ats-providers-label">
                  {COMMON_PROVIDERS.map(p => (
                    <button
                      type="button"
                      key={p.id}
                      className={`provider-card ${selectedProviders.has(p.id) ? 'active' : ''}`}
                      onClick={() => toggleProvider(p.id)}
                      aria-pressed={selectedProviders.has(p.id)}
                    >
                      <span className="provider-icon" aria-hidden="true">{p.icon}</span>
                      <span className="provider-name">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="discovery-section">
                <label className="section-label">Target Specific URLs</label>
                
                <div className="url-input-wrapper">
                  <input 
                    type="text" 
                    className="form-input url-input" 
                    placeholder="https://company.com/careers (Press Enter to add)"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={handleUrlKeyDown}
                  />
                  <button type="button" className="btn btn-secondary add-btn" onClick={addUrl}>Add</button>
                </div>

                {urls.length > 0 ? (
                  <div className="url-list">
                    {urls.map(url => (
                      <div key={url} className="url-item">
                        <span className="url-text">{url}</span>
                        <button type="button" className="url-remove" onClick={() => removeUrl(url)}>×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-urls">
                    <p>No specific URLs added yet.</p>
                    <div className="quick-adds">
                      <span>Quick add:</span>
                      {FAVOURITE_COMPANIES.map(c => (
                        <button type="button" key={c.name} className="quick-add-btn" onClick={() => addFavourite(c.url)}>
                          + {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-row" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <div className="form-group flex-1">
                  <label className="form-label">Max Providers</label>
                  <input type="number" name="maximumProviders" className="form-input" defaultValue="10" />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Max Runtime (ms)</label>
                  <input type="number" name="maximumRuntime" className="form-input" defaultValue="120000" />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Result Target</label>
                  <input type="number" name="maximumUsableResults" className="form-input" defaultValue="5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary submit-btn">
            <span className="submit-icon">✨</span>
            Launch Intelligence Hunt
          </button>
        </div>
      </form>
    </div>
  );
}
