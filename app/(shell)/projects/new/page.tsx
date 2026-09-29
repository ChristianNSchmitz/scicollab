import { createProject } from "@/app/actions/projects";
import { Page, Panel, PanelHead, field, fieldLabel, btnPrimary, mono } from "@/components/ui";

export default function NewProject() {
  return (
    <Page title="New project" lede="A container for the notebook, the datasets and the people.">
      <form action={createProject} style={{ maxWidth: 680 }}>
        <Panel>
          <PanelHead>Project</PanelHead>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
            <div>
              <label style={fieldLabel} htmlFor="title">Title</label>
              <input id="title" name="title" required style={field} placeholder="Transfection efficiency across passage number" />
            </div>
            <div>
              <label style={fieldLabel} htmlFor="summary">Summary</label>
              <textarea id="summary" name="summary" rows={3} style={field} placeholder="What this project is establishing, and for whom." />
            </div>
            <div>
              <label style={fieldLabel} htmlFor="tags">Tags — comma separated</label>
              <input id="tags" name="tags" style={field} placeholder="transfection, HEK293T" />
            </div>
            <div>
              <label style={fieldLabel} htmlFor="visibility">Visibility</label>
              <select id="visibility" name="visibility" defaultValue="lab" style={{ ...field, height: 38 }}>
                <option value="private">Private — only you</option>
                <option value="lab">Lab — your workspace</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
        </Panel>
        <button type="submit" style={{ ...btnPrimary, marginTop: 12, height: 42 }}>Create project</button>
      </form>
    </Page>
  );
}
