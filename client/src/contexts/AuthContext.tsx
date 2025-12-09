import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "../types";
import apiService from "../services/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (userData: any) => Promise<any>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load stored user/token on refresh
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (token && savedUser) {
        try {
          const response = await apiService.getCurrentUser();

          // response.data = { success, data: { user } }
          const currentUser = response.data?.data?.user;

          if (currentUser) {
            setUser(currentUser);
          } else {
            throw new Error("Invalid user data");
          }
        } catch (error) {
          console.error("Auto-login failed:", error);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setUser(null);
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // ============================================
  // LOGIN
  // ============================================
  const login = async (email: string, password: string) => {
    try {
      const response = await apiService.login({ email, password });

      // Backend returns: { success, data: { user, token } }
      const userData = response.data?.data?.user;
      const token = response.data?.data?.token;

      if (!token || !userData) {
        throw new Error("Invalid login response");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));

      setUser(userData);

      return { token, user: userData };
    } catch (error: any) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // ============================================
  // REGISTER
  // ============================================
  const register = async (userData: any) => {
    const response = await apiService.register(userData);

    const newUser = response.data?.data?.user;
    const token = response.data?.data?.token;

    if (token) {
      localStorage.setItem("token", token);
    }

    if (newUser) {
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);
    }

    return response.data;
  };

  // ============================================
  // LOGOUT
  // ============================================
  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
    }
  };

  // ============================================
  // UPDATE USER (Profile)
  // ============================================
  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  // CONTEXT VALUE
  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
