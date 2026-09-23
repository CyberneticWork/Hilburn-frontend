import React, { useEffect, useMemo, useState } from "react";
import { Shield, Users, RefreshCw, Plus, User, Mail, Key, Eye, EyeOff, X, UserCog } from "lucide-react";
import Swal from "sweetalert2";
import UserManagementService from "../../services/UserManagementService";
import { useAuth } from "../../contexts/AuthContext";
import UserAclModal from "./UserAclModal";

const SYSTEM_STAFF = [
  { id: "hr", name: "HR" },
  { id: "supervisor", name: "Supervisor" },
  { id: "user", name: "User" },
];

const emptyUserForm = {
  name: "",
  email: "",
  password: "",
  password_confirmation: "",
  role: "hr",
};

export default function AccessControl() {
  const { user: authUser } = useAuth();
  const isAdmin =
    String(authUser?.role || "").toLowerCase() === "admin" || !!authUser?.is_super_admin;
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aclUser, setAclUser] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(emptyUserForm);
  const [roleForm, setRoleForm] = useState({ name: "", based_on: "hr" });
  const [assignForm, setAssignForm] = useState({ user_id: "", role: "hr" });
  const [errors, setErrors] = useState({});

  const roleLabel = (key) => {
    const found = roles.find((r) => r.key === String(key || "").toLowerCase());
    return found?.name || key || "User";
  };

  const staffRoles = useMemo(() => {
    const extra = roles.filter((r) => r.acl_assignable && !SYSTEM_STAFF.some((s) => s.id === r.key));
    return [
      ...SYSTEM_STAFF,
      ...extra.map((r) => ({ id: r.key, name: r.name })),
    ];
  }, [roles]);

  const load = async () => {
    try {
      setLoading(true);
      const [userRows, roleRows] = await Promise.all([
        UserManagementService.getAllUsers(),
        UserManagementService.getRoles().catch(() => []),
      ]);
      setUsers(Array.isArray(userRows) ? userRows : []);
      setRoles(Array.isArray(roleRows) ? roleRows : []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Could not load users",
        text: error?.response?.data?.message || "Failed to load users.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const roleOf = (u) => String(u?.role || "user").toLowerCase();
  const assignable = users.filter((u) => roleOf(u) !== "admin" && roleOf(u) !== "employee");

  const openUserManagement = () => {
    window.dispatchEvent(new CustomEvent("hr:navigate", { detail: "userManagement" }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const validationErrors = {};
    if (!formData.name.trim()) validationErrors.name = "Name is required";
    if (!formData.email.trim() || !formData.email.includes("@")) {
      validationErrors.email = "Valid email is required";
    }
    if (!formData.password) validationErrors.password = "Password is required";
    if (formData.password && formData.password.length < 8) {
      validationErrors.password = "Password must be at least 8 characters";
    }
    if (formData.password !== formData.password_confirmation) {
      validationErrors.password_confirmation = "Passwords do not match";
    }
    if (!formData.role) validationErrors.role = "Role is required";
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      const created = await UserManagementService.createUser(formData);
      const newUser = created?.user || created;
      setShowAdd(false);
      setFormData(emptyUserForm);
      setShowPassword(false);
      await load();
      if (newUser?.id) setAclUser(newUser);
      Swal.fire({
        icon: "success",
        title: "User created",
        text: "Tick the screens this account can use.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        Swal.fire({
          icon: "error",
          title: "Could not create user",
          text: error.response?.data?.message || "Failed to save user.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      Swal.fire({ icon: "warning", title: "Role name is required" });
      return;
    }
    setSaving(true);
    try {
      await UserManagementService.createRole(roleForm);
      setShowCreateRole(false);
      setRoleForm({ name: "", based_on: "hr" });
      await load();
      Swal.fire({
        icon: "success",
        title: "Role created",
        text: "Assign this role to an existing user, then allocate ACL.",
        timer: 1800,
        showConfirmButton: false,
      });
      setShowAssign(true);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Could not create role",
        text: error.response?.data?.message || "Failed to create role.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: `Delete ${role.name}?`,
      text: "Users on this role will fall back to its base (HR / Supervisor / User).",
      showCancelButton: true,
      confirmButtonText: "Delete role",
    });
    if (!ok.isConfirmed) return;
    try {
      await UserManagementService.deleteRole(role.id);
      await load();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Could not delete role",
        text: error.response?.data?.message || "Failed to delete role.",
      });
    }
  };

  const handleAssignRole = async (e) => {
    e.preventDefault();
    if (!assignForm.user_id || !assignForm.role) {
      Swal.fire({ icon: "warning", title: "Select a user and a role" });
      return;
    }
    setSaving(true);
    try {
      const result = await UserManagementService.assignRole(assignForm.user_id, assignForm.role);
      setShowAssign(false);
      await load();
      const updated = result?.user;
      Swal.fire({
        icon: "success",
        title: "Role assigned",
        text: `${updated?.name || "User"} is now ${roleLabel(assignForm.role)}.`,
        timer: 1600,
        showConfirmButton: false,
      });
      if (updated?.id && assignForm.role !== "admin" && assignForm.role !== "employee") {
        setAclUser(updated);
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Could not assign role",
        text: error.response?.data?.message || "Failed to assign role.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Only Admin can allocate user permissions.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Shield className="h-6 w-6 text-teal-700" />
            Access Control (ACL)
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Create a role, assign it to an existing login, then tick which screens that person can use.
            Access Control stays with Admin / Super Admin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setRoleForm({ name: "", based_on: "hr" });
              setShowCreateRole(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            <Plus size={16} />
            Create role
          </button>
          <button
            type="button"
            onClick={() => {
              setAssignForm({
                user_id: users[0]?.id ? String(users[0].id) : "",
                role: staffRoles[0]?.id || "hr",
              });
              setShowAssign(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <UserCog size={16} />
            Assign to existing user
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData({ ...emptyUserForm, role: staffRoles[0]?.id || "hr" });
              setErrors({});
              setShowPassword(false);
              setShowAdd(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus size={16} />
            Add HR user
          </button>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Roles</h2>
        </div>
        {loading ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">Loading roles…</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Based on</th>
                <th className="px-5 py-3 font-medium">Users</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {row.name}
                    {row.is_system ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        System
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 capitalize text-slate-600">{row.based_on}</td>
                  <td className="px-5 py-3 text-slate-600">{row.users_count}</td>
                  <td className="px-5 py-3 text-right">
                    {!row.is_system ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(row)}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">Loading users…</p>
        ) : assignable.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-800">No staff users to allocate yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a role, assign it to an existing user, or add a new HR login.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowAssign(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <UserCog size={16} />
                Assign to existing user
              </button>
              <button
                type="button"
                onClick={openUserManagement}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open User Management
              </button>
            </div>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 text-right font-medium">Permission</th>
              </tr>
            </thead>
            <tbody>
              {assignable.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-5 py-3 text-slate-600">{row.email}</td>
                  <td className="px-5 py-3 text-slate-700">{roleLabel(row.role)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setAclUser(row)}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      <Shield size={14} />
                      Allocate ACL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">Create role</h3>
              <button type="button" onClick={() => setShowCreateRole(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role name</label>
                <input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Finance, Payroll, Branch Manager"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Based on</label>
                <select
                  value={roleForm.based_on}
                  onChange={(e) => setRoleForm((p) => ({ ...p, based_on: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  {SYSTEM_STAFF.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} default screens
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Default screens until you tick ACL for each person on this role.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateRole(false)} className="rounded-lg border px-4 py-2 text-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60">
                  {saving ? "Saving…" : "Create role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">Assign role to existing user</h3>
              <button type="button" onClick={() => setShowAssign(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAssignRole} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Existing user</label>
                <select
                  value={assignForm.user_id}
                  onChange={(e) => setAssignForm((p) => ({ ...p, user_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="">Select user</option>
                  {users
                    .filter((u) => String(u.role || "").toLowerCase() !== "admin")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) — {roleLabel(u.role)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={assignForm.role}
                  onChange={(e) => setAssignForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  {roles
                    .filter((r) => r.key !== "admin")
                    .map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAssign(false)} className="rounded-lg border px-4 py-2 text-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60">
                  {saving ? "Saving…" : "Assign role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">Add HR user</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full rounded-lg border py-2 pr-3 pl-10 ${errors.name ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Jane Perera"
                  />
                </div>
                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full rounded-lg border py-2 pr-3 pl-10 ${errors.email ? "border-red-500" : "border-gray-300"}`}
                    placeholder="hr@company.com"
                  />
                </div>
                {errors.email && <p className="mt-1 text-sm text-red-500">{Array.isArray(errors.email) ? errors.email[0] : errors.email}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Key className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full rounded-lg border py-2 pr-10 pl-10 ${errors.password ? "border-red-500" : "border-gray-300"}`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-0 pr-3 text-gray-400">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-500">{Array.isArray(errors.password) ? errors.password[0] : errors.password}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Key className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password_confirmation"
                    value={formData.password_confirmation}
                    onChange={handleChange}
                    className={`w-full rounded-lg border py-2 pr-3 pl-10 ${errors.password_confirmation ? "border-red-500" : "border-gray-300"}`}
                    placeholder="••••••••"
                  />
                </div>
                {errors.password_confirmation && (
                  <p className="mt-1 text-sm text-red-500">
                    {Array.isArray(errors.password_confirmation) ? errors.password_confirmation[0] : errors.password_confirmation}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  User Role <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Shield className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-gray-400" />
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className={`w-full rounded-lg border bg-white py-2 pr-3 pl-10 ${errors.role ? "border-red-500" : "border-gray-300"}`}
                  >
                    {staffRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.role && <p className="mt-1 text-sm text-red-500">{Array.isArray(errors.role) ? errors.role[0] : errors.role}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
                  {saving ? "Creating…" : "Create and allocate ACL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {aclUser && <UserAclModal user={aclUser} onClose={() => setAclUser(null)} />}
    </div>
  );
}