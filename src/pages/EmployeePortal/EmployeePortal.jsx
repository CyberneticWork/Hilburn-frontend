import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  LogOut,
  Wallet,
  Banknote,
  Home,
  Key,
  UserRound,
  Stethoscope,
  Bell,
  Download,
  FileText,
  Landmark,
} from "lucide-react";
import {
  attachLeaveEvidence,
  changeMyPassword,
  getCoveringColleagues,
  getMyAdvances,
  getMyAttendance,
  getMyLeaves,
  getMyNopay,
  getMyNotices,
  getMyOvertime,
  getMyPunch,
  getMyResignations,
  getMySalary,
  getPortalHome,
  punchFromPhone,
  submitAdvance,
  submitLeave,
  submitResignation,
} from "../../services/EmployeePortalService";
import { logout } from "../../services/AuthService";
import { clearUser, getUser, isEmployeeUser } from "../../services/UserService";
import NotificationBell from "../../components/NotificationBell";
import NotificationService from "../../services/NotificationService";
import { downloadPayslip, downloadPayslips } from "../../utils/payslipPdf";
import { getMyLoans, submitLoanRequest } from "../../services/LoanService";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LEAVE_TYPES = [
  "Annual Leave",
  "Casual Leave",
  "No Pay Leave",
  "Short Leave",
];

const money = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function apiErrorText(err, fallback) {
  const d = err?.response?.data;
  if (!d) return err?.message || fallback;
  const parts = [];
  if (d.message) parts.push(String(d.message));
  if (d.errors && typeof d.errors === "object") {
    Object.values(d.errors).forEach((v) => {
      if (Array.isArray(v)) parts.push(...v.filter(Boolean).map(String));
      else if (v) parts.push(String(v));
    });
  }
  const text = parts.filter((p) => p && p !== "undefined").join(" ");
  return text || fallback;
}

const statusClass = (s) => {
  const v = String(s || "").toUpperCase();
  if (v.includes("APPROV") || v === "ISSUED" || v === "PROCESSED" || v === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (v.includes("REJECT") || v.includes("CANCEL")) return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
};

async function confirmBiometric() {
  const cred = window.PublicKeyCredential;
  if (!cred?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    const ok = await cred.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!ok) return false;
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 25000,
        userVerification: "required",
        rpId: location.hostname === "localhost" ? "localhost" : location.hostname,
        allowCredentials: [],
      },
    });
    return true;
  } catch {
    return false;
  }
}

