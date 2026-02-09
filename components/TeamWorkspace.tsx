import React, { useState } from 'react';
import { Users, UserPlus, Clock, Zap, Shield, CheckCircle, Copy, AlertCircle, Loader2 } from 'lucide-react';
import { TeamMember } from '../types';
import { auth, addTeammateByUID } from '../services/firebase';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

const TeamWorkspace: React.FC = () => {
  const [inviteUid, setInviteUid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [copied, setCopied] = useState(false);

  const currentUid = auth.currentUser?.uid || '';

  const handleCopyUid = () => {
    navigator.clipboard.writeText(currentUid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async () => {
    if (!inviteUid.trim()) return;
    setIsLoading(true);
    setFeedback(null);

    const result = await addTeammateByUID(currentUid, inviteUid.trim());

    if (result.success) {
      setFeedback({ type: 'success', msg: 'Operator added to network.' });
      setInviteUid('');
    } else {
      setFeedback({ type: 'error', msg: result.error || 'Failed to add operator.' });
    }
    setIsLoading(false);
  };

  const members: TeamMember[] = [
    { id: '1', name: 'John Doe', role: 'Manager', status: 'Online', activity: 'Reviewed 12 flagged quotes' },
    { id: '2', name: 'Sarah Miller', role: 'Processor', status: 'Online', activity: 'Ingested 42 carrier quotes' },
    { id: '3', name: 'Mike Ross', role: 'Processor', status: 'Offline', activity: 'Last sync: 2 hours ago' },
    { id: '4', name: 'Atlas AI', role: 'Processor', status: 'Online', activity: 'Auditing global surcharge feed' }
  ];

  return (
    <motion.div 
      className="space-y-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">Team Workspace</h2>
          <p className="text-zinc-500">Coordinate your operations team and manage role-based access.</p>
        </div>
      </div>

      {/* Invite Protocol Section */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* The Joiner: My ID */}
         <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-[2rem] space-y-6">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <Shield size={20} />
               </div>
               <h3 className="text-lg font-black text-white uppercase tracking-tight">Operator Identity</h3>
            </div>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
               Share this unique ID with your Team Owner to be added to the organization's secure node.
            </p>
            <div className="flex items-center gap-3">
               <div className="flex-1 p-4 bg-black rounded-xl border border-zinc-800 font-mono text-xs text-zinc-300 truncate">
                  {currentUid}
               </div>
               <button 
                  onClick={handleCopyUid}
                  className="p-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all border border-zinc-700/50"
               >
                  {copied ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
               </button>
            </div>
         </div>

         {/* The Owner: Invite Input */}
         <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-[2rem] space-y-6">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <UserPlus size={20} />
               </div>
               <h3 className="text-lg font-black text-white uppercase tracking-tight">Add Team Member</h3>
            </div>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
               Paste an operator's UID below to instantly grant them access to this organization's audit history.
            </p>
            <div className="flex items-center gap-3">
               <input 
                  type="text"
                  placeholder="Paste Colleague UID..."
                  value={inviteUid}
                  onChange={(e) => setInviteUid(e.target.value)}
                  className="flex-1 p-4 bg-black rounded-xl border border-zinc-800 font-mono text-xs text-white placeholder:text-zinc-700 outline-none focus:border-emerald-500/50 transition-all"
               />
               <button 
                  onClick={handleInvite}
                  disabled={isLoading || !inviteUid}
                  className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2"
               >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Add
               </button>
            </div>
            {feedback && (
               <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${feedback.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {feedback.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  {feedback.msg}
               </div>
            )}
         </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <motion.div variants={itemVariants} className="md:col-span-8 space-y-6">
           <div className="bg-[#121826]/40 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-900/30 text-[10px] font-black text-zinc-600 uppercase tracking-widest border-b border-zinc-800/50">
                    <th className="px-10 py-6">Member</th>
                    <th className="px-6 py-6">Role</th>
                    <th className="px-6 py-6">Live Status</th>
                    <th className="px-6 py-6 text-right">Recent Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {members.map((m, i) => (
                    <motion.tr 
                      key={m.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="hover:bg-zinc-800/20 transition-all"
                    >
                       <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${m.name === 'Atlas AI' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                                {m.name === 'Atlas AI' ? <Zap size={16} /> : m.name[0]}
                             </div>
                             <span className="text-sm font-bold text-white">{m.name}</span>
                          </div>
                       </td>
                       <td className="px-6 py-6">
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${m.role === 'Manager' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                             {m.role}
                          </span>
                       </td>
                       <td className="px-6 py-6">
                          <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${m.status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                             <span className="text-xs font-medium text-zinc-400">{m.status}</span>
                          </div>
                       </td>
                       <td className="px-6 py-6 text-right">
                          <span className="text-xs text-zinc-500 font-medium">{m.activity}</span>
                       </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
           </div>
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-4 space-y-6">
           <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 space-y-6 shadow-xl">
              <div className="flex items-center gap-3">
                 <Shield size={20} className="text-blue-500" />
                 <h4 className="text-sm font-black text-white uppercase tracking-widest">Workflow Guard</h4>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                 Your workflow requires <span className="text-white font-bold underline">Human-in-the-Loop</span> for any quote drift exceeding 20%. Processors can only approve optimal quotes.
              </p>
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                 <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Daily Audit Quota</span>
                    <span className="text-white font-bold">142 / 500</span>
                 </div>
                 <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 w-[28%]" />
                 </div>
              </div>
           </div>

           <div className="p-8 bg-gradient-to-br from-indigo-900/50 to-blue-900/50 border border-blue-500/20 rounded-[2rem] space-y-4">
              <h4 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest">
                 <Clock size={16} /> Session History
              </h4>
              <div className="space-y-3">
                 {[1,2,3].map(i => (
                   <div key={i} className="flex items-center gap-3 text-xs">
                      <CheckCircle size={14} className="text-emerald-500" />
                      <span className="text-zinc-300">Manager approved batch #842</span>
                   </div>
                 ))}
              </div>
           </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TeamWorkspace;