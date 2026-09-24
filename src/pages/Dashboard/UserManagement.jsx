import React, { useState, useEffect } from "react";
import {
  User,
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  Shield,
  Key,
  Mail,
  UserPlus,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import Swal from "sweetalert2";
import UserManagementService from "../../services/UserManagementService";
import { useAuth } from "../../contexts/AuthContext";
import useAcl from "../../hooks/useAcl";
import UserAclModal from "./UserAclModal";

// User form modal component defined outside to prevent re-creation on each render
const UserFormModal = ({
  isOpen,
  onClose,
  title,
  isEdit = false,
  formData,
  handleChange,
  handleSubmit,
  errors,
  showPassword,
  setShowPassword,
  roles,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border ${
                    errors.name ? "border-red-500" : "border-gray-300"
                  } rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border ${
                    errors.email ? "border-red-500" : "border-gray-300"
                  } rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="john@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {!isEdit && <span className="text-red-500">*</span>}
                {isEdit && (
                  <span className="text-xs text-gray-500 ml-1">
                    (Leave blank to keep current)
                  </span>
                )}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-10 py-2 border ${
                    errors.password ? "border-red-500" : "border-gray-300"
                  } rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="••••••••"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password{" "}
                {!isEdit && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password_confirmation"
                  value={formData.password_confirmation}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border ${
                    errors.password_confirmation
                      ? "border-red-500"
                      : "border-gray-300"
                  } rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="••••••••"
                />
              </div>
              {errors.password_confirmation && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.password_confirmation}
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Role <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border ${
                    errors.role ? "border-red-500" : "border-gray-300"
                  } rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white`}
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.role && (
                <p className="mt-1 text-sm text-red-500">{errors.role}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link employee master
              </label>
              <input
                type="text"
                name="employee_link"
                value={formData.employee_link || ""}
                onChange={handleChange}
                className={`w-full px-3 py-2 border ${
                  errors.employee_link ? "border-red-500" : "border-gray-300"
                } rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                placeholder="Attendance no, EPF or NIC"
              />
              {errors.employee_link && (
                <p className="mt-1 text-sm text-red-500">
                  {Array.isArray(errors.employee_link)
                    ? errors.employee_link[0]
                    : errors.employee_link}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                One password. Keep this person on their HR/manager role for ACL,
                and link their employee record so they can open My salary & leave
                like any other staff member.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isEdit ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const { user: authUser } = useAuth();
  const { canAdd, canEdit, canDelete } = useAcl("userManagement");
  const canAllocateAcl =
    String(authUser?.role || "").toLowerCase() === "admin" ||
    !!authUser?.is_super_admin ||
    !!authUser?.acl_assignable;
  const [aclUser, setAclUser] = useState(null);
  // State variables
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    role: "user",
    employee_link: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  // Updated roles to match backend structure
  const [roles, setRoles] = useState([
    { id: "admin", name: "Administrator" },
    { id: "supervisor", name: "Supervisor" },
    { id: "hr", name: "HR" },
    { id: "employee", name: "Employee" },
    { id: "user", name: "User" },
  ]);

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [data, roleRows] = await Promise.all([
        UserManagementService.getAllUsers(),
        UserManagementService.getRoles().catch(() => []),
      ]);
      setUsers(Array.isArray(data) ? data : []);
      if (Array.isArray(roleRows) && roleRows.length) {
        setRoles(roleRows.map((r) => ({ id: r.key, name: r.name })));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to load users. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search term
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.role && user.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Handle form submission for adding new user
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validationErrors = {};
    if (!formData.name.trim()) validationErrors.name = "Name is required";
    if (!formData.email.trim()) validationErrors.email = "Email is required";
    if (!formData.email.includes("@"))
      validationErrors.email = "Invalid email format";
    if (!currentUser) {
      if (!formData.password)
        validationErrors.password = "Password is required";
      if (formData.password && formData.password.length < 8)
        validationErrors.password = "Password must be at least 8 characters";
      if (formData.password !== formData.password_confirmation)
        validationErrors.password_confirmation = "Passwords do not match";
    }
    if (!formData.role) validationErrors.role = "Role is required";

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
console.log("Submitting form data:", currentUser, formData);
    try {
      if (currentUser) {
        // Update existing user
        await UserManagementService.updateUser(currentUser.id, formData);
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "User updated successfully!",
        });
      } else {
        // Create new user
        await UserManagementService.createUser(formData);
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "User created successfully!",
        });
      }

      // Close modal and refresh users
      setShowAddModal(false);
      setShowEditModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error);

      // Handle validation errors from server
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text:
            error.response?.data?.message ||
            "Failed to save user. Please try again.",
        });
      }
    }
  };

  // Handle editing user
  const handleEditClick = (user) => {
    setCurrentUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role || "user",
      password: "",
      password_confirmation: "",
      employee_link: user.employee?.attendance_employee_no || "",
    });
    setShowEditModal(true);
    setErrors({});
  };

  // Open add modal
  const handleAddClick = () => {
    setCurrentUser(null);
    resetForm();
    setShowAddModal(true);
    setErrors({});
  };

  // Handle deleting user (soft delete by setting deleted_at)
  const handleDeleteClick = (userId) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this action!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await UserManagementService.deleteUser(userId);
          fetchUsers();
          Swal.fire("Deleted!", "User has been deleted.", "success");
        } catch (error) {
          console.error("Error deleting user:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "Failed to delete user. Please try again.",
          });
        }
      }
    });
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
      role: "user",
      employee_link: "",
    });
    setCurrentUser(null);
    setErrors({});
    setShowPassword(false);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    resetForm();
  };

  // Generate role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "employee":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  // Check if user is active based on deleted_at being null
  const isUserActive = (user) => user.deleted_at === null;

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-800 to-blue-900 px-4 sm:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center mb-2">
          <Users className="h-10 w-10 text-white opacity-80 mr-3" />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center">
            User Management
          </h1>
        </div>
        <p className="text-blue-200 text-center mt-2 text-sm sm:text-base">
          One login, one password. Assign an HR/manager role for ACL, then link
          the same person to Employee Master so they can also check their own
          salary and leave.
        </p>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Control Panel */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-6 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full sm:w-80 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {canAdd && (
              <button
                onClick={handleAddClick}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2"
              >
                <UserPlus className="h-5 w-5" />
                <span>Add New User</span>
              </button>
              )}

              {/* Refresh Button */}
              <button
                onClick={fetchUsers}
                className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title="Refresh user list"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-gray-600">Loading users...</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      User
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Role
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {user.profile_photo_url ? (
                              <img
                                className="h-10 w-10 rounded-full"
                                src={user.profile_photo_url}
                                alt={user.name}
                              />
                            ) : (
                              <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                                {user.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {user.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {user.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.created_at
                            ? `Joined: ${new Date(
                                user.created_at
                              ).toLocaleDateString()}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {roles.find((r) => r.id === user.role)?.name ||
                            user.role ||
                            "User"}
                        </span>
                        {user.employee_id ? (
                          <div className="mt-1 text-[11px] text-teal-700">
                            Own pay/leave
                            {user.employee?.attendance_employee_no
                              ? ` · #${user.employee.attendance_employee_no}`
                              : ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isUserActive(user)
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {isUserActive(user) ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Active
                            </>
                          ) : (
                            <>
                              <X className="mr-1 h-3 w-3" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <div className="flex justify-center space-x-2">
                          {canAllocateAcl &&
                            !["admin", "employee"].includes(String(user.role || "").toLowerCase()) && (
                            <button
                              onClick={() => setAclUser(user)}
                              className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                              title="Allocate ACL"
                            >
                              <Shield size={14} />
                              ACL
                            </button>
                          )}
                          {canEdit && (
                          <button
                            onClick={() => handleEditClick(user)}
                            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                            title="Edit User"
                          >
                            <Edit size={16} />
                          </button>
                          )}
                          {canDelete && (
                          <button
                            onClick={() => handleDeleteClick(user.id)}
                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                No users found
              </h3>
              <p className="mt-1 text-gray-500">
                {searchTerm
                  ? "No users match your search criteria."
                  : "Start by adding a new user."}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Form Modals */}
      <UserFormModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        title="Add New User"
        isEdit={false}
        formData={formData}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        errors={errors}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        roles={roles}
      />
      <UserFormModal
        isOpen={showEditModal}
        onClose={handleCloseModal}
        title="Edit User"
        isEdit={true}
        formData={formData}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        errors={errors}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        roles={roles}
      />
      {aclUser && <UserAclModal user={aclUser} onClose={() => setAclUser(null)} />}
    </div>
  );
};

export default UserManagement;
