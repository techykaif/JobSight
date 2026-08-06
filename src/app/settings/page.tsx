export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <div style={{ maxWidth: '600px' }}>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0 }}>Application Settings</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Local application settings for JOBSight. These are stored on your machine.
          </p>
          
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input type="checkbox" id="companyResearchEnabled" defaultChecked style={{ width: '1.25rem', height: '1.25rem' }} />
            <label htmlFor="companyResearchEnabled" className="form-label" style={{ margin: 0 }}>Enable Company Research (AGY)</label>
          </div>

          <div className="form-group">
            <label className="form-label">AGY Timeout (ms)</label>
            <input type="number" className="form-input" defaultValue={90000} />
            <div className="form-text">Maximum time to wait for unstructured company research before defaulting to unknown scores.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Default Max Results per Hunt</label>
            <input type="number" className="form-input" defaultValue={50} />
          </div>
          
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
