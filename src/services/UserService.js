let user = null;

const WORK_MODE_KEY = "hr_work_mode";

export function setUser(newUser) {
  user = newUser;
  if (newUser) {
    localStorage.setItem("user", JSON.stringify(newUser));
  } else {
    localStorage.removeItem("user");
  }
}

export function getUser() {
  if (user) return user;
  const stored = localStorage.getItem("user");
  if (stored) {
    user = JSON.parse(stored);
    return user;
  }
  return null;
}

export function clearUser() {
  user = null;
  localStorage.removeItem("user");
  try {
    sessionStorage.removeItem(WORK_MODE_KEY);
  } catch {
    /* ignore */
  }
}

export function canUseHrDesk(u = getUser()) {
  if (!u) return false;
  if (u.can_use_hr_desk === true || u.can_use_hr_desk === false) {
    return !!u.can_use_hr_desk;
  }
  if (u.is_super_admin) return true;
  const role = String(u.role || "").toLowerCase();
  return role !== "employee" && !u.portal_only;
}

export function canUseEmployeePortal(u = getUser()) {
  if (!u) return false;
  if (u.can_use_employee_portal === true || u.can_use_employee_portal === false) {
    return !!u.can_use_employee_portal;
  }
  const role = String(u.role || "").toLowerCase();
  return role === "employee" || !!u.portal_only || Number(u.employee_id) > 0;
}

export function isDualUser(u = getUser()) {
  return canUseHrDesk(u) && canUseEmployeePortal(u);
}

export function getWorkMode(u = getUser()) {
  const hr = canUseHrDesk(u);
  const portal = canUseEmployeePortal(u);
  if (portal && !hr) return "employee";
  if (hr && !portal) return "hr";
  if (hr && portal) {
    try {
      const stored = sessionStorage.getItem(WORK_MODE_KEY);
      if (stored === "employee" || stored === "hr") return stored;
    } catch {
      /* ignore */
    }
    return "hr";
  }
  return "hr";
}

export function setWorkMode(mode) {
  try {
    sessionStorage.setItem(WORK_MODE_KEY, mode === "employee" ? "employee" : "hr");
  } catch {
    /* ignore */
  }
}

export function enterEmployeePortal() {
  setWorkMode("employee");
}

export function enterHrDesk() {
  setWorkMode("hr");
}

export function isEmployeeUser(u = getUser()) {
  return getWorkMode(u) === "employee";
}

export function homePathForUser(u, from) {
  if (!canUseHrDesk(u) && canUseEmployeePortal(u)) return "/employee-portal";
  if (getWorkMode(u) === "employee") return "/employee-portal";
  if (from && from !== "/" && !String(from).startsWith("/employee-portal")) {
    return from;
  }
  return "/dashboard";
}
