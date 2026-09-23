import axios from "../utils/axios";

const asUserList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.users)) return data.users;
  return [];
};

const UserManagementService = {
  getAllUsers: async () => {
    const response = await axios.get("/users");
    return asUserList(response.data);
  },

  getUserById: async (id) => {
    const response = await axios.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (userData) => {
    const response = await axios.post("/users", userData);
    return response.data;
  },

  updateUser: async (id, userData) => {
    const response = await axios.put(`/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await axios.delete(`/users/${id}`);
    return response.data;
  },

  getRoles: async () => {
    const response = await axios.get("/acl/roles");
    return Array.isArray(response.data?.roles) ? response.data.roles : [];
  },

  createRole: async (payload) => {
    const response = await axios.post("/acl/roles", payload);
    return response.data;
  },

  deleteRole: async (id) => {
    const response = await axios.delete(`/acl/roles/${id}`);
    return response.data;
  },

  assignRole: async (userId, role) => {
    const response = await axios.post("/acl/assign-role", { user_id: userId, role });
    return response.data;
  },
};

export default UserManagementService;
