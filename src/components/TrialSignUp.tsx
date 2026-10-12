/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Home, User, Phone, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';

interface TrialSignUpProps {
  onRegister: (restaurantName: string, ownerName: string, email: string) => void;
  onNavigateToLogin: () => void;
}

export default function TrialSignUp({ onRegister, onNavigateToLogin }: TrialSignUpProps) {
  const [restaurantName, setRestaurantName] = useState('OrderPoint Pro');
  const [ownerName, setOwnerName] = useState('Mohammed Zaid');
  const [phone, setPhone] = useState('9876543210');
  const [email, setEmail] = useState('mohammedzaidd13@gmail.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restaurantName.trim() && ownerName.trim() && email.trim()) {
      onRegister(restaurantName, ownerName, email);
    }
  };

  return (
    <div id="trial_signup_screen" className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-[#10B981] flex items-center justify-center shadow-lg shadow-emerald-100">
            <span className="text-white text-2xl font-bold font-sans">O</span>
          </div>
          <span className="text-3xl font-bold text-[#111827] tracking-tight">
            OrderPoint <span className="text-[#10B981]">Pro</span>
          </span>
        </div>
      </div>

      {/* Trial Form Card */}
      <div className="w-full max-w-xl bg-white rounded-[32px] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#E5E7EB]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#111827] tracking-wider mb-2">
            Start Your Trial
          </h1>
          <p className="text-[#6B7280] text-sm">
            Join 2,400+ restaurants running smarter
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Restaurant Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#6B7280] uppercase block">
              Restaurant Name
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                <Home size={18} />
              </span>
              <input
                id="trial_restaurant"
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="e.g. My Cafe Bar"
                className="w-full h-12 pl-12 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981] focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Owner Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#6B7280] uppercase block">
                Owner Name
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                  <User size={18} />
                </span>
                <input
                  id="trial_owner"
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Jean Doe"
                  className="w-full h-12 pl-12 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981] focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#6B7280] uppercase block">
                Phone
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                  <Phone size={18} />
                </span>
                <input
                  id="trial_phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full h-12 pl-12 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981] focus:bg-white transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#6B7280] uppercase block">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                <Mail size={18} />
              </span>
              <input
                id="trial_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@orderpoint.com"
                className="w-full h-12 pl-12 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981] focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#6B7280] uppercase block">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                <Lock size={18} />
              </span>
              <input
                id="trial_password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-12 pr-12 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#10B981] focus:bg-white transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit green button */}
          <button
            id="btn_trial_submit"
            type="submit"
            className="w-full h-14 bg-[#10B981] text-white rounded-2xl font-bold tracking-wide text-sm hover:bg-[#059669] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-emerald-100"
          >
            START FREE TRIAL
            <span className="text-lg">→</span>
          </button>
        </form>

        {/* Separator */}
        <div className="relative my-7 border-t border-[#F3F4F6] text-center">
          <span className="absolute left-1/2 -translate-y-1/2 -translate-x-1/2 px-4 bg-white text-xs font-medium text-[#9CA3AF] tracking-widest uppercase">
            OR SIGNUP WITH
          </span>
        </div>

        {/* Google Fast flow */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => onRegister(restaurantName, ownerName, email)}
            className="w-full h-12 bg-white border border-[#E5E7EB] rounded-2xl font-medium text-sm text-[#374151] hover:bg-[#F9FAFB] active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path
                fill="#EA4335"
                d="M12 5.04c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 1.72 14.97 1 12 1 7.35 1 3.37 3.65 1.39 7.56l3.85 3C6.18 7.56 8.84 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46C18.18 15.71 17 17.22 15.4 18.28l3.75 2.91c2.19-2.02 3.46-5 3.46-8.92z"
              />
              <path
                fill="#FBBC05"
                d="M5.24 10.56a6.85 6.85 0 010-4.32l-3.85-3A11.96 11.96 0 000 12c0 2.45.74 4.73 2 6.64l3.85-3.08a6.85 6.85 0 01-.61-5z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.75-2.91c-1.12.75-2.55 1.2-4.21 1.2-3.16 0-5.82-2.52-6.76-5.52l-3.85 3C3.37 20.35 7.35 23 12 23z"
              />
            </svg>
            Signup with Google
          </button>

          <div className="text-center pt-1">
            <p className="text-xs text-[#6B7280]">
              Already have an active account?{' '}
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-[#10B981] font-bold hover:underline"
              >
                Welcome Back & Sign In
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer code credentials */}
      <div className="mt-8 text-[#9CA3AF] text-xs font-mono tracking-tight flex items-center gap-1">
        <Sparkles size={12} className="text-amber-500" />
        NO CREDIT CARD REQUIRED • 14 DAYS TRIAL
      </div>
    </div>
  );
}
