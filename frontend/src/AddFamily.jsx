import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AddFamily({ api, onClose }) {
  const [masters, setMasters] = useState([]);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [children, setChildren] = useState([]);
  const nextKey = useRef(0);

  useEffect(() => {
    api("/admin/communities/approved").then(setMasters).catch(() => toast.error("Couldn't load communities"));
  }, [api]);

  const selectedMaster = masters.find((m) => m.community_id === communityId);
  const requiredFilled = parentName && parentEmail && communityId;

  const addChildRow = () => {
    nextKey.current += 1;
    setChildren((prev) => [...prev, { key: nextKey.current, first_name: "", age: "", grade_community_id: "" }]);
  };

  const updateChild = (key, field, value) => {
    setChildren((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  };

  const removeChild = (key) => {
    setChildren((prev) => prev.filter((c) => c.key !== key));
  };

  const submit = async () => {
    try {
      await api("/admin/add-family", {
        method: "POST",
        body: JSON.stringify({
          parent_name: parentName,
          parent_email: parentEmail,
          community_id: communityId,
          children: children
            .filter((c) => c.first_name && c.grade_community_id)
            .map((c) => ({
              first_name: c.first_name,
              age: c.age ? parseInt(c.age, 10) : null,
              grade: selectedMaster?.subs.find((s) => s.community_id === c.grade_community_id)?.name || "",
              grade_community_id: c.grade_community_id,
            })),
        }),
      });
      toast.success("Family added — ready for the next one");
      setParentName("");
      setParentEmail("");
      setCommunityId("");
      setChildren([]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="slide-screen" data-testid="add-family-screen">
      <header className="top-header">
        <button className="icon-button" onClick={onClose} data-testid="add-family-back-button">
          <ChevronLeft size={20} />
        </button>
        <div className="screen-title">Add a Family</div>
        <div />
      </header>
      <main className="main-content stack">
        <p className="muted">Adds this family directly to a community — no invite link or approval needed. Each child joins their own grade.</p>

        <section className="card stack" data-testid="add-family-parent-card">
          <h2 className="section-title">Parent</h2>
          <input className="input" placeholder="Parent name" value={parentName}
            onChange={(e) => setParentName(e.target.value)} data-testid="add-family-parent-name-input" />
          <input className="input" placeholder="Parent email" value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)} data-testid="add-family-parent-email-input" />
          <select className="select" value={communityId}
            onChange={(e) => { setCommunityId(e.target.value); setChildren([]); }} data-testid="add-family-community-select">
            <option value="">Select community</option>
            {masters.map((m) => <option key={m.community_id} value={m.community_id}>{m.name}</option>)}
          </select>
        </section>

        <section className="card stack" data-testid="add-family-child-card">
          <div className="section-row">
            <h2 className="section-title">Children (optional)</h2>
            {selectedMaster && (
              <button className="icon-button" onClick={addChildRow} data-testid="add-family-add-child-button">
                <Plus size={18} />
              </button>
            )}
          </div>
          {!selectedMaster && <p className="muted">Select a community first to add children.</p>}
          {children.map((child) => (
            <div className="mini-card stack" key={child.key} data-testid={`add-family-child-row-${child.key}`}>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  placeholder="Child first name"
                  value={child.first_name}
                  onChange={(e) => updateChild(child.key, "first_name", e.target.value)}
                  data-testid={`add-family-child-name-${child.key}`}
                />
                <button className="icon-button" onClick={() => removeChild(child.key)} data-testid={`add-family-remove-child-${child.key}`}>
                  <Trash2 size={16} />
                </button>
              </div>
              <input
                className="input"
                placeholder="Child age"
                value={child.age}
                onChange={(e) => updateChild(child.key, "age", e.target.value)}
                data-testid={`add-family-child-age-${child.key}`}
              />
              <select
                className="select"
                value={child.grade_community_id}
                onChange={(e) => updateChild(child.key, "grade_community_id", e.target.value)}
                data-testid={`add-family-child-grade-${child.key}`}
              >
                <option value="">Select grade</option>
                {selectedMaster?.subs.map((s) => <option key={s.community_id} value={s.community_id}>{s.name}</option>)}
              </select>
            </div>
          ))}
        </section>

        <button className="button primary" disabled={!requiredFilled} onClick={submit} data-testid="add-family-submit">
          Add family
        </button>
      </main>
    </div>
  );
}
