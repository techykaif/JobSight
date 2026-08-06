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

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Create Hunt (Will execute in M8)</button>
        </form>
      </div>
    </div>
  );
}
