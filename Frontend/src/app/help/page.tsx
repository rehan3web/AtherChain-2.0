'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, ShieldCheck, Mail, User, MessageSquare } from 'lucide-react';

export default function HelpPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setTimeout(() => setStatus('success'), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-white font-sans">

      {/* Container */}
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/">
            <button className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition">
              <ArrowLeft size={20} />
            </button>
          </Link>

          <span className="text-xs text-white/50 tracking-widest">
            SUPPORT
          </span>
        </div>

        {status === 'success' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center"
          >
            <div className="w-16 h-16 bg-white text-black flex items-center justify-center rounded-xl mx-auto mb-6">
              <ShieldCheck size={28} />
            </div>

            <h2 className="text-2xl font-bold mb-3">Request Received</h2>
            <p className="text-white/60 text-sm mb-6">
              We'll get back to you within 12–24 hours.
            </p>

            <Link href="/">
              <button className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition">
                Go Back
              </button>
            </Link>
          </motion.div>
        ) : (

          <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">

            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold">Need Help?</h1>
              <p className="text-white/50 text-sm mt-1">
                Submit your issue and we’ll assist you.
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm text-white/60 mb-1 block">Full Name</label>
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white">
                <User size={18} className="text-white/40" />
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  className="bg-transparent outline-none w-full text-sm placeholder:text-white/30"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-sm text-white/60 mb-1 block">Email</label>
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white">
                <Mail size={18} className="text-white/40" />
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  className="bg-transparent outline-none w-full text-sm placeholder:text-white/30"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-sm text-white/60 mb-1 block">Message</label>
              <div className="flex gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white">
                <MessageSquare size={18} className="text-white/40 mt-1" />
                <textarea
                  required
                  placeholder="Describe your issue..."
                  className="bg-transparent outline-none w-full text-sm placeholder:text-white/30 resize-none h-28"
                />
              </div>
            </div>

            {/* Button */}
            <button
              disabled={status === 'submitting'}
              className="w-full py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition flex items-center justify-center gap-2"
            >
              {status === 'submitting' ? 'Processing...' : (
                <>
                  Submit <Send size={18} />
                </>
              )}
            </button>

          </form>
        )}
      </div>
    </div>
  );
}