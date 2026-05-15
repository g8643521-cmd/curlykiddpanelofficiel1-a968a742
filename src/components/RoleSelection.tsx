import { Users, Shield } from "lucide-react";
import { motion } from "framer-motion";
import BrandLogo from "@/components/BrandLogo";

interface RoleSelectionProps {
  onSelectRole: (role: "user" | "admin") => void;
}

const RoleSelection = ({ onSelectRole }: RoleSelectionProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
      {/* Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-3 mb-8"
      >
        <BrandLogo size="lg" />
      </motion.div>

      {/* Title */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-center mb-12"
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold gradient-text mb-4">
          Welcome Back
        </h2>
        <p className="text-muted-foreground max-w-md">
          Select your role to access the FiveM server lookup dashboard
        </p>
      </motion.div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <motion.button
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectRole("user")}
          className="glass-card-hover p-8 text-left group cursor-pointer"
        >
          <div className="icon-badge-cyan mb-6 group-hover:scale-110 transition-transform duration-300">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            User Access
          </h3>
          <p className="text-muted-foreground text-sm">
            Search and view FiveM server information, player counts, and connection details
          </p>
          <div className="mt-6 flex items-center text-primary text-sm font-medium">
            Continue as User
            <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectRole("admin")}
          className="glass-card-hover p-8 text-left group cursor-pointer"
        >
          <div className="icon-badge-magenta mb-6 group-hover:scale-110 transition-transform duration-300">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            Admin Access
          </h3>
          <p className="text-muted-foreground text-sm">
            Full access including advanced analytics, monitoring tools, and management features
          </p>
          <div className="mt-6 flex items-center text-magenta text-sm font-medium">
            Continue as Admin
            <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </motion.button>
      </div>

      {/* Footer */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="mt-12 text-muted-foreground text-sm"
      >
        © 2026 CurlyKiddPanel
      </motion.p>
    </div>
  );
};

export default RoleSelection;
