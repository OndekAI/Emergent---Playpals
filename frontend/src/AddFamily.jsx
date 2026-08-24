import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function AddFamily({ api, GRADES, onClose }) {
  const [masters, setMasters] = useState([]);
  const [form, setForm] = useState({
    parent_name: "", parent_email: "",
    community_id: "", grade_community_id: "",
    child_first_name: "", child_age: "", child_grade: "",
  });

  useEffect(() => {
    api("/admin/communities/approved").then(setMasters).catch(() => toast.error("Couldn't load communities"));
  }, [api]);

  const selectedMaster = masters.find((m) => m.community_id === form.community_id);
  const requiredFilled = form.parent_name && form.parent_email && form.community_id && form.grade_community_id;

  const submit = async () => {
    try {
      await api("/admin/add-family", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          child_age: form.child_age ? parseInt(form.child_age, 10) : null,
        }),
      });
      toast.success("Family added — ready for the next one");
      setForm({ parent_name: "", parent_email: "", community_id: "", grade_community_id: "", child_first_name: "", child_age: "", child_grade: "" });
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
        <p className="muted">Adds this family directly to a community and grade — no invite link or approval needed.</p>

        <section className="card stack" data-testid="add-family-parent-card">
          <h2 className="section-title">Parent</h2>
          <input className="input" placeholder="Parent name" value={form.parent_name}
            onChange={(e) => setForm({ ...form, parent_name: e.target.value })} data-testid="add-family-parent-name-input" />
          <input className="input" placeholder="Parent email" value={form.parent_email}
            onChange={(e) => setForm({ ...form, parent_email: e.target.value })} data-testid="add-family-parent-email-input" />
          <select className="select" value={form.community_id}
            onChange={(e) => setForm({ ...form, community_id: e.target.value, grade_community_id: "" })} data-testid="add-family-community-select">
            <option value="">Select community</option>
            {masters.map((m) => <option key={m.community_id} value={m.community_id}>{m.name}</option>)}
          </select>
          {selectedMaster && (
            <select className="select" value={form.grade_community_id}
              onChange={(e) => setForm({ ...form, grade_community_id: e.target.value })} data-testid="add-family-grade-select">
              <option value="">Select grade</option>
              {selectedMaster.subs.map((s) => <option key={s.community_id} value={s.community_id}>{s.name}</option>)}
            </select>
          )}
        </section>

        <section className="card stack" data-testid="add-family-child-card">
          <h2 className="section-title">Child (optional)</h2>
          <input className="input" placeholder="Child first name" value={form.child_first_name}
            onChange={(e) => setForm({ ...form, child_first_name: e.target.value })} data-testid="add-family-child-name-input" />
          <input className="input" placeholder="Child age" value={form.child_age}
            onChange={(e) => setForm({ ...form, child_age: e.target.value })} data-testid="add-family-child-age-input" />
          <select className="select" value={form.child_grade}
            onChange={(e) => setForm({ ...form, child_grade: e.target.value })} data-testid="add-family-child-grade-select">
            <option value="">Select grade</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </section>

        <button className="button primary" disabled={!requiredFilled} onClick={submit} data-testid="add-family-submit">
          Add family
        </button>
      </main>
    </div>
  );
}