export default function EmployeePortal() {
  const navigate = useNavigate();
  const user = getUser();
  const [view, setView] = useState("home");
  const [home, setHome] = useState(null);
  const [bootError, setBootError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [overtime, setOvertime] = useState([]);
  const [nopay, setNopay] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "Casual Leave",
    leave_from: "",
    leave_to: "",
    day_type: "FULL",
    reason: "",
    covering_employee_id: "",
  });
  const [medicalForm, setMedicalForm] = useState({
    leave_from: "",
    leave_to: "",
    day_type: "FULL",
    reason: "",
    covering_employee_id: "",
  });
  const [medicalFile, setMedicalFile] = useState(null);
  const [colleagues, setColleagues] = useState([]);
  const [coveringFilter, setCoveringFilter] = useState("");
  const [advanceForm, setAdvanceForm] = useState({ amount: "", needed_on: "", reason: "" });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    new_password_confirmation: "",
  });
  const [punch, setPunch] = useState(null);
  const [punching, setPunching] = useState(false);
  const [holdPct, setHoldPct] = useState(0);
  const [clock, setClock] = useState(now.toLocaleTimeString());
  const holdTimer = useRef(null);
  const punchedByHold = useRef(false);
  const locRef = useRef({ lat: null, lng: null, accuracy: null, ready: false });
  const [locReady, setLocReady] = useState(false);
  const [distanceM, setDistanceM] = useState(null);
  const [atOffice, setAtOffice] = useState(false);
  const [notices, setNotices] = useState([]);
  const [openSalaryId, setOpenSalaryId] = useState(null);
  const [resignations, setResignations] = useState([]);
  const [resignForm, setResignForm] = useState({
    resigning_date: "",
    last_working_day: "",
    resignation_reason: "",
  });
  const [resignFiles, setResignFiles] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loanForm, setLoanForm] = useState({
    loan_amount: "",
    installment_amount: "",
    start_from: "",
    installment_deduct_from: "bonus",
    reason: "",
  });

  const initials = useMemo(() => {
    const n = home?.employee?.fullName || user?.name || "EP";
    return n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  }, [home, user]);

  const flash = (ok, text) => {
    setMessage(ok ? text : "");
    setError(ok ? "" : text);
    setTimeout(() => {
      setMessage("");
      setError("");
    }, ok ? 3500 : 8000);
  };

  const loadHome = async () => {
    try {
      setLoading(true);
      setBootError("");
      const data = await getPortalHome({ month, year });
      setHome(data);
      setAdvances(data.advances || []);
    } catch (e) {
      setBootError(e?.response?.data?.message || "Unable to load employee portal. Link an employee profile to this login.");
    } finally {
      setLoading(false);
    }
  };

  const loadPunch = async () => {
    try {
      const data = await getMyPunch();
      setPunch(data);
    } catch {
      setPunch({ enabled: false, today: [], nextStatus: "IN", disabledReason: "Could not load punch settings." });
    }
  };

  const showDeviceAlert = (title, body) => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "/vite.svg" });
      } catch {
        /* ignore */
      }
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "notify", title, body });
    }
  };

  const enableMobileAlerts = async () => {
    try {
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw-hr.js");
      }
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      getMyNotices().then((d) => setNotices(d.items || [])).catch(() => {});
      const seenKey = "hr_notice_seen";
      const poll = async () => {
        try {
          const list = await NotificationService.getNotifications(12);
          const latest = list?.[0];
          const last = Number(localStorage.getItem(seenKey) || 0);
          if (latest?.id && Number(latest.id) > last) {
            if (last > 0) {
              showDeviceAlert(latest.title || "HR notice", latest.message || "");
            }
            localStorage.setItem(seenKey, String(latest.id));
          }
        } catch {
          /* ignore */
        }
      };
      poll();
      const timer = setInterval(poll, 25000);
      return () => clearInterval(timer);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/", { replace: true });
      return;
    }
    const current = getUser();
    if (current && !isEmployeeUser(current)) {
      navigate("/dashboard", { replace: true });
      return;
    }
    loadHome();
    loadPunch();
    let stopAlerts;
    enableMobileAlerts().then((fn) => {
      stopAlerts = fn;
    });
    return () => {
      if (typeof stopAlerts === "function") stopAlerts();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        locRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ready: true,
        };
        setLocReady(true);
        if (punch?.latitude != null && punch?.longitude != null) {
          const d = haversine(pos.coords.latitude, pos.coords.longitude, punch.latitude, punch.longitude);
          setDistanceM(Math.round(d));
          setAtOffice(d <= (punch.radiusMeters || 400) + Math.min(pos.coords.accuracy || 80, 120));
        } else {
          setAtOffice(false);
        }
      },
      () => setLocReady(false),
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 12000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [punch?.latitude, punch?.longitude, punch?.radiusMeters]);

  useEffect(() => {
    if (view === "leave" || view === "medical") {
      getMyLeaves().then((d) => setLeaveHistory(d.items || [])).catch(() => flash(false, "Could not load leave"));
      getCoveringColleagues()
        .then((d) => setColleagues(d.items || []))
        .catch(() => flash(false, "Could not load covering-person list"));
    }
    if (view === "advance") getMyAdvances().then((d) => setAdvances(d.items || [])).catch(() => flash(false, "Could not load advances"));
    if (view === "time") {
      loadPunch();
      getMyAttendance({ month, year }).then((d) => setAttendance(d.items || [])).catch(() => flash(false, "Could not load attendance"));
    }
    if (view === "pay") {
      Promise.all([getMyOvertime({ month, year }), getMyNopay({ month, year }), getMySalary()])
        .then(([ot, np, sal]) => {
          setOvertime(ot.items || []);
          setNopay(np.items || []);
          setSalaries(sal.items || []);
        })
        .catch(() => flash(false, "Could not load pay data"));
    }
    if (view === "home") {
      getMyNotices().then((d) => setNotices(d.items || [])).catch(() => {});
    }
    if (view === "resign") {
      getMyResignations().then((d) => setResignations(d.items || [])).catch(() => flash(false, "Could not load resignations"));
    }
    if (view === "loan") {
      getMyLoans().then((d) => setLoans(d.items || [])).catch(() => flash(false, "Could not load loans"));
    }
  }, [view, month, year, home?.leaveWorkflow]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore */
    }
    clearUser();
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const canPunch = !!(punch?.enabled && atOffice && locReady && !punching);
  const punchTitle = punch?.nextStatus === "OUT" ? "Punch OUT" : "Punch IN";

  const submitPunch = async (biometricOk) => {
    if (punching || !punch?.enabled) return;
    if (!locRef.current.ready) {
      flash(false, "Turn on location. Fingerprint punch only works at the selected premises.");
      return;
    }
    setPunching(true);
    try {
      const res = await punchFromPhone({
        biometric_ok: !!biometricOk,
        latitude: locRef.current.lat,
        longitude: locRef.current.lng,
        accuracy: locRef.current.accuracy,
      });
      flash(true, res.message || `${res.status} recorded`);
      await loadPunch();
      if (view === "time") {
        const d = await getMyAttendance({ month, year });
        setAttendance(d.items || []);
      }
    } catch (e) {
      flash(false, e?.response?.data?.message || "Could not punch");
    } finally {
      setPunching(false);
    }
  };

  const doPunch = async () => {
    if (punchedByHold.current) {
      punchedByHold.current = false;
      return;
    }
    if (!canPunch) return;
    holdEnd();
    const bio = await confirmBiometric();
    if (punch?.requireBiometric && !bio) {
      flash(false, "Confirm with fingerprint / Face ID, or hold the punch button.");
      return;
    }
    await submitPunch(bio);
  };

  const holdStart = () => {
    if (!canPunch) return;
    punchedByHold.current = false;
    setHoldPct(0);
    const started = Date.now();
    holdTimer.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / 900) * 100);
      setHoldPct(pct);
      if (pct >= 100) {
        holdEnd();
        punchedByHold.current = true;
        submitPunch(true);
      }
    }, 40);
  };

  const holdEnd = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldPct(0);
  };

  const onSubmitLeave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (!leaveForm.covering_employee_id) {
        flash(false, "Select a covering person.");
        setSaving(false);
        return;
      }
      await submitLeave(leaveForm);
      flash(true, "Leave request submitted");
      setLeaveForm({ leave_type: "Casual Leave", leave_from: "", leave_to: "", day_type: "FULL", reason: "", covering_employee_id: "" });
      const data = await getMyLeaves();
      setLeaveHistory(data.items || []);
    } catch (err) {
      flash(false, apiErrorText(err, "Could not submit leave"));
    } finally {
      setSaving(false);
    }
  };

  const onSubmitAdvance = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await submitAdvance(advanceForm);
      flash(true, "Salary advance request submitted");
      setAdvanceForm({ amount: "", needed_on: "", reason: "" });
      const data = await getMyAdvances();
      setAdvances(data.items || []);
    } catch (err) {
      flash(false, err?.response?.data?.message || "Could not submit advance");
    } finally {
      setSaving(false);
    }
  };

  const onSavePassword = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await changeMyPassword(passwordForm);
      flash(true, "Password updated");
      setPasswordForm({ current_password: "", new_password: "", new_password_confirmation: "" });
    } catch (err) {
      flash(false, err?.response?.data?.message || "Could not update password");
    } finally {
      setSaving(false);
    }
  };

  const onSubmitLoan = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await submitLoanRequest({
        ...loanForm,
        start_from: loanForm.start_from ? `${loanForm.start_from}-01` : "",
      });
      flash(true, "Loan request sent. HR will review and approve it.");
      setLoanForm({
        loan_amount: "",
        installment_amount: "",
        start_from: "",
        installment_deduct_from: "bonus",
        reason: "",
      });
      const data = await getMyLoans();
      setLoans(data.items || []);
    } catch (err) {
      flash(false, apiErrorText(err, "Could not submit loan request"));
    } finally {
      setSaving(false);
    }
  };

  const onSubmitResignation = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await submitResignation(resignForm, resignFiles);
      flash(true, "Resignation request sent. HR can review and approve later.");
      setResignForm({ resigning_date: "", last_working_day: "", resignation_reason: "" });
      setResignFiles([]);
      const data = await getMyResignations();
      setResignations(data.items || []);
    } catch (err) {
      const d = err?.response?.data;
      flash(false, d?.message || d?.resignation_reason?.[0] || "Could not submit resignation");
    } finally {
      setSaving(false);
    }
  };

  const onSubmitMedical = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (!medicalForm.covering_employee_id) {
        flash(false, "Select a covering person.");
        setSaving(false);
        return;
      }
      await submitLeave(
        {
          ...medicalForm,
          leave_type: "Medical Leave",
        },
        medicalFile
      );
      flash(true, medicalFile
        ? "Medical leave submitted with evidence"
        : "Medical leave submitted. Attach a report before HR can approve.");
      setMedicalForm({ leave_from: "", leave_to: "", day_type: "FULL", reason: "", covering_employee_id: "" });
      setMedicalFile(null);
      const data = await getMyLeaves();
      setLeaveHistory(data.items || []);
    } catch (err) {
      flash(false, apiErrorText(err, "Could not submit medical leave"));
    } finally {
      setSaving(false);
    }
  };

  const onAttachEvidence = async (leaveId, file) => {
    if (!file) return;
    try {
      setSaving(true);
      await attachLeaveEvidence(leaveId, file);
      flash(true, "Medical evidence attached");
      const data = await getMyLeaves();
      setLeaveHistory(data.items || []);
    } catch (err) {
      flash(false, err?.response?.data?.message || "Could not attach evidence");
    } finally {
      setSaving(false);
    }
  };

  const coveringOptions = useMemo(() => {
    const term = coveringFilter.trim().toLowerCase();
    if (!term) return colleagues;
    return colleagues.filter((c) => {
      const name = `${c.full_name || ""} ${c.name_with_initials || ""} ${c.attendance_employee_no || ""}`.toLowerCase();
      return name.includes(term);
    });
  }, [colleagues, coveringFilter]);

  const searchCovering = async () => {
    try {
      const d = await getCoveringColleagues(coveringFilter.trim() ? { q: coveringFilter.trim() } : {});
      setColleagues(d.items || []);
      if (!(d.items || []).length) {
        flash(false, "No covering person matched that search.");
      }
    } catch (err) {
      flash(false, apiErrorText(err, "Could not search covering person"));
    }
  };

  const coveringSelect = (form, setForm) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        Covering person <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-xl px-3 py-2"
          placeholder="Search name or attendance number"
          value={coveringFilter}
          onChange={(e) => setCoveringFilter(e.target.value)}
        />
        <button
          type="button"
          onClick={searchCovering}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white"
        >
          Find
        </button>
      </div>
      <select
        className="w-full border rounded-xl px-3 py-2"
        required
        value={form.covering_employee_id}
        onChange={(e) => setForm({ ...form, covering_employee_id: e.target.value })}
      >
        <option value="">Select covering person</option>
        {coveringOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name || c.name_with_initials} {c.attendance_employee_no ? `(${c.attendance_employee_no})` : ""}
          </option>
        ))}
      </select>
      {!colleagues.length && (
        <p className="text-xs text-amber-700">
          Type a name or attendance number and click Find to add a covering person.
        </p>
      )}
    </div>
  );

  const emp = home?.employee || {};
  const profileRows = [
    ["Employee no", emp.employeeNo],
    ["EPF", emp.epf],
    ["NIC", emp.nic],
    ["Company", emp.company],
    ["Department", emp.department],
    ["Designation", emp.designation],
    ["Employment", emp.employmentType],
    ["Joined", emp.dateOfJoining],
    ["Day off", emp.dayOff],
    ["Supervisor", emp.supervisor],
    ["Date of birth", emp.dob],
    ["Gender", emp.gender],
    ["Marital status", emp.maritalStatus],
    ["Mobile", emp.mobile],
    ["Email", emp.email],
    ["Land line", emp.landLine],
    ["District", emp.district],
    ["Province", emp.province],
    ["Emergency", [emp.emergencyName, emp.emergencyRelationship, emp.emergencyPhone].filter(Boolean).join(" · ")],
    ["Address", emp.permanentAddress || emp.temporaryAddress],
  ].filter(([, v]) => v);

  const leaveBalances = home?.leaveBalances || [];

  const navBtn = (id, label, Icon) => (
    <button
      key={id}
      type="button"
      onClick={() => setView(id)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition ${
        view === id ? "bg-teal-600 text-white shadow" : "text-slate-600 hover:bg-teal-50"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  const punchCard = !punch?.enabled ? (
    <article className="rounded-3xl p-5 text-white shadow-lg bg-gradient-to-br from-zinc-700 to-stone-600">
      <p className="text-[11px] uppercase tracking-[0.16em] opacity-80">Fingerprint</p>
      <h2 className="font-display text-2xl font-bold mt-1">Punch disabled</h2>
      <p className="text-sm opacity-90 mt-2">
        {punch?.disabledReason || "Cybernetic Admin has not enabled mobile fingerprint for your company or department."}
      </p>
    </article>
  ) : (
    <article className={`rounded-3xl p-5 text-white shadow-lg ${atOffice ? "bg-gradient-to-br from-teal-800 via-teal-600 to-cyan-500" : "bg-gradient-to-br from-zinc-700 to-stone-600"}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] opacity-80">{punch?.officeName || "Office"}</p>
      <h2 className="font-display text-2xl font-bold mt-1">{punchTitle}</h2>
      <p className="text-sm opacity-85 mt-1">
        {distanceM != null ? `${distanceM}m from premises` : locReady ? "Checking location…" : "Turn on location"}
        {atOffice ? " · Unlocked" : " · Locked until you are at the selected premises"}
      </p>
      <button
        type="button"
        disabled={!canPunch}
        onPointerDown={holdStart}
        onPointerUp={holdEnd}
        onPointerLeave={holdEnd}
        onClick={doPunch}
        className={`mx-auto mt-4 w-40 h-40 rounded-full shadow-xl grid place-content-center ${
          punch?.nextStatus === "OUT" ? "bg-amber-200 text-amber-900" : "bg-white text-teal-800"
        } disabled:opacity-60`}
      >
        <small className="text-xs font-semibold opacity-70">{punching ? "Saving…" : canPunch ? "Hold or tap" : "Locked"}</small>
        <strong className="block text-4xl leading-none">{punch?.nextStatus || "IN"}</strong>
        <em className="text-xs not-italic opacity-70">{clock}</em>
      </button>
      {holdPct > 0 && (
        <div className="h-1.5 bg-white/20 rounded-full mt-3 max-w-[220px] mx-auto overflow-hidden">
          <i className="block h-full bg-white" style={{ width: `${holdPct}%` }} />
        </div>
      )}
      <p className="text-sm text-center mt-3 opacity-90">
        Fingerprint punch works only at the premises Cybernetic Admin selected for your company or department.
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-3">
        {(punch?.today || []).map((p) => (
          <span key={p.id} className="bg-white/15 rounded-full px-3 py-1 text-xs">
            {p.status} {p.clockTime}
          </span>
        ))}
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 text-white shadow-lg" style={{ background: "linear-gradient(135deg, #062A32, #0B4F5C 55%, #0D9488)" }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center font-display font-bold text-lg">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-teal-100 text-xs uppercase tracking-[0.16em]">Employee portal</p>
              <h1 className="font-display text-xl font-bold leading-tight truncate">
                {home?.employee?.fullName || "My workplace"}
              </h1>
              <p className="text-teal-50/90 text-xs truncate">
                {home?.employee?.employeeNo ? `#${home.employee.employeeNo}` : ""}
                {home?.employee?.designation ? ` · ${home.employee.designation}` : ""}
                {home?.employee?.department ? ` · ${home.employee.department}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell variant="light" />
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex flex-wrap gap-2">
          {navBtn("home", "Home", Home)}
          {navBtn("leave", "Leave", Calendar)}
          {home?.medicalLeaveEnabled ? navBtn("medical", "Medical", Stethoscope) : null}
          {navBtn("resign", "Resign", FileText)}
          {navBtn("loan", "Loan", Landmark)}
          {navBtn("advance", "Advance", Wallet)}
          {navBtn("time", "Attendance", Clock)}
          {navBtn("pay", "Pay", Banknote)}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {(message || error) && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
            {error || message}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 py-10 text-center">Loading your portal…</p>
        ) : bootError ? (
          <div className="bg-white rounded-2xl p-6 border">
            <p className="font-semibold text-red-700 mb-2">Portal unavailable</p>
            <p className="text-sm text-slate-600">{bootError}</p>
          </div>
        ) : view === "home" ? (
          <section className="space-y-4">
            <article className="bg-white rounded-3xl border shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3 border-b bg-slate-50">
                <div className="w-14 h-14 rounded-2xl bg-teal-700 text-white grid place-content-center font-display font-bold text-lg overflow-hidden">
                  {emp.photo ? <img src={emp.photo} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-7 h-7" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-teal-700 font-semibold">My profile</p>
                  <h2 className="font-display text-xl font-bold truncate">{emp.fullName}</h2>
                  <p className="text-sm text-slate-500 truncate">
                    {[emp.designation, emp.department, emp.company].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100">
                {profileRows.map(([label, value]) => (
                  <div key={label} className="bg-white px-5 py-3">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</dt>
                    <dd className="text-sm text-slate-900 mt-0.5 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              {!!leaveBalances.length && (
                <div className="px-5 py-4 border-t">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Leave balance</p>
                  <div className="flex flex-wrap gap-2">
                    {leaveBalances.map((b) => (
                      <span key={b.leave_type || b.leaveType} className="rounded-full bg-teal-50 text-teal-900 px-3 py-1 text-xs font-semibold">
                        {b.leave_type || b.leaveType}: {b.available_days ?? b.availableDays ?? 0}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </article>
            {!!notices.length && (
              <div className="space-y-2">
                <h3 className="font-bold flex items-center gap-2"><Bell className="w-4 h-4" /> Company notices</h3>
                {notices.slice(0, 8).map((n) => (
                  <article key={n.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <strong>{n.title}</strong>
                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{n.body}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {n.scope === "department" ? n.department?.name || "Department" : "All employees"}
                      {n.created_at ? ` · ${new Date(n.created_at).toLocaleString()}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            )}
            {punchCard}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Attendance", value: home?.attendanceCount || 0, sub: "This month", go: "time" },
                { label: "OT hours", value: home?.otHours || 0, sub: "This month", go: "pay" },
                { label: "No pay", value: home?.nopayDays || 0, sub: "Days", go: "pay" },
                { label: "Last net", value: money(home?.lastSalary?.netPay), sub: "View only", go: "pay" },
              ].map((s) => (
                <button key={s.label} type="button" onClick={() => setView(s.go)} className="text-left bg-white rounded-2xl p-4 border shadow-sm">
                  <p className="text-xs text-slate-500 uppercase font-semibold">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => setView("leave")} className="text-left bg-white rounded-2xl p-4 border-2 border-teal-200">
                <strong>Request leave</strong>
                <p className="text-sm text-slate-500 mt-1">Annual, casual, short and no-pay. You cannot edit HR records.</p>
              </button>
              {home?.medicalLeaveEnabled ? (
                <button type="button" onClick={() => setView("medical")} className="text-left bg-white rounded-2xl p-4 border-2 border-teal-200">
                  <strong>Medical leave</strong>
                  <p className="text-sm text-slate-500 mt-1">Separate request. Attach a report; HR cannot approve until evidence is in.</p>
                </button>
              ) : null}
              <button type="button" onClick={() => setView("advance")} className="text-left bg-white rounded-2xl p-4 border-2 border-teal-200">
                <strong>Salary advance</strong>
                <p className="text-sm text-slate-500 mt-1">Request an advance for HR approval.</p>
              </button>
              <button type="button" onClick={() => setView("resign")} className="text-left bg-white rounded-2xl p-4 border-2 border-teal-200">
                <strong>Request resignation</strong>
                <p className="text-sm text-slate-500 mt-1">Submit a letter and documents. HR will review and approve later.</p>
              </button>
              <button type="button" onClick={() => setView("loan")} className="text-left bg-white rounded-2xl p-4 border-2 border-teal-200">
                <strong>Request a loan</strong>
                <p className="text-sm text-slate-500 mt-1">Ask HR for a loan. It is not deducted until they approve it.</p>
              </button>
            </div>
            <form className="bg-white rounded-2xl p-5 border space-y-3" onSubmit={onSavePassword}>
              <h3 className="font-bold flex items-center gap-2"><Key className="w-4 h-4" /> Change my password</h3>
              <input className="w-full border rounded-xl px-3 py-2" type="password" placeholder="Current password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} />
              <input className="w-full border rounded-xl px-3 py-2" type="password" placeholder="New password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} />
              <input className="w-full border rounded-xl px-3 py-2" type="password" placeholder="Confirm new password" value={passwordForm.new_password_confirmation} onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirmation: e.target.value })} />
              <button className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold" disabled={saving}>Update password</button>
            </form>
          </section>
        ) : view === "leave" ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Request leave</h2>
            <form className="bg-white rounded-2xl p-5 border space-y-3" onSubmit={onSubmitLeave}>
              <select className="w-full border rounded-xl px-3 py-2" value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="border rounded-xl px-3 py-2" type="date" required value={leaveForm.leave_from} onChange={(e) => setLeaveForm({ ...leaveForm, leave_from: e.target.value })} />
                <input className="border rounded-xl px-3 py-2" type="date" required value={leaveForm.leave_to} onChange={(e) => setLeaveForm({ ...leaveForm, leave_to: e.target.value })} />
              </div>
              <select className="w-full border rounded-xl px-3 py-2" value={leaveForm.day_type} onChange={(e) => setLeaveForm({ ...leaveForm, day_type: e.target.value })}>
                <option value="FULL">Full day</option>
                <option value="HALF">Half day</option>
                <option value="SHORT">Short leave</option>
              </select>
              {coveringSelect(leaveForm, setLeaveForm)}
              <textarea className="w-full border rounded-xl px-3 py-2" rows="3" required placeholder="Reason" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
              <button className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold" disabled={saving}>Submit leave request</button>
            </form>
            <h3 className="font-bold">My requests</h3>
            {(leaveHistory || []).filter((row) => !String(row.leave_type || "").toLowerCase().includes("medical")).map((row) => (
              <article key={row.id} className="bg-white rounded-2xl p-4 border flex justify-between gap-3">
                <div>
                  <strong>{row.leave_type || "Leave"}</strong>
                  <p className="text-sm text-slate-500">{row.leave_from} – {row.leave_to}</p>
                </div>
                <span className={`self-start text-xs font-semibold px-2 py-1 rounded-full ${statusClass(row.status)}`}>{row.status}</span>
              </article>
            ))}
            {!leaveHistory.filter((row) => !String(row.leave_type || "").toLowerCase().includes("medical")).length && <p className="text-slate-500 text-sm">No leave requests yet.</p>}
          </section>
        ) : view === "medical" && home?.medicalLeaveEnabled ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Medical leave</h2>
            <p className="text-sm text-slate-600">
              This is separate from normal leave. Days deduct from <strong>Casual</strong> first, then <strong>Annual</strong> if casual is finished. You may attach a medical report now or later. HR cannot approve until evidence is uploaded.
            </p>
            <form className="bg-white rounded-2xl p-5 border space-y-3" onSubmit={onSubmitMedical}>
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="border rounded-xl px-3 py-2" type="date" required value={medicalForm.leave_from} onChange={(e) => setMedicalForm({ ...medicalForm, leave_from: e.target.value })} />
                <input className="border rounded-xl px-3 py-2" type="date" required value={medicalForm.leave_to} onChange={(e) => setMedicalForm({ ...medicalForm, leave_to: e.target.value })} />
              </div>
              <select className="w-full border rounded-xl px-3 py-2" value={medicalForm.day_type} onChange={(e) => setMedicalForm({ ...medicalForm, day_type: e.target.value })}>
                <option value="FULL">Full day</option>
                <option value="HALF">Half day</option>
                <option value="SHORT">Short leave</option>
              </select>
              {coveringSelect(medicalForm, setMedicalForm)}
              <textarea className="w-full border rounded-xl px-3 py-2" rows="3" required placeholder="Purpose / medical reason" value={medicalForm.reason} onChange={(e) => setMedicalForm({ ...medicalForm, reason: e.target.value })} />
              <label className="block text-sm">
                Medical report or evidence (optional now)
                <input
                  className="mt-1 w-full text-sm"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setMedicalFile(e.target.files?.[0] || null)}
                />
              </label>
              <button className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold" disabled={saving}>Submit medical leave</button>
            </form>
            <h3 className="font-bold">My medical requests</h3>
            {(leaveHistory || []).filter((row) => String(row.leave_type || "").toLowerCase().includes("medical")).map((row) => (
              <article key={row.id} className="bg-white rounded-2xl p-4 border space-y-2">
                <div className="flex justify-between gap-3">
                  <div>
                    <strong>{row.leave_type}</strong>
                    <p className="text-sm text-slate-500">{row.leave_from} – {row.leave_to}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Casual {row.medical_casual_days ?? 0} · Annual {row.medical_annual_days ?? 0}
                      {Number(row.nopay_days) > 0 ? ` · NoPay ${row.nopay_days}` : ""}
                    </p>
                  </div>
                  <span className={`self-start text-xs font-semibold px-2 py-1 rounded-full ${statusClass(row.status)}`}>{row.status}</span>
                </div>
                {row.evidence_path ? (
                  <a href={row.evidence_path} target="_blank" rel="noreferrer" className="text-sm text-teal-700 underline">
                    View evidence{row.evidence_name ? ` (${row.evidence_name})` : ""}
                  </a>
                ) : (
                  <label className="block text-sm text-amber-800">
                    Waiting for evidence — HR cannot approve yet.
                    <input
                      className="mt-1 w-full text-sm"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => onAttachEvidence(row.id, e.target.files?.[0])}
                    />
                  </label>
                )}
              </article>
            ))}
            {!leaveHistory.filter((row) => String(row.leave_type || "").toLowerCase().includes("medical")).length && (
              <p className="text-slate-500 text-sm">No medical leave requests yet.</p>
            )}
          </section>
        ) : view === "resign" ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Request resignation</h2>
            <p className="text-sm text-slate-600">
              Attach your resignation letter or supporting documents. HR can check this later and complete the resignation approval process. You cannot approve it yourself.
            </p>
            <form className="bg-white rounded-2xl p-5 border space-y-3" onSubmit={onSubmitResignation}>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm text-slate-600">
                  Resignation date
                  <input className="mt-1 w-full border rounded-xl px-3 py-2" type="date" required value={resignForm.resigning_date} onChange={(e) => setResignForm({ ...resignForm, resigning_date: e.target.value })} />
                </label>
                <label className="text-sm text-slate-600">
                  Last working day
                  <input className="mt-1 w-full border rounded-xl px-3 py-2" type="date" required value={resignForm.last_working_day} onChange={(e) => setResignForm({ ...resignForm, last_working_day: e.target.value })} />
                </label>
              </div>
              <textarea className="w-full border rounded-xl px-3 py-2" rows="4" required minLength={10} placeholder="Reason (at least 10 characters)" value={resignForm.resignation_reason} onChange={(e) => setResignForm({ ...resignForm, resignation_reason: e.target.value })} />
              <label className="block text-sm">
                Resignation documents (PDF, Word, or image)
                <input
                  className="mt-1 w-full text-sm"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => setResignFiles(Array.from(e.target.files || []))}
                />
              </label>
              <button className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold" disabled={saving}>Submit resignation request</button>
            </form>
            <h3 className="font-bold">My requests</h3>
            {(resignations || []).map((row) => (
              <article key={row.id} className="bg-white rounded-2xl p-4 border flex justify-between gap-3">
                <div>
                  <strong>Last day {row.last_working_day?.slice ? String(row.last_working_day).slice(0, 10) : row.last_working_day}</strong>
                  <p className="text-sm text-slate-500">{row.resignation_reason}</p>
                  {!!(row.documents || []).length && (
                    <p className="text-xs text-slate-400 mt-1">{row.documents.length} document(s)</p>
                  )}
                </div>
                <span className={`self-start text-xs font-semibold px-2 py-1 rounded-full ${statusClass(row.status)}`}>{row.status}</span>
              </article>
            ))}
            {!resignations.length && <p className="text-slate-500 text-sm">No resignation request yet.</p>}
          </section>
        ) : view === "loan" ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Request a loan</h2>
            <p className="text-sm text-slate-600">
              HR reviews this later. Payroll deduction starts only after approval.
            </p>
            <form className="bg-white rounded-2xl p-5 border space-y-3" onSubmit={onSubmitLoan}>
              <input className="w-full border rounded-xl px-3 py-2" type="number" min="1" step="0.01" required placeholder="Loan amount" value={loanForm.loan_amount} onChange={(e) => setLoanForm({ ...loanForm, loan_amount: e.target.value })} />
              <input className="w-full border rounded-xl px-3 py-2" type="number" min="1" step="0.01" required placeholder="Monthly installment" value={loanForm.installment_amount} onChange={(e) => setLoanForm({ ...loanForm, installment_amount: e.target.value })} />
              <label className="block text-sm text-slate-600">
                Deduction start month
                <input className="mt-1 w-full border rounded-xl px-3 py-2" type="month" required value={loanForm.start_from} onChange={(e) => setLoanForm({ ...loanForm, start_from: e.target.value })} />
              </label>
              <select className="w-full border rounded-xl px-3 py-2" value={loanForm.installment_deduct_from} onChange={(e) => setLoanForm({ ...loanForm, installment_deduct_from: e.target.value })}>
                <option value="bonus">Deduct from monthly bonus</option>
                <option value="basic">Deduct from basic salary</option>
              </select>
              <textarea className="w-full border rounded-xl px-3 py-2" rows="3" required minLength={8} placeholder="Reason" value={loanForm.reason} onChange={(e) => setLoanForm({ ...loanForm, reason: e.target.value })} />
              <button className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold" disabled={saving}>Submit loan request</button>
            </form>
            <h3 className="font-bold">My loans</h3>
            {(loans || []).map((row) => (
              <article key={row.id} className="bg-white rounded-2xl p-4 border flex justify-between gap-3">
                <div>
                  <strong>{money(row.loan_amount)}</strong>
                  <p className="text-sm text-slate-500">
                    Installment {money(row.installment_amount)}
                    {row.start_from ? ` · from ${String(row.start_from).slice(0, 7)}` : ""}
                  </p>
                  {row.reason ? <p className="text-xs text-slate-400 mt-1">{row.reason}</p> : null}
                </div>
                <span className={`self-start text-xs font-semibold px-2 py-1 rounded-full ${statusClass(row.status)}`}>{row.status}</span>
              </article>
            ))}
            {!loans.length && <p className="text-slate-500 text-sm">No loan requests yet.</p>}
          </section>
        ) : view === "advance" ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Salary advance</h2>
            <form className="bg-white rounded-2xl p-5 border space-y-3" onSubmit={onSubmitAdvance}>
              <p className="text-sm text-slate-600">
                HR chooses whether this is deducted from monthly bonus or basic salary when they approve. You cannot select that here.
              </p>
              <input className="w-full border rounded-xl px-3 py-2" type="number" min="1" step="0.01" required placeholder="Amount" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} />
              <input className="w-full border rounded-xl px-3 py-2" type="date" value={advanceForm.needed_on} onChange={(e) => setAdvanceForm({ ...advanceForm, needed_on: e.target.value })} />
              <textarea className="w-full border rounded-xl px-3 py-2" rows="3" required placeholder="Reason" value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} />
              <button className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold" disabled={saving}>Submit advance request</button>
            </form>
            <h3 className="font-bold">My requests</h3>
            {(advances || []).map((row) => (
              <article key={row.id} className="bg-white rounded-2xl p-4 border flex justify-between gap-3">
                <div>
                  <strong>{money(row.amount)}</strong>
                  <p className="text-sm text-slate-500">{row.reason}</p>
                </div>
                <span className={`self-start text-xs font-semibold px-2 py-1 rounded-full ${statusClass(row.status)}`}>{row.status}</span>
              </article>
            ))}
            {!advances.length && <p className="text-slate-500 text-sm">No advance requests yet.</p>}
          </section>
        ) : view === "time" ? (
          <section className="space-y-4">
            {punchCard}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">My attendance</h2>
              <div className="flex gap-2">
                <select className="border rounded-xl px-2 py-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <input className="border rounded-xl px-2 py-1 w-24" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
            </div>
            <p className="text-sm text-slate-500">View only. Phone punch writes to the time card.</p>
            {(attendance || []).map((row) => (
              <article key={row.id} className="bg-white rounded-2xl p-4 border">
                <strong>{row.cardDate}</strong>
                <p className="text-sm text-slate-500">{row.clockTime || "—"} · {row.status || "Present"} · {row.workingHours || 0} hrs</p>
              </article>
            ))}
            {!attendance.length && <p className="text-slate-500 text-sm">No attendance for this month.</p>}
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Pay & overtime</h2>
              <div className="flex gap-2">
                <select className="border rounded-xl px-2 py-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <input className="border rounded-xl px-2 py-1 w-24" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
            </div>
            <p className="text-sm text-slate-500">Full salary detail is view only. Download the paysheet PDF for any processed month.</p>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">Processed salary</h3>
              {salaries.length > 1 && (
                <button
                  type="button"
                  onClick={() => downloadPayslips(salaries)}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-700 text-teal-800"
                >
                  <Download className="w-3.5 h-3.5" /> Download all (2 per A4)
                </button>
              )}
            </div>
            {(salaries || []).map((row) => {
              const sb = row.breakdown || {};
              const open = openSalaryId === row.id;
              const lines = [
                ["Basic", sb.basic_salary || row.basicSalary],
                ["BR allowance", sb.br_allowance],
                ["OT morning", sb.ot_morning_fees || sb.ot_morning],
                ["OT night", sb.ot_night_fees || sb.ot_evening],
                ["Gross", sb.gross_salary || row.grossPay],
                ["EPF 8%", sb.epf_employee_deduction],
                ["No pay", sb.no_pay_deduction || sb.full_day_nopay_deduction],
                ["Loan", sb.loan_installment || sb.loan_principal],
                ["Stamp", sb.stamp_duty || sb.stamp],
                ["Total deductions", sb.total_deductions || row.totalDeductions],
                ["Net", sb.net_salary || row.netPay],
              ];
              return (
                <article key={row.id} className="bg-white rounded-2xl p-4 border space-y-2">
                  <div className="flex justify-between gap-3 items-start">
                    <div>
                      <strong>{MONTHS[(row.salaryMonth || row.month || 1) - 1]} {row.salaryYear || row.year}</strong>
                      <p className="text-sm text-slate-500">Net {money(row.netPay || row.net_salary)} · {row.status}</p>
                    </div>
                    <button type="button" onClick={() => downloadPayslip(row)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-700 text-white">
                      <Download className="w-3.5 h-3.5" /> Paysheet
                    </button>
                  </div>
                  <button type="button" className="text-sm text-teal-800 font-semibold" onClick={() => setOpenSalaryId(open ? null : row.id)}>
                    {open ? "Hide details" : "Show salary details"}
                  </button>
                  {open && (
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {lines.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => (
                        <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                          <dt className="text-[11px] uppercase text-slate-400">{k}</dt>
                          <dd className="font-semibold">{money(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </article>
              );
            })}
            {!salaries.length && <p className="text-slate-500 text-sm">No processed salary yet.</p>}
            <h3 className="font-bold">Overtime</h3>
            {(overtime || []).map((row) => (
              <article key={row.id} className="bg-white rounded-2xl p-4 border flex justify-between">
                <div>
                  <strong>{row.otDate || row.created_at}</strong>
                  <p className="text-sm text-slate-500">{row.hours || row.ot_hours || 0} hrs · {money(row.amount)}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusClass(row.status)}`}>{row.status || "POSTED"}</span>
              </article>
            ))}
            {!overtime.length && <p className="text-slate-500 text-sm">No OT this month.</p>}
            <h3 className="font-bold">No pay</h3>
            {(nopay || []).map((row) => (
              <article key={row.id} className="bg-white rounded-2xl p-4 border">
                <strong>{row.nopayDate || row.date}</strong>
                <p className="text-sm text-slate-500">{row.nopayDays || row.no_pay_count || 0} day(s) · {money(row.amount)}</p>
              </article>
            ))}
            {!nopay.length && <p className="text-slate-500 text-sm">No no-pay this month.</p>}
          </section>
        )}
      </main>
    </div>
  );
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
