import { useState } from "react";

export default function Settings() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [toast, setToast] = useState("");

  const handleToggle = () => {
    setAnalyticsEnabled(!analyticsEnabled);
    if (!analyticsEnabled) {
      // BUG 2: should be "Analytics enabled successfully."
      setToast("Saved.");
    } else {
      setToast("");
    }
  };

  const handleSavePreferences = () => {
    // BUG 3: should show error "Please select at least one notification channel."
    // but does nothing
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Settings</h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Analytics</h2>
        <label>
          {/* BUG 4: should be "Enable Analytics" */}
          <input type="checkbox" checked={analyticsEnabled} onChange={handleToggle} />
          {" "}Enable Tracking
        </label>
      </section>

      <section>
        <h2>Notifications</h2>
        <button onClick={handleSavePreferences}>Save Preferences</button>
      </section>

      {toast && (
        <p style={{ marginTop: "2rem", color: "green" }}>{toast}</p>
      )}
    </div>
  );
}
