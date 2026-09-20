import React, { createContext, useContext, useState, useEffect } from "react";
import { loadUser } from "../services/AuthService";
import { permissions } from "../config/permissions"; // Or fetch from API
import { getToken } from "../services/TokenService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});

  useEffect(() => {
    const fetchUser = async () => {
      if (!getToken()) {
        return;
      }
      try {
        const userData = await loadUser();
        setUser(userData);
        setUserPermissions(userData.permissions || permissions[userData.role] || {});
      } catch {
        setUser(null);
        setUserPermissions({});
      }
    };
    fetchUser();
  }, []);

  // Keep permissions in sync if user's role changes (e.g., after re-login)
  useEffect(() => {
    if (user && user.permissions) {
      setUserPermissions(user.permissions);
    } else if (user && user.role) {
      setUserPermissions(permissions[user.role] || {});
    } else {
      setUserPermissions({});
    }
  }, [user]);

  // Allow app code to push a new user into context after login/register
  const setAuthUser = (newUser) => {
    setUser(newUser);
    const role = newUser?.role;
    setUserPermissions(newUser?.permissions || (role ? permissions[role] || {} : {}));
  };

  // Clear auth state on logout
  const clearAuth = () => {
    setUser(null);
    setUserPermissions({});
  };

  const hasPermission = (module, action) => {
    if (String(user?.role || "").toLowerCase() === "admin" || user?.is_super_admin) {
      return true;
    }
    const block = userPermissions[module] || {};
    if (block[action]) return true;
    if (action === "edit" && (block.update || block.add)) return true;
    if (action === "add" && (block.create || block.edit)) return true;
    return false;
  };

  return (
    <AuthContext.Provider
      value={{ user, userPermissions, hasPermission, setAuthUser, clearAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
