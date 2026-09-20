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
};

export default UserManagementService;
