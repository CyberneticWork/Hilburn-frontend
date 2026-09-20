import React, { useEffect, useState } from "react";
import { Shield, Users, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";
import UserManagementService from "../../services/UserManagementService";
import { useAuth } from "../../contexts/AuthContext";
import UserAclModal from "./UserAclModal";

const ACL_ROLES = ["hr", "supervisor", "user"];

export default function AccessControl() {
  const { user: authUser } = useAuth();
  const isAdmin = String(authUser?.role || "").toLowerCase() === "admin";
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aclUser, setAclUser] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await UserManagementService.getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
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

  const assignable = users.filter((u) =>
    ACL_ROLES.includes(String(u.role || "").toLowerCase())
  );

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
            Allocate which screens each HR / Supervisor / User account can View, Add, Edit, Delete, or Approve.
            Create those users first in User Management if the list is empty.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">Loading users…</p>
        ) : assignable.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-800">No HR users to allocate yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Add a user with role HR, Supervisor, or User in User Management, then return here to tick their screens.
            </p>
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
                  <td className="px-5 py-3 capitalize text-slate-700">{row.role}</td>
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

      {aclUser && <UserAclModal user={aclUser} onClose={() => setAclUser(null)} />}
    </div>
  );
}
