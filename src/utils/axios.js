import axiosLib from "axios";
import { getToken, setToken } from "../services/TokenService";
import config from "../config";

const root = String(config.apiBaseUrl || "").replace(/\/$/, "");
const apiUrl = root ? `${root}/api` : "/api";

const axios = axiosLib.create({
  baseURL: apiUrl,
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

axios.interceptors.request.use((req) => {
  req.headers = req.headers || {};
  rewriteIndexPhpFrontController(req);
  const token = getToken();
  const cyberneticToken =
    sessionStorage.getItem("cybernetic_admin_token") ||
    localStorage.getItem("cybernetic_admin_token");
  if (cyberneticToken) {
    req.headers["X-Cybernetic-Token"] = cyberneticToken;
  }
  const url = String(req.url || "");
  const lr = String(req.params?.__lr || "");
  const companyAdminCall =
    url.includes("/companies") ||
    url.includes("cybernetic-admin") ||
    url.includes("/media/firebase") ||
    lr.includes("/companies") ||
    lr.includes("cybernetic-admin") ||
    lr.includes("/media/firebase");
  if (cyberneticToken && (companyAdminCall || !token)) {
    req.headers.Authorization = `Bearer ${cyberneticToken}`;
  } else if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      if (!urlIsLogin(err)) {
        setToken(null);
      }
    }
    if (err?.response?.data && typeof err.response.data === "object") {
      const safe = { message: err.response.data.message || "Request failed." };
      if (status === 422 && err.response.data.errors && urlIsLogin(err)) {
        err.response.data = { message: "The provided credentials are incorrect." };
      } else if (status >= 500) {
        err.response.data = { message: "Request failed. Please try again." };
      } else {
        const next = { ...err.response.data, ...safe };
        delete next.trace;
        delete next.exception;
        delete next.file;
        delete next.line;
        err.response.data = next;
      }
    }
    return Promise.reject(err);
  }
);

function urlIsLogin(err) {
  const url = String(err?.config?.url || "");
  const lr = String(err?.config?.params?.__lr || "");
  return url.includes("/login") || url.includes("/send-otp") || lr.includes("/login") || lr.includes("/send-otp");
}

/** Hosts that only execute *.php need /index.php?__lr=/api/... instead of /index.php/api/... */
function rewriteIndexPhpFrontController(req) {
  const base = String(req.baseURL || "");
  const marker = "/index.php";
  const at = base.toLowerCase().indexOf(marker);
  if (at === -1) return;

  const currentUrl = String(req.url || "");
  if (currentUrl === "/index.php" && req.params && req.params.__lr) return;

  const origin = base.slice(0, at);
  const afterFront = base.slice(at + marker.length).replace(/\/$/, "");
  const [relPath, relQuery] = currentUrl.split("?");
  const pathPart = relPath.startsWith("/") ? relPath : `/${relPath}`;
  const lr = `${afterFront}${pathPart}` || "/";

  const params = { ...(req.params || {}) };
  if (relQuery) {
    new URLSearchParams(relQuery).forEach((value, key) => {
      if (params[key] == null) params[key] = value;
    });
  }
  params.__lr = lr.startsWith("/") ? lr : `/${lr}`;

  req.baseURL = origin;
  req.url = "/index.php";
  req.params = params;
}

export default axios;
