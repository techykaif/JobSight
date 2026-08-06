import { saveHuntConfig } from './actions';

export default function NewHuntPage() {
  return (
    <div>
      <div className="page-header">
        <h2>New Hunt Configuration</h2>
      </div>

      <div style={{ maxWidth: '600px' }}>
        <form action={saveHuntConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          
          <div className="form-group">
            <label className="form-label">Target Roles (comma-separated)</label>
            <input type="text" name="targetRoles" className="form-input" placeholder="e.g., Software Engineer, Backend Engineer" required />
          </div>

          <div className="form-group">
            <label className="form-label">Alternative Roles (comma-separated)</label>
            <input type="text" name="alternativeRoles" className="form-input" placeholder="e.g., Full Stack Engineer" />
          </div>

          <div className="form-group">
            <label className="form-label">Required Skills (comma-separated)</label>
            <textarea name="requiredSkills" className="form-input" rows={3} placeholder="e.g., TypeScript, React, Node.js"></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">Search Scope</label>
            <select name="searchScope" className="form-input">
              <option value="LOCAL_AND_GLOBAL">Local & Global Remote</option>
              <option value="LOCAL">Local Only</option>
              <option value="GLOBAL_REMOTE">Global Remote Only</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Candidate Country</label>
            <input type="text" name="candidateCountry" className="form-input" defaultValue="India" />
          </div>

          <div className="form-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="checkbox" name="requireSalaryDisclosure" value="true" defaultChecked />
            <label className="form-label" style={{ margin: 0 }}>Require Salary Disclosure (Early Cheap Filter)</label>
          </div>

          <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Minimum Desired Salary</label>
              <input type="number" name="minimumDesiredSalary" className="form-input" placeholder="e.g., 3000000" />
            </div>
            <div style={{ width: '100px' }}>
              <label className="form-label">Currency</label>
              <input type="text" name="desiredSalaryCurrency" className="form-input" defaultValue="INR" />
            </div>
            <div style={{ width: '120px' }}>
              <label className="form-label">Period</label>
              <select name="desiredSalaryPeriod" className="form-input" defaultValue="YEAR">
                <option value="YEAR">Yearly</option>
                <option value="MONTH">Monthly</option>
                <option value="HOUR">Hourly</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Remote Requirement</label>
            <select name="remoteRequirement" className="form-input">
              <option value="">Any</option>
              <option value="REMOTE_ONLY">Remote Only</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ONSITE">Onsite</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Usable Result Target</label>
            <input type="number" name="maximumUsableResults" className="form-input" defaultValue="5" />
          </div>

          <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Discovery Configuration</h3>
            
            <label className="form-label">Discovery Strategy</label>
            <select name="discoveryStrategy" className="form-input" defaultValue="strategy_stealth" style={{ marginBottom: '1rem' }}>
              <option value="strategy_stealth">Stealth Discovery (Highest Quality)</option>
              <option value="strategy_high_comp">High Compensation Priority</option>
              <option value="strategy_startup">Startup Priority</option>
              <option value="strategy_enterprise">Enterprise Priority</option>
              <option value="strategy_remote_first">Remote First</option>
              <option value="strategy_default">Default</option>
            </select>

            <label className="form-label">Discovery Groups (comma-separated IDs)</label>
            <input type="text" name="discoveryGroups" className="form-input" placeholder="e.g., group_yc, group_remote" style={{ marginBottom: '1rem' }} />

            <label className="form-label">Custom Source URLs (one per line)</label>
            <textarea name="userUrls" className="form-input" rows={3} placeholder="https://careers.google.com&#10;https://boards.greenhouse.io/openai" style={{ marginBottom: '1rem' }}></textarea>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Maximum Providers</label>
                <input type="number" name="maximumProviders" className="form-input" defaultValue="10" />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Max Runtime (ms)</label>
                <input type="number" name="maximumRuntime" className="form-input" defaultValue="120000" />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Create Hunt</button>
        </form>
      </div>
    </div>
  );
}
